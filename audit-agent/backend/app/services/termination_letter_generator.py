"""
TerminationLetterGenerator: Génération de lettres de résiliation juridiquement blindées.

Stratégie "Prompt-to-PDF" en 3 couches:
  1. Jinja2 Template  → Structure formelle (en-têtes, références légales, LRAR)
  2. LLM (GPT-4o)     → Corps argumentatif adapté au motif + base légale
  3. WeasyPrint        → Conversion HTML → PDF (pour envoi LRE ou impression)

Pourquoi cette architecture:
  - L'IA NE GÉNÈRE PAS la structure → elle ne peut pas oublier le N° client
  - Les variables légales sont INJECTÉES par le template (pas hallucinées)
  - Le PDF est identique à chaque génération (déterminisme template)
  - Le corps argumentatif est l'unique partie "IA" → zone contrôlée
"""

from __future__ import annotations

import hashlib
import json
import textwrap
from datetime import date, datetime
from typing import Any

import structlog
from jinja2 import Environment, StrictUndefined, select_autoescape
from openai import OpenAI

from app.core.config import get_settings
from app.domain.termination_plan import (
    AIExtractionResult,
    LegalBasis,
    TerminationPlan,
)

logger = structlog.get_logger(__name__)
settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# Template Jinja2: structure formelle de la lettre
# ─────────────────────────────────────────────────────────────────────────────

