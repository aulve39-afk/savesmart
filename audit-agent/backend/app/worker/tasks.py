"""
Tâches Celery asynchrones pour l'analyse de contrats.
Ces tâches s'exécutent dans des workers séparés du serveur API.
"""
from __future__ import annotations

import asyncio
import uuid

import boto3
import structlog
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from app.core.config import get_settings
from app.services.contract_analyzer import ContractAnalyzer
from app.worker.celery_app import celery_app

logger = structlog.get_logger(__name__)
settings = get_settings()


class AnalysisTask(Task):
    """Base class avec initialisation paresseuse du ContractAnalyzer."""

    _analyzer: ContractAnalyzer | None = None

    @property
    def analyzer(self) -> ContractAnalyzer:
        if self._analyzer is None:
            self._analyzer = ContractAnalyzer()
        return self._analyzer


@celery_app.task(
    bind=True,
    base=AnalysisTask,
    name="tasks.run_contract_analysis",
    max_retries=3,
    default_retry_delay=10,
    acks_late=True,  # ACK après succès (pas perte de tâche si worker crash)
)
def run_contract_analysis(
    self: AnalysisTask,
    contract_id: str,
    tenant_id: str,
    s3_key: str,
    filename: str,
) -> dict:
    """
    Tâche principale: télécharge le PDF depuis S3 et lance l'analyse IA.

    Progress updates via self.update_state() → polling GET /analysis/{job_id}
    """
    log = logger.bind(task_id=self.request.id, contract_id=contract_id)

    try:
        # ── Progress: 5% ────────────────────────────────────────────────────
        self.update_state(state="PROGRESS", meta={"progress": 5, "step": "Téléchargement..."})
        log.info("task.started")

        # ── Téléchargement du PDF depuis S3 ──────────────────────────────────
        s3 = boto3.client(
            "s3",
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID.get_secret_value(),
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY.get_secret_value(),
        )

        s3_response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        pdf_bytes = s3_response["Body"].read()

        # ── Callback de progression ──────────────────────────────────────────
        def on_progress(pct: int, step: str) -> None:
            self.update_state(state="PROGRESS", meta={"progress": pct, "step": step})

        # ── Lancement de l'analyse IA ─────────────────────────────────────────
        # asyncio.run() car ContractAnalyzer est async mais Celery est sync
        result = asyncio.run(
            self.analyzer.analyze(
                pdf_bytes=pdf_bytes,
                filename=filename or "contract.pdf",
                tenant_id=uuid.UUID(tenant_id),
                on_progress=on_progress,
            )
        )

        # ── Sérialisation du résultat ─────────────────────────────────────────
        result_dict = result.model_dump(mode="json")

        # TODO: Persistance dans Supabase
        # await supabase.table("analysis_results").insert(result_dict).execute()

        log.info(
            "task.completed",
            clauses=len(result.clauses),
            cost_usd=result.processing_metadata.estimated_cost_usd,
        )

        return result_dict

    except SoftTimeLimitExceeded:
        log.error("task.soft_timeout_exceeded")
        raise

    except Exception as exc:
        log.error("task.failed", error=str(exc), exc_info=True)
        # Retry avec backoff exponentiel
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 5)
