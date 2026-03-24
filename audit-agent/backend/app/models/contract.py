"""
Modèles Pydantic v2 pour l'analyse de contrats.
Strict Mode activé: aucune coercition silencieuse de types.
Dans un contexte légal, une erreur de type = une erreur métier.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ── Enums ─────────────────────────────────────────────────────────────────────

class ClauseType(StrEnum):
    PRICE_ESCALATION = "PRICE_ESCALATION"     # Hausse de prix / indexation
    AUTO_RENEWAL = "AUTO_RENEWAL"              # Renouvellement tacite
    TERMINATION_PENALTY = "TERMINATION_PENALTY"  # Pénalités de résiliation
    NOTICE_PERIOD = "NOTICE_PERIOD"            # Délai de préavis
    PAYMENT_TERMS = "PAYMENT_TERMS"            # Conditions de paiement
    DATA_PROCESSING = "DATA_PROCESSING"        # Traitement des données
    LIABILITY_CAP = "LIABILITY_CAP"            # Plafond de responsabilité
    FORCE_MAJEURE = "FORCE_MAJEURE"            # Clause de force majeure
    EXCLUSIVITY = "EXCLUSIVITY"               # Clause d'exclusivité
    OTHER = "OTHER"


class RiskLevel(StrEnum):
    LOW = "LOW"         # 0-30: Favorable
    MEDIUM = "MEDIUM"   # 31-60: Attention
    HIGH = "HIGH"       # 61-85: Risque élevé
    CRITICAL = "CRITICAL"  # 86-100: Alerte immédiate


class ActionRequired(StrEnum):
    OK = "OK"
    ATTENTION = "ATTENTION"   # Délai > 90 jours
    WARNING = "WARNING"       # Délai 8-30 jours
    CRITICAL = "CRITICAL"     # Délai <= 7 jours
    EXPIRED = "EXPIRED"       # Délai déjà passé


class ContractType(StrEnum):
    SERVICE = "SERVICE"
    LEASE = "LEASE"               # Bail
    SUPPLY = "SUPPLY"             # Fourniture
    MAINTENANCE = "MAINTENANCE"
    SUBSCRIPTION = "SUBSCRIPTION"
    NDA = "NDA"
    PARTNERSHIP = "PARTNERSHIP"
    OTHER = "OTHER"


class SourceConfidence(StrEnum):
    HIGH = "high"     # Citation exacte trouvée, page + § identifiés
    MEDIUM = "medium" # Citation approchée
    LOW = "low"       # Inférence sans citation directe → human review requis


# ── Sous-modèles ──────────────────────────────────────────────────────────────

class StrictModel(BaseModel):
    """Base class: strict mode sur tous les modèles dérivés."""
    model_config = ConfigDict(strict=True, frozen=True)


class ClauseSource(StrictModel):
    """Preuve vérifiable de l'extraction: page + paragraphe + citation."""
    page: Annotated[int, Field(ge=1, description="Numéro de page (commence à 1)")]
    paragraph: str | None = Field(
        default=None,
        description="Référence du paragraphe (ex: §12.3.b)",
        pattern=r"^[§\d\.\w\s\-()]*$",
    )
    verbatim_quote: Annotated[
        str,
        Field(
            min_length=10,
            max_length=500,
            description="Citation textuelle exacte du contrat (20-500 chars)",
        )
    ]
    confidence: Annotated[
        float,
        Field(ge=0.0, le=1.0, description="Score de confiance de l'extraction IA")
    ]
    source_confidence: SourceConfidence = SourceConfidence.HIGH


class NoticeDeadline(StrictModel):
    """Résultat du calcul mathématique de préavis."""
    period_months: Annotated[int, Field(ge=0, le=36)]
    deadline_date: date | None = Field(
        description="Date limite pour envoyer la résiliation"
    )
    anniversary_date: date = Field(
        description="Date d'anniversaire / renouvellement du contrat"
    )
    days_until_deadline: int | None = Field(
        description="Nombre de jours jusqu'à la deadline (négatif si passé)"
    )
    action_required: ActionRequired
    calendar_alert_suggested: bool = True


class FinancialImpact(StrictModel):
    """Impact financier calculé et annualisé."""
    annualized_amount_eur: Annotated[
        float,
        Field(ge=0, description="Montant annuel en euros")
    ] | None = None

    # Pour les clauses d'indexation de prix
    escalation_rate_min_pct: float | None = Field(
        default=None,
        description="Taux de hausse minimal (ex: 3.0 pour 3%)"
    )
    escalation_rate_max_pct: float | None = None

    # Simulation: coût à 3 ans si la clause s'applique
    worst_case_year_3_eur: float | None = None

    # Pour les clauses de résiliation
    termination_penalty_eur: float | None = None
    lock_in_months: int | None = None


class DocumentMetadata(StrictModel):
    filename: str = Field(min_length=1, max_length=255)
    page_count: Annotated[int, Field(ge=1)]
    detected_language: str = Field(default="fr", pattern=r"^[a-z]{2}$")
    contract_type: ContractType
    parties: dict[str, str] = Field(
        description="Parties du contrat, valeurs anonymisées si PII présentes"
    )


class FinancialSummary(StrictModel):
    """Résumé financier global du contrat."""
    annual_amount_eur: float | None = None
    monthly_amount_eur: float | None = None
    price_escalation_risk_pct: float | None = Field(
        default=None,
        description="Risque de hausse annuelle en %",
        ge=0,
        le=1000,
    )
    total_penalty_exposure_eur: float | None = Field(
        default=None,
        description="Exposition maximale aux pénalités de résiliation",
    )


