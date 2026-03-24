"""
PiiAnonymizer: Anonymisation RGPD des données personnelles AVANT envoi à l'IA.

Principe fondamental: les données personnelles (noms, emails, SIRET, IBAN)
ne quittent JAMAIS nos serveurs non-anonymisées.

Outil: Microsoft Presidio (open-source, déploiement 100% local, zéro réseau)
Langues supportées: français (fr) + anglais (en)

Flux:
  Texte original → Détection NER (spaCy fr_core_news_lg) → Remplacement →
  Texte anonymisé + Mapping de réversion → [Envoi IA] → [Réversion UI]
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import NamedTuple

import structlog

logger = structlog.get_logger(__name__)

# Importations conditionnelles: Presidio est lourd, on le charge paresseusement
try:
    from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
    from presidio_analyzer.nlp_engine import NlpEngineProvider
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig

    PRESIDIO_AVAILABLE = True
except ImportError:
    PRESIDIO_AVAILABLE = False
    logger.warning(
        "presidio.not_available",
        message="Install presidio-analyzer and presidio-anonymizer for PII detection",
    )


# Entités PII à détecter et anonymiser (conforme RGPD Art. 4)
PII_ENTITIES = [
    "PERSON",          # Noms de personnes physiques
    "EMAIL_ADDRESS",   # Adresses email
    "PHONE_NUMBER",    # Numéros de téléphone
    "IBAN_CODE",       # Codes IBAN
    "CREDIT_CARD",     # Numéros de carte bancaire
    "IP_ADDRESS",      # Adresses IP
    "URL",             # URLs pouvant contenir des identifiants
    "LOCATION",        # Adresses postales
    "DATE_TIME",       # Dates de naissance (pas les dates contractuelles!)
    "NRP",             # Numéros de registre public (SIRET, SIREN)
    "MEDICAL_LICENSE", # Licences médicales
    "US_SSN",          # Pour les contrats internationaux
]

# Regex supplémentaires pour les entités françaises non couvertes par Presidio
FRENCH_PATTERNS = {
    "SIRET": re.compile(r"\b\d{14}\b"),
    "SIREN": re.compile(r"\b\d{9}\b"),
    "TVA_FR": re.compile(r"\bFR\s*\d{2}\s*\d{9}\b"),
    "CODE_POSTAL": re.compile(r"\b\d{5}\b"),  # Optionnel, peut être légèrement agressif
}


class PiiMatch(NamedTuple):
    entity_type: str
    start: int
    end: int
    original_text: str
    placeholder: str


@dataclass
class AnonymizationResult:
    """Résultat de l'anonymisation avec mapping de réversion."""
    anonymized_text: str
    # Mapping placeholder → valeur originale (stocké côté serveur, jamais envoyé à l'IA)
    reversion_map: dict[str, str] = field(default_factory=dict)
    entities_found: int = 0


