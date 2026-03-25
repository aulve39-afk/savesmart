"""
Routes API pour la gestion des contrats et le déclenchement des analyses.

Endpoints:
  POST /contracts/upload    → Upload PDF + démarrage analyse asynchrone
  GET  /contracts/{id}      → Récupération du résultat d'analyse
  GET  /contracts           → Liste des contrats du tenant
  GET  /analysis/{job_id}   → Polling du statut d'une analyse en cours
"""

from __future__ import annotations

import io
import uuid
from typing import Annotated, Any

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

import structlog

from app.core.config import get_settings
from app.models.contract import (
    AnalysisJobResponse,
    AnalysisJobStatus,
)
from app.worker.tasks import run_contract_analysis

router = APIRouter(prefix="/contracts", tags=["contracts"])
settings = get_settings()
logger = structlog.get_logger(__name__)


# ── Dépendances ───────────────────────────────────────────────────────────────


def get_current_tenant_id() -> uuid.UUID:
    """
    Extrait le tenant_id du JWT (injecté par le middleware d'auth).
    Dev: UUID fixe pour permettre la récupération des résultats entre requêtes.
    Production: remplacer par la vraie extraction JWT (cf. app.api.deps).
    """
    # UUID déterministe pour le dev local (même tenant toujours)
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_s3_client() -> Any:
    """Factory S3 avec credentials de la config."""
    return boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID.get_secret_value(),
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY.get_secret_value(),
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post(
    "/upload",
    response_model=AnalysisJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload un contrat PDF et démarre l'analyse asynchrone",
)
async def upload_contract(
    file: Annotated[UploadFile, File(description="Contrat PDF (max 50 MB)")],
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    s3: Any = Depends(get_s3_client),
) -> AnalysisJobResponse:
    """
    Workflow:
    1. Validation du fichier (type MIME, taille)
    2. Upload S3 chiffré sous /{tenant_id}/{contract_id}/original.pdf
    3. Démarrage d'une tâche Celery asynchrone
    4. Retour immédiat avec job_id pour le polling
    """
    log = logger.bind(tenant_id=str(tenant_id), filename=file.filename)

    # ── Validation ────────────────────────────────────────────────────────────
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Only PDF files are accepted. Got: {file.content_type}",
        )

    content = await file.read()
    file_size = len(content)

    if file_size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {file_size / 1024 / 1024:.1f} MB exceeds "
            f"maximum {settings.MAX_UPLOAD_SIZE_MB} MB",
        )

    if file_size < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File appears to be empty or corrupted",
        )

    # Vérification magic bytes: PDF commence par %PDF
    if not content[:4] == b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid PDF (invalid magic bytes)",
        )

    # ── Génération des IDs ────────────────────────────────────────────────────
    contract_id = uuid.uuid4()
    s3_key = f"{tenant_id}/{contract_id}/original.pdf"

    # ── Upload S3 (chiffré SSE-S3) ────────────────────────────────────────────
    try:
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=io.BytesIO(content),
            ContentType="application/pdf",
            # Chiffrement côté serveur AWS (AES-256)
            ServerSideEncryption="AES256",
            # Métadonnées non-sensibles pour l'audit trail
            Metadata={
                "tenant-id": str(tenant_id),
                "contract-id": str(contract_id),
                "original-filename": file.filename or "unknown.pdf",
                "upload-timestamp": __import__("datetime")
                .datetime.utcnow()
                .isoformat(),
            },
        )
        log.info("s3_upload.success", key=s3_key, size_bytes=file_size)
    except ClientError as e:
        log.error("s3_upload.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to store contract. Please retry.",
        ) from e

    # ── Démarrage de l'analyse asynchrone (Celery) ────────────────────────────
    job = run_contract_analysis.apply_async(
        kwargs={
            "contract_id": str(contract_id),
            "tenant_id": str(tenant_id),
            "s3_key": s3_key,
            "filename": file.filename,
        },
        # Priorité haute si contrat petit (<5 pages estimées)
        priority=9 if file_size < 50_000 else 5,
    )

    log.info(
        "analysis_job.started",
        job_id=job.id,
        contract_id=str(contract_id),
        file_size_kb=file_size // 1024,
    )

    return AnalysisJobResponse(
        job_id=job.id,
        contract_id=contract_id,
        status=AnalysisJobStatus.PENDING,
        estimated_completion_seconds=60,
        polling_url=f"{settings.API_PREFIX}/analysis/{job.id}",
    )


@router.get(
    "/{contract_id}",
    response_model=AnalysisResult,
    summary="Récupère le résultat d'analyse d'un contrat",
)
async def get_contract_analysis(
    contract_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
) -> AnalysisResult:
    """
    Récupère le résultat complet d'une analyse depuis Supabase.
    La Row Level Security de Supabase garantit l'isolation par tenant.
    """
    # TODO: Fetch depuis Supabase avec RLS
    # result = await supabase_client.table("analysis_results")
    #     .select("*")
    #     .eq("contract_id", str(contract_id))
    #     .eq("tenant_id", str(tenant_id))
    #     .single()
    #     .execute()

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Storage layer not yet connected",
    )


@router.get(
    "",
    summary="Liste les contrats analysés du tenant",
)
async def list_contracts(
    tenant_id: uuid.UUID = Depends(get_current_tenant_id),
    limit: int = 20,
    offset: int = 0,
) -> JSONResponse:
    """Pagination server-side. La RLS Supabase filtre automatiquement par tenant."""
    # TODO: Implémenter la liste paginée depuis Supabase
    return JSONResponse(
        content={"contracts": [], "total": 0, "limit": limit, "offset": offset}
    )


# NOTE: L'endpoint de polling /analysis/{job_id} est dans analysis.py
# (séparé pour éviter le conflit de route FastAPI avec /{contract_id})
