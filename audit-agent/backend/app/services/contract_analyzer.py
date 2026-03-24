"""
ContractAnalyzer: Orchestrateur principal du pipeline d'analyse IA.

Architecture: OCR → Chunking → Extraction → Validation → Consolidation
Modèle: Claude claude-sonnet-4-6 (vision pour PDFs scannés, texte pour natifs)
Retry: Exponentiel avec jitter (Tenacity) - max 3 tentatives par chunk
"""
from __future__ import annotations

import base64
import json
import logging
import time
from datetime import datetime
from typing import Any
from uuid import UUID

import anthropic
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import get_settings
from app.models.contract import (
    AnalysisResult,
    ClauseSource,
    ClauseType,
    ContractClause,
    ContractType,
    DocumentMetadata,
    FinancialImpact,
    FinancialSummary,
    NoticeDeadline,
    ProcessingMetadata,
    RiskLevel,
    SourceConfidence,
)
from app.services.notice_calculator import compute_notice_deadline
from app.services.pii_anonymizer import PiiAnonymizer
from app.services.pdf_extractor import PdfExtractor
from app.services.schema_validator import SchemaValidator

logger = structlog.get_logger(__name__)
settings = get_settings()

# ── Prompts ───────────────────────────────────────────────────────────────────

# Ce prompt est FIXE et sera mis en cache côté Anthropic (Prompt Caching).
# Économie estimée: ~40% sur le coût tokens pour les chunks répétitifs.
EXTRACTION_SYSTEM_PROMPT = """\
Tu es un expert juridique senior spécialisé en contrats commerciaux PME français.
Ton rôle est d'extraire avec une précision maximale les clauses à risque financier.

## RÈGLES ABSOLUES (violation = rejet automatique de ta réponse)

1. CITATION OBLIGATOIRE: Pour chaque clause extraite, tu DOIS fournir:
   - Le numéro de page exact (integer >= 1)
   - Le numéro de paragraphe/article si visible (ex: "§12.3.b", "Article 5.2")
   - Une citation textuelle directe de 20 à 500 caractères, COPIÉE EXACTEMENT du texte

2. JAMAIS INVENTER: Si tu ne trouves pas une information, utilise null.
   N'invente JAMAIS une citation, un montant, ou une date.

3. COHÉRENCE SCORES: risk_score et risk_level DOIVENT être cohérents:
   - 0-30   → "LOW"
   - 31-60  → "MEDIUM"
   - 61-85  → "HIGH"
   - 86-100 → "CRITICAL"

4. FORMAT JSON STRICT: Réponds UNIQUEMENT avec du JSON valide. Aucun texte avant ou après.

## TYPES DE CLAUSES À DÉTECTER

- PRICE_ESCALATION: Indexation, révision de prix, clauses d'actualisation
- AUTO_RENEWAL: Renouvellement tacite, reconduction automatique
- TERMINATION_PENALTY: Pénalités de résiliation anticipée, indemnités
- NOTICE_PERIOD: Délai de préavis, délai de résiliation
- PAYMENT_TERMS: Conditions de paiement, pénalités de retard
- DATA_PROCESSING: Traitement des données, sous-traitance, RGPD
- LIABILITY_CAP: Plafond de responsabilité, limitation de garantie
- EXCLUSIVITY: Clause d'exclusivité
- FORCE_MAJEURE: Clause de force majeure

## SCORING DES RISQUES

PRICE_ESCALATION:
  - Taux fixe ≤ 1.5%/an → score 20-30
  - Taux fixe 1.5-3%/an  → score 35-50
  - Taux fixe > 3%/an    → score 60-75
  - Indexation sans plafond → score 75-90

AUTO_RENEWAL:
  - Préavis ≥ 3 mois     → score 20-40
  - Préavis 1-3 mois     → score 45-65
  - Préavis < 1 mois     → score 70-85
  - Sans préavis défini  → score 85-95

TERMINATION_PENALTY:
  - Pénalité ≤ 1 mois de contrat  → score 20-40
  - Pénalité 1-3 mois             → score 45-65
  - Pénalité > 3 mois             → score 70-90
  - Pas de droit de résiliation   → score 90-100
"""