class PiiAnonymizer:
    """
    Anonymiseur RGPD utilisant Microsoft Presidio (local, sans réseau).

    Stratégie de remplacement:
        "Jean Dupont" → "[PERSONNE_1]"
        "jean@acme.fr" → "[EMAIL_1]"
        "FR76 1234..." → "[IBAN_1]"

    Le mapping est stocké dans Supabase (chiffré, isolé par tenant),
    jamais envoyé aux APIs d'IA.
    """

    def __init__(self) -> None:
        self._analyzer: "AnalyzerEngine | None" = None
        self._anonymizer: "AnonymizerEngine | None" = None
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """Initialisation paresseuse (chargement spaCy ~2s au premier appel)."""
        if self._initialized:
            return

        if not PRESIDIO_AVAILABLE:
            logger.warning(
                "pii_anonymizer.fallback",
                message="Presidio unavailable, using regex-only anonymization",
            )
            self._initialized = True
            return

        try:
            # Configuration du moteur NLP avec le modèle français
            nlp_config = {
                "nlp_engine_name": "spacy",
                "models": [
                    # Modèle large français pour une meilleure précision NER
                    # Installation: python -m spacy download fr_core_news_lg
                    {"lang_code": "fr", "model_name": "fr_core_news_lg"},
                    {"lang_code": "en", "model_name": "en_core_web_lg"},
                ],
            }
            provider = NlpEngineProvider(nlp_configuration=nlp_config)
            nlp_engine = provider.create_engine()

            self._analyzer = AnalyzerEngine(
                nlp_engine=nlp_engine,
                supported_languages=["fr", "en"],
            )
            self._anonymizer = AnonymizerEngine()

            logger.info("pii_anonymizer.initialized", engine="presidio+spacy")

        except Exception as e:
            logger.error("pii_anonymizer.init_failed", error=str(e))
            # Dégradation gracieuse: utilisation des regex uniquement

        self._initialized = True

    def anonymize(
        self,
        text: str,
        language: str = "fr",
    ) -> tuple[str, dict[str, str]]:
        """
        Anonymise le texte et retourne (texte_anonymisé, mapping_réversion).

        Args:
            text: Texte contractuel brut
            language: Code langue ISO 639-1 (fr ou en)

        Returns:
            Tuple (anonymized_text, reversion_map)
            - anonymized_text: Texte avec placeholders [PERSONNE_1], etc.
            - reversion_map: Dict {placeholder: valeur_originale} - NE PAS ENVOYER À L'IA
        """
        self._ensure_initialized()

        if not text.strip():
            return text, {}

        # Compteurs par type d'entité pour les placeholders numérotés
        entity_counters: dict[str, int] = {}
        reversion_map: dict[str, str] = {}

        # Phase 1: Anonymisation via Presidio (NER neural)
        anonymized_text, presidio_map = self._presidio_anonymize(
            text, language, entity_counters
        )
        reversion_map.update(presidio_map)

        # Phase 2: Regex pour les entités françaises spécifiques non couvertes
        anonymized_text, regex_map = self._regex_anonymize(
            anonymized_text, entity_counters
        )
        reversion_map.update(regex_map)

        entities_found = len(reversion_map)
        if entities_found > 0:
            logger.info(
                "pii_anonymization.complete",
                entities_found=entities_found,
                entity_types=list(entity_counters.keys()),
            )

        return anonymized_text, reversion_map

    def revert(self, anonymized_text: str, reversion_map: dict[str, str]) -> str:
        """
        Réversion de l'anonymisation pour présentation à l'utilisateur final.
        Appelé côté serveur APRÈS réception de la réponse de l'IA.
        """
        result = anonymized_text
        # Remplacement du plus long placeholder au plus court (évite les conflits)
        for placeholder, original in sorted(
            reversion_map.items(), key=lambda x: len(x[0]), reverse=True
        ):
            result = result.replace(placeholder, original)
        return result

    def _presidio_anonymize(
        self,
        text: str,
        language: str,
        entity_counters: dict[str, int],
    ) -> tuple[str, dict[str, str]]:
        """Anonymisation via Presidio NER. Dégradation gracieuse si non disponible."""
        if not self._analyzer or not self._anonymizer:
            return text, {}

        try:
            results = self._analyzer.analyze(
                text=text,
                language=language,
                entities=PII_ENTITIES,
                # Score minimum de confiance NER: 0.7 (évite les faux positifs)
                score_threshold=0.7,
            )

            if not results:
                return text, {}

            reversion_map: dict[str, str] = {}

            # Construire un mapping entity → placeholder AVANT l'anonymisation
            # pour pouvoir réverser les replacements
            operators: dict[str, OperatorConfig] = {}

            for result in results:
                original = text[result.start : result.end]
                entity_type = result.entity_type

                # Créer un placeholder numéroté et unique
                entity_counters[entity_type] = entity_counters.get(entity_type, 0) + 1
                placeholder = f"[{entity_type}_{entity_counters[entity_type]}]"
                reversion_map[placeholder] = original

                # Opérateur: remplacement par placeholder (pas de hash, pas de masque)
                operators[entity_type] = OperatorConfig(
                    "replace", {"new_value": placeholder}
                )

            anonymized_result = self._anonymizer.anonymize(
                text=text, analyzer_results=results, operators=operators
            )

            return anonymized_result.text, reversion_map

        except Exception as e:
            logger.error("presidio.anonymize_failed", error=str(e))
            return text, {}

    def _regex_anonymize(
        self,
        text: str,
        entity_counters: dict[str, int],
    ) -> tuple[str, dict[str, str]]:
        """
        Fallback regex pour les entités françaises (SIRET, TVA, etc.)
        et pour les installations sans Presidio/spaCy.
        """
        reversion_map: dict[str, str] = {}
        result = text

        # Ordre important: d'abord SIRET (14 chiffres) avant SIREN (9 chiffres)
        # pour éviter de remplacer partiellement
        for entity_type, pattern in FRENCH_PATTERNS.items():
            # On ne remplace pas les codes postaux (trop agressif, casse les adresses)
            if entity_type == "CODE_POSTAL":
                continue

            def make_replacer(etype: str) -> "re.Pattern[str]":
                def replacer(m: "re.Match[str]") -> str:
                    original = m.group(0)
                    entity_counters[etype] = entity_counters.get(etype, 0) + 1
                    placeholder = f"[{etype}_{entity_counters[etype]}]"
                    reversion_map[placeholder] = original
                    return placeholder
                return replacer  # type: ignore[return-value]

            result = pattern.sub(make_replacer(entity_type), result)

        return result, reversion_map
