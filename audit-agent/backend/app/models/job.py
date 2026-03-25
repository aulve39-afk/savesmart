"""
Modèles Pydantic pour les jobs d'analyse Celery.

Un AnalysisJob représente l'état d'une tâche d'analyse asynchrone:
  PENDING → PROCESSING → COMPLETED | FAILED | REQUIRES_REVIEW

Ces modèles sont distincts des modèles de contrat (contract.py) car ils
représentent l'état de traitement, pas les données métier.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


# ── Énumérations ──────────────────────────────────────────────────────────────


class JobStatus(str):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REQUIRES_REVIEW = "requires_review"


# ── Modèles ───────────────────────────────────────────────────────────────────


class AnalysisJob(BaseModel):
    """
    État complet d'un job d'analyse.

    Stocké dans Redis (via Celery backend) pendant la durée du traitement,
    puis persisté dans Supabase à la complétion.
    """

    model_config = ConfigDict(strict=False)

    job_id: str = Field(description="ID Celery de la tâche")
    contract_id: UUID = Field(default_factory=uuid4)
    tenant_id: UUID = Field(description="Isolation RGPD")

    # Fichier source
    s3_key: str = Field(description="Clé S3 du PDF original")
    filename: str = Field(default="contract.pdf")
    file_size_bytes: int = Field(default=0, ge=0)

    # État du traitement
    status: str = Field(default="pending")
    progress_pct: int = Field(default=0, ge=0, le=100)
    current_step: str = Field(default="En attente...")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None

    # Résultat ou erreur
    result_contract_id: UUID | None = Field(
        default=None,
        description="contract_id de l'AnalysisResult une fois le job complété",
    )
    error_message: str | None = None
    error_detail: dict[str, Any] | None = None

    # Métriques de traitement (remplies à la complétion)
    processing_time_seconds: float | None = None
    estimated_cost_usd: float | None = None

    @property
    def is_terminal(self) -> bool:
        """True si le job est dans un état final (ne changera plus)."""
        return self.status in ("completed", "failed", "requires_review")

    @property
    def is_successful(self) -> bool:
        return self.status in ("completed", "requires_review")

    def mark_started(self) -> None:
        self.status = "processing"
        self.started_at = datetime.now(timezone.utc)

    def mark_progress(self, pct: int, step: str) -> None:
        self.progress_pct = max(0, min(100, pct))
        self.current_step = step

    def mark_completed(
        self,
        result_contract_id: UUID,
        cost_usd: float | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        self.status = "completed"
        self.progress_pct = 100
        self.current_step = "Analyse terminée"
        self.completed_at = now
        self.result_contract_id = result_contract_id
        self.estimated_cost_usd = cost_usd
        if self.started_at:
            self.processing_time_seconds = (now - self.started_at).total_seconds()

    def mark_failed(self, error: str, detail: dict[str, Any] | None = None) -> None:
        self.status = "failed"
        self.current_step = "Échec de l'analyse"
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = error
        self.error_detail = detail

    def mark_requires_review(self, result_contract_id: UUID) -> None:
        """Job complété mais avec des clauses nécessitant une revue humaine."""
        self.mark_completed(result_contract_id)
        self.status = "requires_review"
        self.current_step = "Analyse terminée — revue humaine requise"


class JobProgressUpdate(BaseModel):
    """
    Message de progression envoyé via Celery update_state().
    Structure attendue par le frontend lors du polling.
    """

    model_config = ConfigDict(strict=False)

    progress: int = Field(ge=0, le=100)
    step: str
    job_id: str | None = None


class CreateJobRequest(BaseModel):
    """
    Payload interne pour créer un nouveau job (après upload S3 réussi).
    Utilisé dans contracts.py avant d'appeler Celery.
    """

    model_config = ConfigDict(strict=False)

    contract_id: UUID
    tenant_id: UUID
    s3_key: str
    filename: str
    file_size_bytes: int
