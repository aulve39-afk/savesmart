"""
Routes API pour le workflow de résiliation Unsubscribe.ai.

Endpoints:
  POST /termination/compute          → Calcule le plan depuis une extraction IA
  GET  /termination/{plan_id}        → Récupère un plan existant
  POST /termination/{plan_id}/letter → Génère la lettre de résiliation
  POST /termination/{plan_id}/lre    → Déclenche l'envoi LRE
  GET  /termination/{plan_id}/status → Statut du workflow
  GET  /termination/{plan_id}/audit  → Historique d'audit complet
  GET  /termination/dashboard/summary → Résumé savings pour le dashboard
  POST /webhooks/stripe              → Webhook Stripe (confirmations paiement)
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.domain.termination_plan import (
    AIExtractionResult,
    LREProof,
    TerminationPlan,
    WorkflowStatus,
)
from app.services.audit_logger import AuditEvent, AuditLogger
from app.services.lre_service import (
    LRELetter,
    LRESender,
    LRERecipient,
    get_esign_service,
    get_lre_provider,
    ESignatureRequest,
)
from app.services.stripe_metering import StripeMeteringService, verify_stripe_webhook
from app.services.termination_engine import TerminationEngine, TerminationEngineError
from app.services.termination_letter_generator import TerminationLetterGenerator

router = APIRouter(prefix="/termination", tags=["termination"])
settings = get_settings()
logger = structlog.get_logger(__name__)

# In-memory store pour le développement (remplacer par Supabase en production)
_plan_store: dict[str, dict[str, Any]] = {}


# ─────────────────────────────────────────────────────────────────────────────
# Dépendances
# ─────────────────────────────────────────────────────────────────────────────

def get_tenant_id() -> uuid.UUID:
    """Extrait le tenant_id du JWT. Dev: UUID fixe."""
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_engine() -> TerminationEngine:
    return TerminationEngine()


def get_letter_generator() -> TerminationLetterGenerator:
    return TerminationLetterGenerator()


# ─────────────────────────────────────────────────────────────────────────────
# Schémas de requête/réponse
# ─────────────────────────────────────────────────────────────────────────────

class ComputePlanRequest(BaseModel):
    """Corps de la requête POST /termination/compute."""
    contract_id: uuid.UUID
    extraction: AIExtractionResult


class ComputePlanResponse(BaseModel):
    """Réponse avec le plan calculé et les métriques clés."""
    plan_id: str
    contract_id: str
    urgency_level: str
    days_until_deadline: int | None
    notice_deadline: str | None
    anniversary_date: str
    applied_notice_months: int
    estimated_annual_savings_eur: float | None
    locked_amount_if_missed_eur: float | None
    early_termination_fee_eur: float | None
    legal_basis: str
    legal_article: str
    is_within_legal_window: bool
    workflow_status: str
    steps: list[dict[str, Any]]


class GenerateLetterRequest(BaseModel):
    sender_name: str = Field(min_length=2, max_length=200)
    sender_address: str = Field(min_length=5, max_length=300)
    sender_city: str = Field(min_length=2, max_length=100)
    sender_email: str | None = None
    supplier_address: str | None = None


class SendLRERequest(BaseModel):
    sender_email: str
    sender_name: str
    recipient_email: str
    stripe_customer_id: str | None = None
    lre_provider: str = "AR24"


class RequestESignatureRequest(BaseModel):
    signer_email: str
    signer_name: str


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/compute",
    response_model=ComputePlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Calcule le plan de résiliation depuis les données d'extraction IA",
)
async def compute_termination_plan(
    body: ComputePlanRequest,
    request: Request,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    engine: TerminationEngine = Depends(get_engine),
) -> ComputePlanResponse:
    """
    Entrée: AIExtractionResult (output validé de l'IA)
    Sortie: TerminationPlan avec dates, étapes, base légale et impact financier.

    Le plan est stocké côté serveur (référencé par plan_id pour les étapes suivantes).
    """
    log = logger.bind(
        contract_id=str(body.contract_id),
        tenant_id=str(tenant_id),
    )

    try:
        plan = engine.compute(
            extraction=body.extraction,
            contract_id=body.contract_id,
            tenant_id=tenant_id,
        )
    except TerminationEngineError as exc:
        log.error("compute.failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # Persister le plan (dev: in-memory; prod: Supabase)
    _plan_store[str(plan.plan_id)] = plan.model_dump(mode="json")
    log.info("plan.created", plan_id=str(plan.plan_id), urgency=plan.urgency_level)

    return ComputePlanResponse(
        plan_id=str(plan.plan_id),
        contract_id=str(plan.contract_id),
        urgency_level=plan.urgency_level.value,
        days_until_deadline=plan.days_until_deadline,
        notice_deadline=plan.notice_deadline.isoformat() if plan.notice_deadline else None,
        anniversary_date=plan.anniversary_date.isoformat(),
        applied_notice_months=plan.applied_notice_months,
        estimated_annual_savings_eur=plan.estimated_annual_savings_eur,
        locked_amount_if_missed_eur=plan.locked_amount_if_missed_eur,
        early_termination_fee_eur=plan.early_termination_fee_eur,
        legal_basis=plan.legal_basis.value,
        legal_article=plan.legal_article,
        is_within_legal_window=plan.is_within_legal_window,
        workflow_status=plan.workflow_status.value,
        steps=[
            {
                "step_number": s.step_number,
                "title": s.title,
                "description": s.description,
                "due_date": s.due_date.isoformat() if s.due_date else None,
                "action_type": s.action_type.value,
                "is_critical": s.is_critical,
                "estimated_duration_minutes": s.estimated_duration_minutes,
            }
            for s in plan.steps
        ],
    )


@router.post(
    "/{plan_id}/letter",
    status_code=status.HTTP_200_OK,
    summary="Génère la lettre de résiliation (HTML + PDF ready)",
)
async def generate_letter(
    plan_id: str,
    body: GenerateLetterRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    generator: TerminationLetterGenerator = Depends(get_letter_generator),
) -> JSONResponse:
    """
    Génère la lettre de résiliation via Prompt-to-HTML (GPT-4o + Jinja2).

    Le plan_id doit avoir été créé via POST /termination/compute.
    La lettre est stockée dans le plan pour l'étape LRE suivante.
    """
    plan_data = _plan_store.get(plan_id)
    if not plan_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found. Call POST /termination/compute first.",
        )

    # Reconstruire le plan depuis le store
    plan = TerminationPlan.model_validate(plan_data)

    if str(plan.tenant_id) != str(tenant_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    html_content, doc_sha256 = generator.generate(
        plan=plan,
        sender_name=body.sender_name,
        sender_address=body.sender_address,
        sender_city=body.sender_city,
        sender_email=body.sender_email,
        supplier_address=body.supplier_address,
    )

    # Persister la lettre dans le plan
    plan_data["termination_letter_html"] = html_content
    plan_data["workflow_status"] = WorkflowStatus.LETTER_GENERATED.value
    _plan_store[plan_id] = plan_data

    logger.info("letter.generated", plan_id=plan_id, sha256=doc_sha256[:16])

    return JSONResponse(content={
        "plan_id": plan_id,
        "workflow_status": WorkflowStatus.LETTER_GENERATED.value,
        "html_content": html_content,
        "document_sha256": doc_sha256,
        "letter_length_chars": len(html_content),
    })


@router.post(
    "/{plan_id}/lre",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Déclenche l'envoi de la LRE (AR24 ou Maileva)",
)
async def send_lre(
    plan_id: str,
    body: SendLRERequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> JSONResponse:
    """
    Envoie la lettre de résiliation par LRE eIDAS (AR24 ou Maileva).

    Prérequis: la lettre doit avoir été générée (POST /termination/{plan_id}/letter).
    Le plan passe à l'état LRE_SENT avec la preuve de dépôt stockée.
    """
    plan_data = _plan_store.get(plan_id)
    if not plan_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if not plan_data.get("termination_letter_html"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Letter must be generated first. Call POST /termination/{plan_id}/letter",
        )

    plan = TerminationPlan.model_validate(plan_data)
    extraction = plan.extraction
    provider = get_lre_provider(body.lre_provider)  # type: ignore[arg-type]

    letter = LRELetter(
        subject=f"Résiliation — {extraction.contract_name} — {extraction.parties.supplier_name}",
        html_content=plan_data["termination_letter_html"],
        document_sha256=plan_data.get("document_sha256", ""),
        sender=LRESender(
            email=body.sender_email,
            full_name=body.sender_name,
        ),
        recipient=LRERecipient(
            email=body.recipient_email,
            full_name=f"Service Résiliations — {extraction.parties.supplier_name}",
            company_name=extraction.parties.supplier_name,
            siret=extraction.parties.supplier_siret,
        ),
        reference=plan_id,
    )

    try:
        receipt = await provider.send(letter)
    except Exception as exc:
        logger.error("lre.send_failed", plan_id=plan_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LRE sending failed: {exc}",
        ) from exc

    # Stocker la preuve de dépôt dans le plan
    plan_data["lre_proof"] = {
        "lre_id": receipt.lre_id,
        "provider": receipt.provider,
        "sent_at": receipt.sent_at.isoformat(),
        "document_sha256": receipt.document_sha256,
        "tracking_url": receipt.tracking_url,
        "acknowledgment_received_at": None,
    }
    plan_data["workflow_status"] = WorkflowStatus.LRE_SENT.value
    _plan_store[plan_id] = plan_data

    # Billing Stripe
    if body.stripe_customer_id and plan.estimated_annual_savings_eur:
        metering = StripeMeteringService()
        await metering.report_lre_sent(
            stripe_customer_id=body.stripe_customer_id,
            plan_id=plan.plan_id,
            tenant_id=tenant_id,
            lre_provider=body.lre_provider,
        )

    logger.info(
        "lre.sent",
        plan_id=plan_id,
        lre_id=receipt.lre_id,
        provider=receipt.provider,
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "plan_id": plan_id,
            "lre_id": receipt.lre_id,
            "provider": receipt.provider,
            "sent_at": receipt.sent_at.isoformat(),
            "tracking_url": receipt.tracking_url,
            "workflow_status": WorkflowStatus.LRE_SENT.value,
            "document_sha256": receipt.document_sha256,
        },
    )


@router.post(
    "/{plan_id}/esign",
    status_code=status.HTTP_201_CREATED,
    summary="Demande une signature électronique eIDAS (DocuSign/Dropbox Sign)",
)
async def request_esignature(
    plan_id: str,
    body: RequestESignatureRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> JSONResponse:
    plan_data = _plan_store.get(plan_id)
    if not plan_data or not plan_data.get("termination_letter_html"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Letter must be generated first.",
        )

    esign_service = get_esign_service()
    result = await esign_service.request_signature(
        ESignatureRequest(
            document_html=plan_data["termination_letter_html"],
            document_sha256=plan_data.get("document_sha256", ""),
            signer_email=body.signer_email,
            signer_name=body.signer_name,
            reference=plan_id,
        )
    )

    plan_data["workflow_status"] = WorkflowStatus.ESIGN_PENDING.value
    plan_data["esign_reference"] = result.signature_request_id
    _plan_store[plan_id] = plan_data

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "plan_id": plan_id,
            "signature_request_id": result.signature_request_id,
            "signing_url": result.signing_url,
            "provider": result.provider.value,
            "workflow_status": WorkflowStatus.ESIGN_PENDING.value,
        },
    )


@router.get(
    "/dashboard/summary",
    summary="Résumé des économies pour le dashboard",
)
async def get_dashboard_summary(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> JSONResponse:
    """
    Agrège les données de tous les plans pour le composant SavingsDashboard.
    En production: requête Supabase avec agrégation SQL.
    """
    plans = [
        TerminationPlan.model_validate(p)
        for p in _plan_store.values()
        if p.get("tenant_id") == str(tenant_id)
    ]

    total_savings = sum(
        p.estimated_annual_savings_eur or 0
        for p in plans
        if p.workflow_status == WorkflowStatus.TERMINATED
    )
    pending_savings = sum(
        p.estimated_annual_savings_eur or 0
        for p in plans
        if p.workflow_status in (WorkflowStatus.DRAFT, WorkflowStatus.LETTER_GENERATED)
    )
    urgent_count = sum(1 for p in plans if p.is_urgent)
    terminated_count = sum(
        1 for p in plans if p.workflow_status == WorkflowStatus.TERMINATED
    )

    # Plans à trier par urgence pour l'affichage
    upcoming = sorted(
        [p for p in plans if p.days_until_deadline is not None and p.days_until_deadline >= 0],
        key=lambda p: p.days_until_deadline or 9999,
    )[:5]

    return JSONResponse(content={
        "total_annual_savings_eur": round(total_savings, 2),
        "pending_savings_eur": round(pending_savings, 2),
        "total_plans": len(plans),
        "terminated_count": terminated_count,
        "urgent_count": urgent_count,
        "upcoming_deadlines": [
            {
                "plan_id": str(p.plan_id),
                "contract_name": p.extraction.contract_name,
                "supplier": p.extraction.parties.supplier_name,
                "urgency": p.urgency_level.value,
                "days_remaining": p.days_until_deadline,
                "deadline": p.notice_deadline.isoformat() if p.notice_deadline else None,
                "savings_eur": p.estimated_annual_savings_eur,
            }
            for p in upcoming
        ],
    })


@router.get(
    "/{plan_id}/status",
    summary="Statut du workflow de résiliation",
)
async def get_plan_status(
    plan_id: str,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
) -> JSONResponse:
    plan_data = _plan_store.get(plan_id)
    if not plan_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    return JSONResponse(content={
        "plan_id": plan_id,
        "workflow_status": plan_data.get("workflow_status"),
        "has_letter": bool(plan_data.get("termination_letter_html")),
        "lre_proof": plan_data.get("lre_proof"),
        "esign_reference": plan_data.get("esign_reference"),
    })


# ─────────────────────────────────────────────────────────────────────────────
# Webhook Stripe
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/webhooks/stripe",
    status_code=status.HTTP_200_OK,
    summary="Webhook Stripe pour les confirmations de paiement",
    include_in_schema=False,  # Pas exposé dans la doc publique
)
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str, Header(alias="stripe-signature")],
) -> JSONResponse:
    """
    Reçoit les événements Stripe et met à jour l'état des plans.

    Événements traités:
    - invoice.payment_succeeded → Marquer le plan comme payé
    - billing_portal.session.created → Tracking usage
    """
    payload = await request.body()

    try:
        event = verify_stripe_webhook(payload, stripe_signature)
    except Exception as exc:
        logger.warning("stripe.webhook.invalid_signature", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        ) from exc

    event_type = event.get("type", "")
    logger.info("stripe.webhook.received", event_type=event_type)

    if event_type == "invoice.payment_succeeded":
        # TODO: Mettre à jour l'état du plan dans Supabase
        logger.info("stripe.payment_confirmed", invoice_id=event["data"]["object"]["id"])

    return JSONResponse(content={"received": True})
