"""
Routes API pour le suivi des analyses asynchrones.

Endpoints:
  GET  /analysis/{job_id}    → Polling du statut d'une analyse Celery
  GET  /analysis             → Liste des jobs du tenant (historique)

Séparé de contracts.py pour éviter le conflit de route FastAPI entre
  GET /contracts/{contract_id}  et  GET /contracts/analysis/{job_id}
(FastAPI matcherait "analysis" comme un contract_id UUID, ce qui est un bug.)
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.models.contract import (
    AnalysisJobStatus,
    AnalysisResult,
    AnalysisStatusResponse,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])
settings = get_settings()
logger = structlog.get_logger(__name__)


# ── Dépendances (import différé pour éviter les imports circulaires) ───────────


def get_current_tenant_id() -> uuid.UUID:
    """
    Extrait le tenant_id du JWT.
    TODO: Remplacer par `from app.api.deps import get_current_tenant_id`.
    En attendant la couche d'auth complète, retourne un UUID stub.
    """
    return uuid.uuid4()


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get(
    "/{job_id}",
    response_model=AnalysisStatusResponse,
    summary="Polling du statut d'une analyse Celery en cours",
    description="""
    Endpoint de polling pour suivre la progression d'une analyse.
    Le frontend appelle cet endpoint toutes les 2 secondes jusqu'à
    ce que status soit 'completed' ou 'failed'.

    Transitions d'état:
      pending → processing (progress 0-99%) → completed (100%)
      pending → failed (en cas d'erreur)
    """,
)
async def get_analysis_status(job_id: str) -> AnalysisStatusResponse:
    """
    Récupère l'état temps-réel d'une tâche d'analyse depuis le backend Celery.

    L'état est stocké dans Redis (backend Celery) avec un TTL de 24h.
    Après complétion, le résultat complet est disponible dans `result`.
    """
    try:
        from celery.result import AsyncResult

        from app.worker.celery_app import celery_app

        task = AsyncResult(job_id, app=celery_app)

        if task.state == "PENDING":
            return AnalysisStatusResponse(
                job_id=job_id,
                status=AnalysisJobStatus.PENDING,
                progress_pct=0,
                current_step="En attente de traitement...",
            )

        elif task.state == "PROGRESS":
            meta = task.info or {}
            return AnalysisStatusResponse(
                job_id=job_id,
                status=AnalysisJobStatus.PROCESSING,
                progress_pct=meta.get("progress", 0),
                current_step=meta.get("step", "Analyse en cours..."),
            )

        elif task.state == "SUCCESS":
            result_data = task.result

            # Désérialisation: le résultat est un dict JSON
            try:
                result = AnalysisResult.model_validate(result_data)
            except Exception as e:
                logger.error(
                    "analysis.result_deserialization_failed",
                    job_id=job_id,
                    error=str(e),
                )
                result = None

            return AnalysisStatusResponse(
                job_id=job_id,
                status=AnalysisJobStatus.COMPLETED,
                progress_pct=100,
                current_step="Analyse terminée",
                result=result,
            )

        elif task.state == "FAILURE":
            # task.info contient l'exception originale
            error_msg = str(task.info) if task.info else "Erreur inconnue"
            logger.error("analysis.task_failed", job_id=job_id, error=error_msg)

            return AnalysisStatusResponse(
                job_id=job_id,
                status=AnalysisJobStatus.FAILED,
                progress_pct=0,
                current_step="Échec de l'analyse",
                error_message=error_msg,
            )

        elif task.state == "REVOKED":
            return AnalysisStatusResponse(
                job_id=job_id,
                status=AnalysisJobStatus.FAILED,
                progress_pct=0,
                current_step="Tâche annulée",
                error_message="L'analyse a été annulée.",
            )

        # État intermédiaire (STARTED, RETRY, etc.)
        return AnalysisStatusResponse(
            job_id=job_id,
            status=AnalysisJobStatus.PROCESSING,
            progress_pct=10,
            current_step="Démarrage de l'analyse...",
        )

    except Exception as exc:
        # Redis non disponible ou autre erreur infrastructure
        logger.error(
            "analysis.polling_failed",
            job_id=job_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve analysis status. Retry shortly.",
        ) from exc


@router.get(
    "",
    summary="Liste des analyses du tenant (historique)",
)
async def list_analyses(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """
    Retourne l'historique des analyses pour le tenant courant.
    La RLS Supabase filtre automatiquement par tenant_id.

    TODO: Connecter la couche Supabase quand `db.py` est configuré.
    """
    # TODO: Fetch depuis Supabase
    # SELECT * FROM analysis_jobs WHERE tenant_id = :tenant_id
    #   ORDER BY created_at DESC LIMIT :limit OFFSET :offset
    return {
        "jobs": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
    }