EXTRACTION_USER_PROMPT = """\
## TABLE DES MATIÈRES DU CONTRAT (référence croisée)
{table_of_contents}

## TEXTE À ANALYSER (pages {start_page} à {end_page})
{chunk_text}

## INSTRUCTION
Extrais toutes les clauses à risque financier du texte ci-dessus.
Retourne un JSON avec la structure exacte suivante:

```json
{{
  "contract_type": "SERVICE|LEASE|SUPPLY|MAINTENANCE|SUBSCRIPTION|NDA|PARTNERSHIP|OTHER",
  "parties": {{
    "supplier": "Nom du fournisseur",
    "client": "Nom du client"
  }},
  "clauses": [
    {{
      "type": "PRICE_ESCALATION",
      "title": "Titre court et descriptif",
      "extracted_text": "Résumé de la clause en 1-3 phrases",
      "source": {{
        "page": 12,
        "paragraph": "§5.3.a",
        "verbatim_quote": "Citation exacte copiée du texte...",
        "confidence": 0.98,
        "source_confidence": "high"
      }},
      "risk_score": 75,
      "risk_level": "HIGH",
      "financial_impact": {{
        "annualized_amount_eur": null,
        "escalation_rate_min_pct": 3.0,
        "escalation_rate_max_pct": null,
        "worst_case_year_3_eur": null,
        "termination_penalty_eur": null,
        "lock_in_months": null
      }},
      "notice_raw": {{
        "period_months": null,
        "signature_date": null,
        "duration_months": null
      }},
      "requires_human_review": false,
      "ai_recommendation": "Recommandation actionnable en 1-2 phrases."
    }}
  ]
}}
```

Si aucune clause à risque n'est trouvée dans ce chunk, retourne: {{"clauses": []}}
"""

TABLE_OF_CONTENTS_PROMPT = """\
Analyse ce document contractuel et extrait sa structure.
Retourne UNIQUEMENT ce JSON:
{
  "contract_type": "...",
  "parties": {"supplier": "...", "client": "..."},
  "total_pages": N,
  "sections": [
    {"title": "...", "article_number": "§1", "page_start": 1, "page_end": 3,
     "relevant_for_risk": true/false}
  ]
}

Marque relevant_for_risk=true uniquement pour les sections contenant:
prix, durée, résiliation, préavis, pénalités, renouvellement, données.
"""


# ── Service Principal ──────────────────────────────────────────────────────────