class ProcessingMetadata(StrictModel):
    """Métriques de traitement pour le monitoring des coûts IA."""
    model_used: str
    total_input_tokens: Annotated[int, Field(ge=0)]
    total_output_tokens: Annotated[int, Field(ge=0)]
    estimated_cost_usd: Annotated[float, Field(ge=0)]
    processing_time_seconds: Annotated[float, Field(ge=0)]
    chunks_processed: Annotated[int, Field(ge=1)]
    validation_retries: Annotated[int, Field(ge=0)]
    pii_entities_redacted: int = 0


# ── Modèle principal ──────────────────────────────────────────────────────────

class ContractClause(StrictModel):
    """
    Représente une clause contractuelle extraite et analysée.
    Chaque clause doit avoir une source vérifiable (page + citation).
    """
    clause_id: UUID = Field(default_factory=uuid4)
    type: ClauseType
    title: Annotated[str, Field(min_length=3, max_length=200)]
    extracted_text: Annotated[str, Field(min_length=10, max_length=2000)]

    # Preuve vérifiable OBLIGATOIRE
    source: ClauseSource

    # Scores de risque
    risk_score: Annotated[int, Field(ge=0, le=100)]
    risk_level: RiskLevel

    financial_impact: FinancialImpact | None = None
    notice: NoticeDeadline | None = None

    # Si True: l'IA n'était pas suffisamment confiante → revue humaine
    requires_human_review: bool = False
    ai_recommendation: str | None = Field(
        default=None,
        max_length=500,
        description="Recommandation actionnable de l'IA"
    )

    @model_validator(mode="after")
    def validate_human_review_for_low_confidence(self) -> "ContractClause":
        """
        Règle métier: une source de faible confiance DOIT déclencher
        une revue humaine. Protège contre les hallucinations silencieuses.
        """
        if self.source.source_confidence == SourceConfidence.LOW:
            # Pydantic frozen=True → on ne peut pas modifier, on valide seulement
            if not self.requires_human_review:
                raise ValueError(
                    f"Clause '{self.title}': source_confidence='low' requires "
                    "requires_human_review=True. The AI must not silently "
                    "produce low-confidence extractions."
                )
        return self

    @field_validator("risk_level", mode="before")
    @classmethod
    def derive_risk_level_from_score(cls, v: str, info: object) -> str:
        """Si risk_level n'est pas fourni, le dériver du risk_score."""
        return v  # Le modèle IA devrait le fournir; validation croisée ci-dessous

    @model_validator(mode="after")
    def validate_risk_score_level_consistency(self) -> "ContractClause":
        """
        Garantit la cohérence entre risk_score et risk_level.
        Évite qu'une IA retourne score=95 et level="LOW" par erreur.
        """
        score = self.risk_score
        expected = (
            RiskLevel.LOW if score <= 30
            else RiskLevel.MEDIUM if score <= 60
            else RiskLevel.HIGH if score <= 85
            else RiskLevel.CRITICAL
        )
        if self.risk_level != expected:
            raise ValueError(
                f"risk_score={score} is inconsistent with risk_level='{self.risk_level}'. "
                f"Expected '{expected}' for this score range."
            )
        return self


class AnalysisResult(BaseModel):
    """
    Résultat complet d'une analyse de contrat.
    Non-frozen: peut être enrichi progressivement (streaming updates).
    """
    model_config = ConfigDict(strict=True)

    contract_id: UUID = Field(default_factory=uuid4)
    tenant_id: UUID = Field(description="Isolation RGPD par client")
    analysis_version: str = "2.1.0"
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    document: DocumentMetadata
    financial_summary: FinancialSummary
    clauses: list[ContractClause] = Field(default_factory=list)

    global_risk_score: Annotated[float, Field(ge=0, le=100)]
    risk_level: RiskLevel

    processing_metadata: ProcessingMetadata

    @field_validator("global_risk_score", mode="after")
    @classmethod
    def validate_global_score(cls, v: float) -> float:
        return round(v, 2)

    @property
    def critical_clauses(self) -> list[ContractClause]:
        """Clauses nécessitant une action immédiate."""
        return [c for c in self.clauses if c.risk_level == RiskLevel.CRITICAL]

    @property
    def upcoming_deadlines(self) -> list[ContractClause]:
        """Clauses avec préavis dans les 90 prochains jours."""
        return [
            c for c in self.clauses
            if c.notice and c.notice.days_until_deadline is not None
            and 0 <= c.notice.days_until_deadline <= 90
        ]


# ── Schémas de requête/réponse API ────────────────────────────────────────────

class AnalysisJobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REQUIRES_REVIEW = "requires_review"


class AnalysisJobResponse(BaseModel):
    """Réponse immédiate lors du démarrage d'une analyse asynchrone."""
    model_config = ConfigDict(strict=False)  # Souple pour la sérialisation

    job_id: str
    contract_id: UUID
    status: AnalysisJobStatus
    estimated_completion_seconds: int = 60
    polling_url: str


class AnalysisStatusResponse(BaseModel):
    """Réponse de polling pour suivre la progression d'une analyse."""
    model_config = ConfigDict(strict=False)

    job_id: str
    status: AnalysisJobStatus
    progress_pct: Annotated[int, Field(ge=0, le=100)] = 0
    current_step: str = ""
    result: AnalysisResult | None = None
    error_message: str | None = None