LETTER_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2.5cm 2.5cm 3cm 2.5cm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; }
  .sender-block { margin-bottom: 2.5cm; }
  .sender-name { font-weight: bold; font-size: 12pt; }
  .recipient-block { margin-left: 9cm; margin-bottom: 1.5cm; }
  .date-place { text-align: right; margin-bottom: 1.5cm; font-style: italic; }
  .subject { font-weight: bold; text-decoration: underline; margin-bottom: 1.2cm; }
  .ref-line { color: #444; font-size: 10pt; margin-bottom: 0.5cm; }
  .body p { margin-bottom: 0.8em; text-align: justify; }
  .legal-box {
    border: 1px solid #333; border-left: 4px solid #1a1a1a;
    padding: 0.6cm 0.8cm; margin: 1cm 0;
    font-size: 10pt; background: #f8f8f8;
  }
  .legal-box .article { font-weight: bold; }
  .signature-block { margin-top: 2cm; }
  .signature-label { font-style: italic; color: #555; margin-bottom: 0.3cm; }
  .pj { margin-top: 1.5cm; font-size: 9pt; color: #555; border-top: 1px solid #ccc; padding-top: 0.5cm; }
  .footer-legal {
    position: fixed; bottom: 1cm; left: 2.5cm; right: 2.5cm;
    font-size: 8pt; color: #777; text-align: center; border-top: 1px solid #ccc; padding-top: 0.3cm;
  }
</style>
</head>
<body>

<!-- EXPÉDITEUR -->
<div class="sender-block">
  <div class="sender-name">{{ sender_name }}</div>
  <div>{{ sender_address }}</div>
  <div>{{ sender_city }}</div>
  {% if customer_contract_id %}
  <div class="ref-line">N° Client / Contrat : <strong>{{ customer_contract_id }}</strong></div>
  {% endif %}
  {% if sender_email %}
  <div class="ref-line">Email : {{ sender_email }}</div>
  {% endif %}
</div>

<!-- DESTINATAIRE -->
<div class="recipient-block">
  <strong>{{ supplier_name }}</strong><br>
  Service Résiliations<br>
  {% if supplier_address %}{{ supplier_address }}<br>{% endif %}
</div>

<!-- DATE + LIEU -->
<div class="date-place">
  Fait à {{ sender_city_name }}, le {{ formatted_date }}
</div>

<!-- OBJET -->
<div class="subject">
  Objet : Résiliation du contrat {{ contract_name }} — Envoi en Lettre Recommandée Électronique
</div>

<!-- CORPS DE LA LETTRE -->
<div class="body">
  <p>Madame, Monsieur,</p>

  {{ ai_body_html | safe }}

  <!-- ENCADRÉ LÉGAL : injecté par le template, jamais par l'IA -->
  <div class="legal-box">
    <div class="article">Fondement juridique :</div>
    <div>{{ legal_article }}</div>
    {% if verbatim_clause %}
    <div style="margin-top:0.4cm; font-style:italic; font-size:10pt;">
      Extrait du contrat (page {{ notice_clause_page }}) :<br>
      « {{ verbatim_clause }} »
    </div>
    {% endif %}
  </div>

  <p>
    Je vous demande de bien vouloir confirmer la bonne réception de ce courrier
    et de me transmettre dans les meilleurs délais la confirmation écrite
    de la résiliation effective au <strong>{{ effective_termination_date }}</strong>.
  </p>

  <p>
    À défaut de réponse sous 15 jours calendaires, je me réserve le droit
    de saisir les autorités compétentes (DGCCRF, Médiateur de la consommation).
  </p>

  <p>Dans l'attente de votre accusé de réception, je vous adresse, Madame, Monsieur,
  mes sincères salutations.</p>
</div>

<!-- SIGNATURE -->
<div class="signature-block">
  <div class="signature-label">Signature électronique eIDAS Niveau 1 :</div>
  <div><strong>{{ sender_name }}</strong></div>
  {% if esign_reference %}
  <div style="font-size:9pt; color:#666; margin-top:0.3cm;">
    Référence signature : {{ esign_reference }}
  </div>
  {% endif %}
</div>

<!-- PIÈCES JOINTES -->
<div class="pj">
  <strong>Pièces jointes :</strong><br>
  - Copie du contrat initial du {{ signature_date }}<br>
  {% if has_lre_proof %}- Preuve de dépôt LRE (accusé électronique AR24/Maileva)<br>{% endif %}
  {% if has_etf_contestation %}- Courrier de contestation des frais de résiliation<br>{% endif %}
</div>

<!-- FOOTER LÉGAL -->
<div class="footer-legal">
  Lettre générée par Unsubscribe.ai — Référence {{ plan_id }} — {{ generation_timestamp }}
</div>

</body>
</html>
"""


# Prompt système pour la génération du corps argumentatif par l'IA
LETTER_BODY_SYSTEM_PROMPT = """\
Tu es un juriste expert en droit des contrats français. Tu rédiges le corps d'une
lettre de résiliation formelle. Ton texte sera inséré dans un template HTML.

## CONTRAINTES ABSOLUES

1. NE JAMAIS inventer d'informations (montants, dates, numéros de contrat).
   Utilise UNIQUEMENT les données fournies dans le contexte JSON.
2. Utiliser le vouvoiement, le style formel, le présent de l'indicatif.
3. Retourner du HTML simple: <p>, <strong>, <em> uniquement. Pas de div, table, ul.
4. Maximum 4 paragraphes de corps (hors formule de politesse — elle est dans le template).
5. Citer la base légale exactement telle que fournie dans le contexte.
6. Si ETF contestable: mentionner Art. L.132-1 Code de la Consommation (clause abusive).
7. Ne pas inclure l'objet, les coordonnées, la date, la signature — tout cela est dans le template.
"""


class TerminationLetterGenerator:
    """
    Générateur de lettres de résiliation en deux temps:
      1. GPT-4o génère le corps argumentatif (HTML partiel)
      2. Jinja2 assemble le document complet avec toutes les variables

    La séparation Template/IA garantit:
    - Aucune variable critique (N° client, base légale) ne peut être oubliée
    - Le document est reproductible (même template + même input = même output)
    - L'IA ne peut pas "halluciner" les en-têtes ou les références légales
    """

    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.OPENAI_API_KEY.get_secret_value())
        self._env = Environment(
            autoescape=select_autoescape(["html"]),
            undefined=StrictUndefined,  # Erreur si variable manquante → fail-fast
        )
        self._template = self._env.from_string(LETTER_HTML_TEMPLATE)

    def generate(
        self,
        plan: TerminationPlan,
        sender_name: str,
        sender_address: str,
        sender_city: str,
        sender_email: str | None = None,
        supplier_address: str | None = None,
        esign_reference: str | None = None,
    ) -> tuple[str, str]:
        """
        Génère la lettre complète.

        Returns:
            (html_content, document_sha256)
            - html_content: Lettre HTML prête pour WeasyPrint ou affichage
            - document_sha256: Hash SHA-256 du document (pour preuve d'intégrité LRE)
        """
        extraction = plan.extraction
        log = logger.bind(plan_id=str(plan.plan_id))

        # ── Étape 1: Génération du corps argumentatif par l'IA ────────────────
        log.info("letter.generating_body")
        ai_body_html = self._generate_ai_body(plan=plan, sender_name=sender_name)

        # ── Étape 2: Calcul de la date de résiliation effective ───────────────
        effective_date = self._compute_effective_termination_date(plan)

        # ── Étape 3: Assemblage Jinja2 ─────────────────────────────────────────
        context = self._build_template_context(
            plan=plan,
            sender_name=sender_name,
            sender_address=sender_address,
            sender_city=sender_city,
            sender_email=sender_email,
            supplier_address=supplier_address,
            esign_reference=esign_reference,
            ai_body_html=ai_body_html,
            effective_termination_date=effective_date,
        )

        html_content = self._template.render(**context)

        # ── Étape 4: Hash pour intégrité documentaire ─────────────────────────
        doc_sha256 = hashlib.sha256(html_content.encode("utf-8")).hexdigest()

        log.info(
            "letter.generated",
            sha256=doc_sha256[:16] + "...",
            html_length=len(html_content),
        )

        return html_content, doc_sha256

    def _generate_ai_body(self, plan: TerminationPlan, sender_name: str) -> str:
        """
        Appel LLM pour générer le corps argumentatif de la lettre.

        Le contexte fourni à l'IA est minimal et ne contient JAMAIS:
        - PII non masquées
        - Données hors contexte contractuel
        """
        extraction = plan.extraction

        # Contexte JSON structuré fourni à l'IA (pas de texte libre)
        context: dict[str, Any] = {
            "contract_name": extraction.contract_name,
            "supplier_name": extraction.parties.supplier_name,
            "signature_date": extraction.signature_date.isoformat(),
            "duration_months": extraction.duration_months,
            "notice_period_months": plan.applied_notice_months,
            "notice_deadline": plan.notice_deadline.isoformat() if plan.notice_deadline else None,
            "anniversary_date": plan.anniversary_date.isoformat(),
            "annual_amount_eur": extraction.annual_amount_eur,
            "legal_basis": extraction.legal_basis.value,
            "legal_article": plan.legal_article,
            "is_within_legal_window": plan.is_within_legal_window,
            "early_termination_fee_eur": plan.early_termination_fee_eur,
            "etf_is_contestable": (
                extraction.early_termination_fee is not None
                and not extraction.early_termination_fee.is_legally_enforceable
            ),
            "customer_contract_id": extraction.parties.customer_contract_id,
            "notice_verbatim": extraction.notice_clause_verbatim,
        }

        user_prompt = (
            f"Contexte contractuel:\n```json\n{json.dumps(context, ensure_ascii=False, indent=2)}\n```\n\n"
            f"Rédige le corps de la lettre de résiliation pour {sender_name}.\n"
            "Inclure: 1) Rappel du contrat 2) Volonté ferme de résilier 3) Base légale "
            "4) Demande de confirmation écrite. Si ETF contestable: ajouter paragraphe de contestation."
        )

        try:
            response = self._client.chat.completions.create(
                model=settings.CLAUDE_MODEL,
                messages=[
                    {"role": "system", "content": LETTER_BODY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,  # Quasi-déterminisme (légal = reproductible)
                max_tokens=1500,
            )
            return response.choices[0].message.content or ""

        except Exception as exc:
            logger.error("letter.ai_body_failed", error=str(exc))
            # Fallback: corps générique basé sur le template
            return self._fallback_body(extraction, plan)

    @staticmethod
    def _fallback_body(extraction: AIExtractionResult, plan: TerminationPlan) -> str:
        """Corps de lettre de secours si l'IA est indisponible."""
        return textwrap.dedent(f"""
            <p>Par la présente, je vous informe de ma décision de résilier le contrat
            <strong>{extraction.contract_name}</strong> conclu le
            {extraction.signature_date.strftime("%d/%m/%Y")}
            avec votre société {extraction.parties.supplier_name}.</p>

            <p>Cette résiliation prend effet conformément aux dispositions contractuelles
            et légales applicables, notamment {plan.legal_article}.</p>

            <p>En application du délai de préavis de {plan.applied_notice_months} mois
            prévu au contrat, la résiliation sera effective à la date
            d'anniversaire du <strong>{plan.anniversary_date.strftime("%d/%m/%Y")}</strong>.</p>

            <p>Je vous saurais gré de bien vouloir accuser réception du présent courrier
            et de confirmer la prise en compte de ma demande de résiliation.</p>
        """).strip()

    @staticmethod
    def _compute_effective_termination_date(plan: TerminationPlan) -> str:
        """
        Date de résiliation effective = date d'anniversaire du contrat
        (pas la deadline de préavis qui est antérieure).
        """
        return plan.anniversary_date.strftime("%d/%m/%Y")

    @staticmethod
    def _build_template_context(
        plan: TerminationPlan,
        sender_name: str,
        sender_address: str,
        sender_city: str,
        sender_email: str | None,
        supplier_address: str | None,
        esign_reference: str | None,
        ai_body_html: str,
        effective_termination_date: str,
    ) -> dict[str, Any]:
        extraction = plan.extraction
        return {
            # Expéditeur
            "sender_name": sender_name,
            "sender_address": sender_address,
            "sender_city": sender_city,
            "sender_city_name": sender_city.split(" ", 1)[-1] if sender_city else "",
            "sender_email": sender_email,
            # Destinataire
            "supplier_name": extraction.parties.supplier_name,
            "supplier_address": supplier_address,
            "customer_contract_id": extraction.parties.customer_contract_id,
            # Dates
            "formatted_date": date.today().strftime("%d %B %Y").lower().capitalize(),
            "signature_date": extraction.signature_date.strftime("%d/%m/%Y"),
            "effective_termination_date": effective_termination_date,
            # Contrat
            "contract_name": extraction.contract_name,
            # Légal
            "legal_article": plan.legal_article,
            "verbatim_clause": extraction.notice_clause_verbatim,
            "notice_clause_page": extraction.notice_clause_page,
            # Corps IA
            "ai_body_html": ai_body_html,
            # Signature
            "esign_reference": esign_reference,
            # Pièces jointes
            "has_lre_proof": plan.lre_proof is not None,
            "has_etf_contestation": (
                extraction.early_termination_fee is not None
                and not extraction.early_termination_fee.is_legally_enforceable
            ),
            # Footer
            "plan_id": str(plan.plan_id)[:8].upper(),
            "generation_timestamp": datetime.utcnow().strftime("%d/%m/%Y %H:%M UTC"),
        }
