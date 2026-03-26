"""
Modèles de domaine pour le moteur de résiliation Unsubscribe.ai.

Principe: chaque résiliation DOIT citer une base légale vérifiable.
Sans base légale → le fournisseur peut ignorer la demande ou facturer des pénalités.

Architecture Hexagonale:
  /domain    → Règles métier pures, sans dépendance infra
  /services  → Orchestration, appels IA/APIs
  /api       → Couche transport HTTP
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class LegalBasis(StrEnum):
    """
    Base légale applicable à la résiliation.
    Chaque résiliation DOIT en avoir une — jamais null.

    Mapping:
    - LOI_CHATEL           → Loi n°2005-67 du 28/01/2005 (engagements min 1 an)
    - LOI_CHATEL_TELECOM   → Art. L.215-3 Code Conso (opérateurs télécom)
    - CODE_CONSOMMATION    → L.215-1 et L.215-3 (contrats consommateurs)
    - LOI_HAMON            → Loi n°2014-344 du 17/03/2014 (assurances 1 an)
    - LOI_RESILIATION_RIA  → Loi n°2022-1158 (résiliation infra-annuelle assurance)
    - CODE_CIVIL           → Art. 1210 (prohibition des engagements perpétuels)
    - CODE_COMMERCE        → Pour les contrats B2B hors Code Conso
    - CONVENTION_PARTI     → Clause contractuelle explicite (ex: art. 12 du contrat)
    - FORCE_MAJEURE        → Art. 1218 Code Civil (événement imprévisible, irrésistible)
    - INEXECUTION_GRAVE    → Art. 1224 Code Civil (résolution pour faute du prestataire)
    """
    LOI_CHATEL = "LOI_CHATEL"
    LOI_CHATEL_TELECOM = "LOI_CHATEL_TELECOM"
    CODE_CONSOMMATION = "CODE_CONSOMMATION"
    LOI_HAMON = "LOI_HAMON"
    LOI_RESILIATION_RIA = "LOI_RESILIATION_RIA"
    CODE_CIVIL = "CODE_CIVIL"
    CODE_COMMERCE = "CODE_COMMERCE"
    CONVENTION_PARTI = "CONVENTION_PARTI"
    FORCE_MAJEURE = "FORCE_MAJEURE"
    INEXECUTION_GRAVE = "INEXECUTION_GRAVE"


LEGAL_BASIS_ARTICLES: dict[LegalBasis, str] = {
    LegalBasis.LOI_CHATEL: "Loi n°2005-67 du 28 janvier 2005 — Article L.136-1 du Code de la Consommation",
    LegalBasis.LOI_CHATEL_TELECOM: "Article L.215-3 du Code de la Consommation (opérateurs de communications électroniques)",
    LegalBasis.CODE_CONSOMMATION: "Articles L.215-1 à L.215-4 du Code de la Consommation (reconduction tacite)",
    LegalBasis.LOI_HAMON: "Loi n°2014-344 du 17 mars 2014 — Article L.113-15-2 du Code des Assurances",
    LegalBasis.LOI_RESILIATION_RIA: "Loi n°2022-1158 du 16 août 2022 — Résiliation infra-annuelle (assurance)",
    LegalBasis.CODE_CIVIL: "Article 1210 du Code Civil (prohibition des engagements perpétuels)",
    LegalBasis.CODE_COMMERCE: "Articles L.442-6 et suivants du Code de Commerce (déséquilibre significatif)",
    LegalBasis.CONVENTION_PARTI: "Clause contractuelle — voir article de résiliation du contrat",
    LegalBasis.FORCE_MAJEURE: "Article 1218 du Code Civil (force majeure)",
    LegalBasis.INEXECUTION_GRAVE: "Article 1224 du Code Civil (résolution pour inexécution)",
}


class WorkflowStatus(StrEnum):
    DRAFT = "DRAFT"                       # Plan calculé, lettre non envoyée
    LETTER_GENERATED = "LETTER_GENERATED" # Lettre PDF générée
    LRE_SENT = "LRE_SENT"                 # LRE envoyée (AR24/Maileva)
    LRE_ACKNOWLEDGED = "LRE_ACKNOWLEDGED" # Accusé de réception LRE
    ESIGN_PENDING = "ESIGN_PENDING"       # Signature électronique en attente
    TERMINATED = "TERMINATED"            # Résiliation effective
    FAILED = "FAILED"                     # Échec (fournisseur a refusé)
    LITIGATED = "LITIGATED"              # Contentieux en cours


class UrgencyLevel(StrEnum):
    OK = "OK"                 # > 90 jours
    ATTENTION = "ATTENTION"   # 31-90 jours
    WARNING = "WARNING"       # 8-30 jours
    CRITICAL = "CRITICAL"     # ≤ 7 jours
    EXPIRED = "EXPIRED"       # Deadline passée → cycle suivant


class StepActionType(StrEnum):
    PREPARE_DOC = "PREPARE_DOC"
    SIGN_DOCUMENT = "SIGN_DOCUMENT"
    SEND_LRE = "SEND_LRE"
    SEND_EMAIL = "SEND_EMAIL"
    VERIFY_RECEIPT = "VERIFY_RECEIPT"
    NEGOTIATE = "NEGOTIATE"
    WAIT = "WAIT"


# ─────────────────────────────────────────────────────────────────────────────
# Sous-modèles immuables (frozen=True → thread-safe, hashable)
# ─────────────────────────────────────────────────────────────────────────────

class _StrictFrozen(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)


class EarlyTerminationFee(_StrictFrozen):
    """
    Frais de résiliation anticipée (ETF = Early Termination Fee).
    Extrait et validé par l'IA avec citation de clause obligatoire.
    """
    amount_eur: Annotated[float, Field(ge=0, description="Montant en euros")]
    calculation_basis: str = Field(
        description="Comment le montant a été calculé (ex: '3 mois de redevance résiduelle')",
        max_length=500,
    )
    verbatim_clause: str = Field(
        description="Citation textuelle exacte de la clause pénale",
        min_length=10,
        max_length=1000,
    )
    is_legally_enforceable: bool = Field(
        description="L'IA évalue si la clause est conforme au droit (clause abusive?)"
    )
    legal_challenge_basis: str | None = Field(
        default=None,
        description="Si contestable: base légale (ex: Art. L.132-1 Code Conso — clause abusive)",
        max_length=300,
    )


class DegressiveNotice(_StrictFrozen):
    """
    Préavis dégressif: la durée du préavis diminue avec l'ancienneté du contrat.

    Exemple réel (télécom B2B):
        Année 1 du contrat → préavis 3 mois
        Années 2 et suivantes → préavis 1 mois

    La logique de décision: on calcule le nombre d'années écoulées depuis
    la signature pour déterminer quel préavis s'applique AUJOURD'HUI.
    """
    year_1_months: Annotated[int, Field(ge=0, le=36, description="Préavis en année 1")]
    year_2_plus_months: Annotated[int, Field(ge=0, le=36, description="Préavis années 2+")]
    verbatim_clause: str = Field(
        description="Citation de la clause de préavis dégressif",
        min_length=10,
        max_length=500,
    )


class ContractParties(_StrictFrozen):
    """Parties identifiées dans le contrat (post-anonymisation RGPD)."""
    supplier_name: str = Field(max_length=200)
    supplier_siret: str | None = Field(default=None, pattern=r"^\d{14}$")
    customer_contract_id: str | None = Field(
        default=None,
        max_length=100,
        description="N° client chez le fournisseur (indispensable pour la lettre)",
    )


class LREProof(_StrictFrozen):
    """Preuve de dépôt immuable pour une LRE envoyée."""
    lre_id: str = Field(description="ID unique AR24/Maileva")
    provider: Literal["AR24", "MAILEVA"]
    sent_at: datetime
    tracking_url: str | None = None
    acknowledgment_received_at: datetime | None = None
    # Hash SHA-256 de la lettre envoyée (intégrité documentaire)
    document_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class TerminationStep(_StrictFrozen):
    """Une étape actionnable du plan de résiliation."""
    step_number: Annotated[int, Field(ge=1)]
    title: str = Field(max_length=150)
    description: str = Field(max_length=500)
    due_date: date | None
    action_type: StepActionType
    is_critical: bool = False
    estimated_duration_minutes: int | None = None


# ─────────────────────────────────────────────────────────────────────────────
# AIExtractionResult: output IA avec base légale obligatoire
# ─────────────────────────────────────────────────────────────────────────────

class AIExtractionResult(BaseModel):
    """
    Résultat de l'extraction IA d'un contrat pour la résiliation.
    Schéma strict: chaque champ manquant = erreur de validation → retry IA.

    CONTRAINTE ABSOLUE: legal_basis + legal_article_cited ne peuvent PAS être null.
    Sans base légale identifiée, l'IA doit retourner CODE_CIVIL (droit commun).
    """
    model_config = ConfigDict(strict=False)  # Souple pour déserialisation JSON IA

    # ── Identité du contrat ───────────────────────────────────────────────────
    contract_name: str = Field(min_length=2, max_length=200)
    parties: ContractParties

    # ── Temporalité contractuelle ─────────────────────────────────────────────
    signature_date: date = Field(description="Date de signature du contrat")
    duration_months: Annotated[int, Field(ge=1, le=1200, description="Durée en mois")]
    renewal_type: Literal["auto", "manual", "none"] = Field(
        description="auto=reconduction tacite, manual=renouvellement actif, none=CDD ferme"
    )

    # ── Préavis (simple ou dégressif) ─────────────────────────────────────────
    notice_period_months: Annotated[int, Field(ge=0, le=36)]
    degressive_notice: DegressiveNotice | None = None

    # ── Finance ───────────────────────────────────────────────────────────────
    annual_amount_eur: float | None = Field(
        default=None, ge=0, description="Montant annuel HT"
    )
    early_termination_fee: EarlyTerminationFee | None = None

    # ── BASE LÉGALE OBLIGATOIRE ───────────────────────────────────────────────
    legal_basis: LegalBasis = Field(
        description=(
            "Fondement juridique de la résiliation. "
            "OBLIGATOIRE — utiliser CODE_CIVIL si aucun autre ne s'applique."
        )
    )
    legal_article_cited: str = Field(
        min_length=5,
        max_length=300,
        description="Article de loi ou clause contractuelle citée verbatim (ex: 'Article L.215-1 Code Conso')",
    )

    # ── Preuve d'extraction (vérifiabilité) ───────────────────────────────────
    notice_clause_page: Annotated[int, Field(ge=1)]
    notice_clause_verbatim: str = Field(
        min_length=10,
        max_length=800,
        description="Citation textuelle exacte de la clause de préavis",
    )
    extraction_confidence: Annotated[
        float, Field(ge=0.0, le=1.0, description="Score de confiance IA (0→1)")
    ]

    @model_validator(mode="after")
    def validate_degressive_coherence(self) -> "AIExtractionResult":
        """
        Si préavis dégressif: le notice_period_months doit être le max
        (année 1) pour que les calculs initiaux soient conservatifs.
        """
        if self.degressive_notice:
            max_notice = max(
                self.degressive_notice.year_1_months,
                self.degressive_notice.year_2_plus_months,
            )
            if self.notice_period_months < max_notice:
                raise ValueError(
                    f"notice_period_months ({self.notice_period_months}) < "
                    f"degressive max ({max_notice}). Set notice_period_months "
                    "to the year-1 (maximum) notice for conservative computation."
                )
        return self

    @field_validator("legal_article_cited")
    @classmethod
    def legal_article_must_not_be_placeholder(cls, v: str) -> str:
        placeholders = {"N/A", "n/a", "null", "none", "unknown", "à déterminer"}
        if v.lower().strip() in placeholders:
            raise ValueError(
                "legal_article_cited cannot be a placeholder. "
                "The AI MUST cite an actual article or contractual clause."
            )
        return v


# ─────────────────────────────────────────────────────────────────────────────
# TerminationPlan: output du TerminationEngine
# ─────────────────────────────────────────────────────────────────────────────

class TerminationPlan(BaseModel):
    """
    Plan de résiliation complet calculé par le TerminationEngine.
    Combine: dates calculées + base légale + étapes actionnables + finance.

    Ce modèle est la source de vérité pour:
    - L'affichage frontend (TerminationTimeline)
    - La génération de la lettre (TerminationLetterGenerator)
    - Les triggers LRE (LREService)
    - La facturation Stripe (StripeMeteringService)
    """
    model_config = ConfigDict(strict=False)

    plan_id: UUID = Field(default_factory=uuid4)
    contract_id: UUID
    tenant_id: UUID
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # ── Source ────────────────────────────────────────────────────────────────
    extraction: AIExtractionResult

    # ── Dates calculées (notice_calculator.py) ────────────────────────────────
    notice_deadline: date | None = Field(
        description="Date limite pour envoyer la résiliation (None si contrat CDD)"
    )
    anniversary_date: date = Field(description="Prochaine date de renouvellement")
    days_until_deadline: int | None
    urgency_level: UrgencyLevel

    # Préavis effectif appliqué (peut différer si dégressif)
    applied_notice_months: int = Field(
        description="Préavis réellement appliqué après résolution dégressive"
    )

    # ── Finance ───────────────────────────────────────────────────────────────
    estimated_annual_savings_eur: float | None = Field(
        description="Économies annuelles si résiliation réussie"
    )
    locked_amount_if_missed_eur: float | None = Field(
        description="Montant bloqué si la deadline est ratée (coût de l'inaction)"
    )
    early_termination_fee_eur: float | None = Field(
        description="Pénalités de résiliation anticipée (si hors fenêtre)"
    )

    # ── Légal ─────────────────────────────────────────────────────────────────
    legal_basis: LegalBasis
    legal_article: str = Field(description="Article complet à citer dans la lettre")
    is_within_legal_window: bool = Field(
        description="True si on est dans la fenêtre légale de résiliation sans frais"
    )

    # ── Étapes actionnables ───────────────────────────────────────────────────
    steps: list[TerminationStep] = Field(default_factory=list)

    # ── Lettre générée ────────────────────────────────────────────────────────
    termination_letter_html: str | None = None
    termination_letter_pdf_s3_key: str | None = None

    # ── État du workflow ──────────────────────────────────────────────────────
    workflow_status: WorkflowStatus = WorkflowStatus.DRAFT
    lre_proof: LREProof | None = None

    @property
    def is_urgent(self) -> bool:
        return self.urgency_level in (UrgencyLevel.CRITICAL, UrgencyLevel.WARNING)

    @property
    def can_terminate_without_fees(self) -> bool:
        """True si résiliation dans la fenêtre légale → pas de pénalités."""
        return self.is_within_legal_window and self.early_termination_fee_eur is None

    @property
    def roi_label(self) -> str:
        """Label humain pour l'affichage dashboard."""
        if not self.estimated_annual_savings_eur:
            return "Économies à calculer"
        return f"{self.estimated_annual_savings_eur:,.0f} €/an économisés"
