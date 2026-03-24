"""
SchemaValidator: Validation et auto-correction des réponses JSON de l'IA.

Problème: Les LLMs peuvent retourner du JSON mal formé ou des champs manquants.
Solution: Pipeline de nettoyage → parse → validation Pydantic → retry si échec.

La règle d'or: plutôt que d'accepter silencieusement une réponse invalide,
on rejette et on demande une correction (avec le message d'erreur précis).
"""

from __future__ import annotations

import json
import re
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# Regex pour extraire un bloc JSON d'une réponse potentiellement "sale"
# L'IA peut entourer son JSON de backticks ou de texte explicatif
_JSON_BLOCK_RE = re.compile(
    r"```(?:json)?\s*(\{[\s\S]*?\})\s*```|(\{[\s\S]*\})",
    re.MULTILINE,
)


class SchemaValidator:
    """
    Valide et nettoie les réponses JSON de l'IA.

    Stratégie en 3 passes:
    1. Nettoyage syntaxique (suppression des backticks, commentaires //)
    2. Parse JSON + validation de la structure minimale attendue
    3. Validation Pydantic des clauses individuelles avec reporting d'erreurs
    """

    # Structure minimale que doit avoir une réponse valide
    REQUIRED_KEYS = {"clauses"}

    def validate_and_parse(self, raw_response: str) -> dict[str, Any] | None:
        """
        Tente de valider et parser la réponse JSON de l'IA.

        Returns:
            Dict valide ou None si la validation échoue après nettoyage.
            None déclenche un retry dans ContractAnalyzer.
        """
        if not raw_response or not raw_response.strip():
            logger.warning("schema_validator.empty_response")
            return None

        # Passe 1: Nettoyage syntaxique
        cleaned = self._clean_json_response(raw_response)

        # Passe 2: Parse JSON
        parsed = self._safe_json_parse(cleaned)
        if parsed is None:
            logger.warning(
                "schema_validator.parse_failed",
                raw_preview=raw_response[:200],
            )
            return None

        # Passe 3: Validation de structure et sanitization des clauses
        return self._validate_and_sanitize(parsed)

    def build_correction_prompt(
        self,
        original_response: str,
        validation_error: str,
    ) -> str:
        """
        Construit un prompt de correction ciblé pour le retry.
        Inclut le message d'erreur exact pour guider l'IA.
        """
        return f"""Ta réponse précédente contient des erreurs de format.

ERREUR DÉTECTÉE:
{validation_error}

TA RÉPONSE PRÉCÉDENTE (invalide):
{original_response[:1000]}

Corrige uniquement les erreurs mentionnées et retourne le JSON valide complet.
Rappel des règles:
- risk_score et risk_level DOIVENT être cohérents (0-30=LOW, 31-60=MEDIUM, 61-85=HIGH, 86-100=CRITICAL)
- verbatim_quote est OBLIGATOIRE (citation exacte du texte)
- confidence est un float entre 0.0 et 1.0
- Aucun texte avant ou après le JSON
"""

    # ── Méthodes privées ───────────────────────────────────────────────────────

    def _clean_json_response(self, raw: str) -> str:
        """
        Nettoie les artefacts courants dans les réponses LLM:
        - Backticks ```json ... ```
        - Commentaires JavaScript //
        - Trailing commas (JSON invalide mais courant)
        - Caractères de contrôle
        """
        # Extraire le bloc JSON si entouré de backticks
        match = _JSON_BLOCK_RE.search(raw)
        if match:
            cleaned = match.group(1) or match.group(2)
        else:
            cleaned = raw.strip()

        # Supprimer les commentaires // (non-standard JSON)
        cleaned = re.sub(r"//[^\n]*", "", cleaned)

        # Supprimer les trailing commas avant } ou ]
        cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)

        # Supprimer les caractères de contrôle (sauf \n, \t)
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)

        return cleaned.strip()

    def _safe_json_parse(self, text: str) -> dict[str, Any] | None:
        """Parse JSON avec gestion des erreurs explicite."""
        try:
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                logger.warning(
                    "schema_validator.not_a_dict",
                    type=type(parsed).__name__,
                )
                return None
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(
                "schema_validator.json_decode_error",
                error=str(e),
                position=e.pos,
                text_around=text[max(0, e.pos - 50) : e.pos + 50],
            )
            return None

    def _validate_and_sanitize(self, data: dict[str, Any]) -> dict[str, Any] | None:
        """
        Valide la structure et sanitize les valeurs.
        Règles:
        - "clauses" est obligatoire (peut être [])
        - Chaque clause doit avoir type, source.verbatim_quote, risk_score
        - risk_score et risk_level doivent être cohérents
        """
        # Vérification des clés requises
        if not self.REQUIRED_KEYS.issubset(data.keys()):
            missing = self.REQUIRED_KEYS - data.keys()
            logger.warning(
                "schema_validator.missing_keys",
                missing=list(missing),
            )
            return None

        if not isinstance(data.get("clauses"), list):
            logger.warning("schema_validator.clauses_not_list")
            return None

        # Sanitize et valide chaque clause
        valid_clauses = []
        for i, clause in enumerate(data["clauses"]):
            sanitized = self._sanitize_clause(clause, index=i)
            if sanitized is not None:
                valid_clauses.append(sanitized)

        data["clauses"] = valid_clauses
        return data

    def _sanitize_clause(self, clause: Any, index: int) -> dict[str, Any] | None:
        """
        Sanitize une clause individuelle.
        Corrige les erreurs mineures, rejette les clauses irréparables.
        """
        if not isinstance(clause, dict):
            logger.warning(f"schema_validator.clause_{index}_not_dict")
            return None

        # Champs obligatoires
        required_clause_fields = {"type", "source", "risk_score"}
        if not required_clause_fields.issubset(clause.keys()):
            missing = required_clause_fields - clause.keys()
            logger.warning(
                f"schema_validator.clause_{index}_missing_fields",
                missing=list(missing),
            )
            return None

        # Vérification de la source
        source = clause.get("source", {})
        if not isinstance(source, dict) or not source.get("verbatim_quote"):
            logger.warning(
                f"schema_validator.clause_{index}_missing_quote",
                message="verbatim_quote is mandatory - rejecting clause",
            )
            # Clause sans citation = potentielle hallucination → rejet
            return None

        # Auto-correction: dériver risk_level depuis risk_score si incohérent
        risk_score = clause.get("risk_score", 0)
        if not isinstance(risk_score, (int, float)) or not (0 <= risk_score <= 100):
            logger.warning(
                f"schema_validator.clause_{index}_invalid_score",
                score=risk_score,
            )
            return None

        expected_level = (
            "LOW"
            if risk_score <= 30
            else "MEDIUM"
            if risk_score <= 60
            else "HIGH"
            if risk_score <= 85
            else "CRITICAL"
        )

        if clause.get("risk_level") != expected_level:
            logger.info(
                f"schema_validator.clause_{index}_risk_level_corrected",
                from_value=clause.get("risk_level"),
                to_value=expected_level,
                score=risk_score,
            )
            clause["risk_level"] = expected_level

        # Valider et limiter les champs string
        for str_field in ("title", "extracted_text", "ai_recommendation"):
            if str_field in clause and clause[str_field]:
                clause[str_field] = str(clause[str_field])[:500]

        # Garantir source_confidence cohérente
        if source.get("confidence", 1.0) < 0.7:
            source["source_confidence"] = "low"
            # Forcer requires_human_review = True si confiance faible
            clause["requires_human_review"] = True
            logger.info(
                f"schema_validator.clause_{index}_low_confidence_flagged",
                confidence=source.get("confidence"),
            )

        # Garantir que requires_human_review est un bool
        clause["requires_human_review"] = bool(
            clause.get("requires_human_review", False)
        )

        return clause