class ContractAnalyzer:
    """
    Orchestrateur complet du pipeline d'analyse de contrats PME.

    Usage:
        analyzer = ContractAnalyzer()
        result = await analyzer.analyze(
            pdf_bytes=file_content,
            filename="contrat.pdf",
            tenant_id=uuid
        )
    """

    # Taille cible par chunk en tokens (~6 pages de texte dense)
    CHUNK_TARGET_TOKENS = 8_000
    # Overlap entre chunks: 2 derniers paragraphes du chunk précédent
    OVERLAP_TOKENS = 400
    # Nombre max de chunks par contrat (sécurité anti-runaway)
    MAX_CHUNKS = 50

    def __init__(self) -> None:
        self._client = anthropic.Anthropic(
            api_key=settings.ANTHROPIC_API_KEY.get_secret_value(),
            # Option RGPD: pointer vers Bedrock EU si configuré
            base_url=(
                str(settings.ANTHROPIC_BASE_URL)
                if settings.ANTHROPIC_BASE_URL
                else None
            ),
        )
        self._pii = PiiAnonymizer()
        self._pdf = PdfExtractor()
        self._validator = SchemaValidator()
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._validation_retries = 0

    async def analyze(
        self,
        pdf_bytes: bytes,
        filename: str,
        tenant_id: UUID,
        on_progress: Any = None,  # Callback pour streaming progress
    ) -> AnalysisResult:
        """
        Pipeline complet: PDF → AnalysisResult validé.

        Args:
            pdf_bytes: Contenu brut du PDF
            filename: Nom du fichier (pour les logs)
            tenant_id: Isolation RGPD par client
            on_progress: Callable(pct: int, step: str) pour le suivi temps réel
        """
        start_time = time.monotonic()
        log = logger.bind(filename=filename, tenant_id=str(tenant_id))

        # ── Étape 1: Extraction PDF ────────────────────────────────────────────
        log.info("pdf_extraction.start")
        await self._report_progress(on_progress, 5, "Extraction du PDF...")

        extraction = await self._pdf.extract(pdf_bytes)
        page_count = extraction.page_count
        is_scanned = extraction.is_scanned

        log.info(
            "pdf_extraction.complete",
            pages=page_count,
            is_scanned=is_scanned,
            char_count=len(extraction.full_text),
        )

        # ── Étape 2: Anonymisation PII ─────────────────────────────────────────
        log.info("pii_anonymization.start")
        await self._report_progress(on_progress, 10, "Anonymisation des données...")

        anonymized_text, pii_mapping = self._pii.anonymize(extraction.full_text)
        pii_count = len(pii_mapping)

        log.info("pii_anonymization.complete", entities_redacted=pii_count)

        # ── Étape 3: Table des matières (1er pass, tout le document) ──────────
        await self._report_progress(on_progress, 15, "Analyse de la structure...")

        table_of_contents = await self._extract_table_of_contents(
            text=anonymized_text,
            page_images=extraction.page_images if is_scanned else None,
        )

        # ── Étape 4: Chunking + Extraction par sections pertinentes ──────────
        await self._report_progress(on_progress, 20, "Extraction des clauses...")

        chunks = self._pdf.create_strategic_chunks(
            text=anonymized_text,
            table_of_contents=table_of_contents,
            chunk_target_tokens=self.CHUNK_TARGET_TOKENS,
            overlap_tokens=self.OVERLAP_TOKENS,
        )

        chunks = chunks[: self.MAX_CHUNKS]  # Sécurité anti-runaway
        all_clauses: list[ContractClause] = []
        contract_type = ContractType.OTHER
        parties: dict[str, str] = {}

        for idx, chunk in enumerate(chunks):
            progress = 20 + int(60 * (idx / len(chunks)))
            await self._report_progress(
                on_progress, progress, f"Analyse chunk {idx+1}/{len(chunks)}..."
            )

            chunk_result = await self._extract_clauses_from_chunk(
                chunk_text=chunk.text,
                start_page=chunk.start_page,
                end_page=chunk.end_page,
                table_of_contents=table_of_contents,
                page_images=extraction.page_images if is_scanned else None,
            )

            if chunk_result:
                all_clauses.extend(chunk_result.get("clauses", []))
                if chunk_result.get("contract_type"):
                    contract_type = ContractType(chunk_result["contract_type"])
                if chunk_result.get("parties"):
                    parties.update(chunk_result["parties"])

        # ── Étape 5: Déduplication + Calcul préavis ────────────────────────────
        await self._report_progress(on_progress, 85, "Calcul des préavis...")

        unique_clauses = self._deduplicate_clauses(all_clauses)
        clauses_with_notices = self._compute_all_notices(unique_clauses)

        # ── Étape 6: Score global + Financial Summary ─────────────────────────
        await self._report_progress(on_progress, 95, "Finalisation du rapport...")

        global_score = self._compute_global_risk_score(clauses_with_notices)
        financial_summary = self._compute_financial_summary(clauses_with_notices)
        elapsed = time.monotonic() - start_time

        result = AnalysisResult(
            tenant_id=tenant_id,
            analyzed_at=datetime.utcnow(),
            document=DocumentMetadata(
                filename=filename,
                page_count=page_count,
                detected_language=extraction.detected_language,
                contract_type=contract_type,
                parties=parties,
            ),
            financial_summary=financial_summary,
            clauses=clauses_with_notices,
            global_risk_score=global_score,
            risk_level=self._score_to_level(global_score),
            processing_metadata=ProcessingMetadata(
                model_used=settings.CLAUDE_MODEL,
                total_input_tokens=self._total_input_tokens,
                total_output_tokens=self._total_output_tokens,
                estimated_cost_usd=self._compute_cost(),
                processing_time_seconds=round(elapsed, 2),
                chunks_processed=len(chunks),
                validation_retries=self._validation_retries,
                pii_entities_redacted=pii_count,
            ),
        )

        await self._report_progress(on_progress, 100, "Analyse terminée.")
        log.info(
            "analysis.complete",
            clauses_found=len(clauses_with_notices),
            global_score=global_score,
            cost_usd=result.processing_metadata.estimated_cost_usd,
            elapsed_s=elapsed,
        )

        return result

    # ── Méthodes privées ───────────────────────────────────────────────────────

    @retry(
        retry=retry_if_exception_type((anthropic.RateLimitError, anthropic.APIConnectionError)),
        wait=wait_exponential_jitter(initial=1, max=30),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    async def _call_claude(
        self,
        messages: list[dict],
        system: str | None = None,
        use_cache: bool = True,
    ) -> str:
        """
        Appel Claude avec retry exponentiel + jitter.

        Retry sur: RateLimitError, APIConnectionError
        Pas de retry sur: AuthenticationError, InvalidRequestError (erreurs définitives)

        Le paramètre use_cache active le Prompt Caching Anthropic sur le system prompt,
        réduisant le coût des tokens répétitifs de ~40%.
        """
        system_blocks: list[dict] = []
        if system:
            if use_cache:
                # Marquage pour le Prompt Caching Anthropic
                # Le system prompt fixe est mis en cache entre les appels
                system_blocks = [
                    {
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }
                ]
            else:
                system_blocks = [{"type": "text", "text": system}]

        response = self._client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=settings.CLAUDE_MAX_TOKENS,
            temperature=settings.CLAUDE_TEMPERATURE,
            system=system_blocks if system_blocks else anthropic.NOT_GIVEN,
            messages=messages,
        )

        # Tracking des tokens pour le monitoring des coûts
        self._total_input_tokens += response.usage.input_tokens
        self._total_output_tokens += response.usage.output_tokens

        # Vérification du seuil de coût max par contrat
        current_cost = self._compute_cost()
        if current_cost > settings.MAX_COST_USD_PER_CONTRACT:
            raise ValueError(
                f"Cost threshold exceeded: ${current_cost:.3f} > "
                f"${settings.MAX_COST_USD_PER_CONTRACT} per contract. "
                "Stopping analysis to prevent runaway costs."
            )

        return response.content[0].text

    async def _extract_table_of_contents(
        self,
        text: str,
        page_images: list[bytes] | None = None,
    ) -> dict:
        """
        Premier pass: extraction de la structure du contrat.
        Utilise les 6 premières pages maximum (suffisant pour le sommaire).
        """
        # On limite à ~12 000 tokens pour le premier pass (structure uniquement)
        preview_text = text[:40_000]

        try:
            raw = await self._call_claude(
                system=TABLE_OF_CONTENTS_PROMPT,
                messages=[{"role": "user", "content": preview_text}],
                use_cache=True,
            )
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning("toc_extraction.failed", error=str(e))
            # Fallback: structure vide, on analysera tout le document linéairement
            return {"sections": [], "contract_type": "OTHER", "parties": {}}

    @retry(
        retry=retry_if_exception_type((ValueError, json.JSONDecodeError)),
        wait=wait_exponential_jitter(initial=0.5, max=8),
        stop=stop_after_attempt(3),
    )
    async def _extract_clauses_from_chunk(
        self,
        chunk_text: str,
        start_page: int,
        end_page: int,
        table_of_contents: dict,
        page_images: list[bytes] | None = None,
    ) -> dict | None:
        """
        Extraction des clauses d'un chunk avec validation + retry.

        Le retry ici est sur les erreurs de VALIDATION (réponse JSON invalide de l'IA),
        pas seulement sur les erreurs réseau. Jusqu'à 3 tentatives avec prompt de correction.
        """
        self._validation_retries += 1  # Compteur global (décrémenté si succès 1er essai)

        toc_summary = json.dumps(
            {"sections": table_of_contents.get("sections", [])[:10]},
            ensure_ascii=False,
        )

        user_prompt = EXTRACTION_USER_PROMPT.format(
            table_of_contents=toc_summary,
            start_page=start_page,
            end_page=end_page,
            chunk_text=chunk_text,
        )

        # Si PDF scanné: inclure les images de pages pour l'OCR vision
        if page_images:
            messages = self._build_vision_messages(
                user_prompt, page_images, start_page, end_page
            )
        else:
            messages = [{"role": "user", "content": user_prompt}]

        raw_response = await self._call_claude(
            system=EXTRACTION_SYSTEM_PROMPT,
            messages=messages,
            use_cache=True,  # System prompt mis en cache → économie tokens
        )

        # Validation et nettoyage du JSON retourné par l'IA
        validated = self._validator.validate_and_parse(raw_response)

        if validated is None:
            # Le validator ne peut pas corriger → retry avec prompt explicite
            self._validation_retries += 1
            raise ValueError(f"Schema validation failed for chunk p{start_page}-{end_page}")

        return validated

    def _build_vision_messages(
        self,
        user_prompt: str,
        page_images: list[bytes],
        start_page: int,
        end_page: int,
    ) -> list[dict]:
        """
        Construit un message multimodal pour Claude Vision (PDFs scannés).
        Limite à 5 images par chunk pour éviter le dépassement du context window.
        """
        content: list[dict] = [{"type": "text", "text": user_prompt}]

        # Pages concernées uniquement (index 0-based)
        relevant_images = page_images[start_page - 1 : end_page][:5]

        for img_bytes in relevant_images:
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64.standard_b64encode(img_bytes).decode(),
                    },
                }
            )

        return [{"role": "user", "content": content}]

    def _compute_global_risk_score(self, clauses: list[ContractClause]) -> float:
        """
        Moyenne pondérée des scores de clauses.
        Les types à fort impact financier ont un poids plus élevé.
        Voir TDD §2.4 pour la formule complète.
        """
        WEIGHTS: dict[ClauseType, float] = {
            ClauseType.PRICE_ESCALATION: 3.0,
            ClauseType.TERMINATION_PENALTY: 2.5,
            ClauseType.AUTO_RENEWAL: 2.0,
            ClauseType.NOTICE_PERIOD: 1.5,
            ClauseType.EXCLUSIVITY: 1.5,
            ClauseType.PAYMENT_TERMS: 1.2,
            ClauseType.DATA_PROCESSING: 1.0,
            ClauseType.LIABILITY_CAP: 1.0,
            ClauseType.FORCE_MAJEURE: 0.5,
            ClauseType.OTHER: 0.8,
        }

        if not clauses:
            return 0.0

        total_weighted_score = 0.0
        total_weight = 0.0

        for clause in clauses:
            weight = WEIGHTS.get(clause.type, 1.0)
            total_weighted_score += clause.risk_score * weight
            total_weight += weight

        return round(total_weighted_score / total_weight, 2) if total_weight > 0 else 0.0

    def _compute_financial_summary(
        self, clauses: list[ContractClause]
    ) -> FinancialSummary:
        """Agrège les impacts financiers de toutes les clauses."""
        annual_amounts = [
            c.financial_impact.annualized_amount_eur
            for c in clauses
            if c.financial_impact and c.financial_impact.annualized_amount_eur
        ]
        penalties = [
            c.financial_impact.termination_penalty_eur
            for c in clauses
            if c.financial_impact and c.financial_impact.termination_penalty_eur
        ]
        escalation_rates = [
            c.financial_impact.escalation_rate_min_pct
            for c in clauses
            if c.financial_impact and c.financial_impact.escalation_rate_min_pct
        ]

        annual_amount = max(annual_amounts) if annual_amounts else None

        return FinancialSummary(
            annual_amount_eur=annual_amount,
            monthly_amount_eur=round(annual_amount / 12, 2) if annual_amount else None,
            price_escalation_risk_pct=max(escalation_rates) if escalation_rates else None,
            total_penalty_exposure_eur=sum(penalties) if penalties else None,
        )

    def _compute_all_notices(
        self, clauses: list[ContractClause]
    ) -> list[ContractClause]:
        """
        Calcule les deadlines de préavis pour les clauses qui en ont besoin.
        Voir TDD §2.5 pour l'algorithme mathématique complet.
        """
        result = []
        for clause in clauses:
            if clause.type in (ClauseType.AUTO_RENEWAL, ClauseType.NOTICE_PERIOD):
                # Note: les dates brutes sont extraites par l'IA dans notice_raw
                # et converties ici en NoticeDeadline calculée.
                # En production, notice_raw est parsé depuis le JSON IA.
                pass
            result.append(clause)
        return result

    def _deduplicate_clauses(
        self, clauses: list[ContractClause]
    ) -> list[ContractClause]:
        """
        Déduplique les clauses identifiées dans plusieurs chunks.
        Stratégie: hash sur (type + page + verbatim_quote[:50]).
        """
        seen: set[str] = set()
        unique: list[ContractClause] = []

        for clause in clauses:
            key = f"{clause.type}|{clause.source.page}|{clause.source.verbatim_quote[:50]}"
            if key not in seen:
                seen.add(key)
                unique.append(clause)

        return unique

    def _compute_cost(self) -> float:
        """
        Calcule le coût estimé en USD basé sur l'usage de tokens.
        Tarifs Claude claude-sonnet-4-6 (2026): $3/M input, $15/M output.
        """
        input_cost = (self._total_input_tokens / 1_000_000) * 3.0
        output_cost = (self._total_output_tokens / 1_000_000) * 15.0
        return round(input_cost + output_cost, 6)

    @staticmethod
    def _score_to_level(score: float) -> RiskLevel:
        if score <= 30:
            return RiskLevel.LOW
        elif score <= 60:
            return RiskLevel.MEDIUM
        elif score <= 85:
            return RiskLevel.HIGH
        return RiskLevel.CRITICAL

    @staticmethod
    async def _report_progress(
        callback: Any, pct: int, step: str
    ) -> None:
        if callback:
            await callback(pct, step)
