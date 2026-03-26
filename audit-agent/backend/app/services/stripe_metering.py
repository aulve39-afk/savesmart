"""
StripeMeteringService: Facturation usage-based pour Unsubscribe.ai.

Modèle de monétisation:
  1. "Au succès" (success-based billing):
     - 5% du montant annuel économisé (cappé à 500€ par résiliation)
     - Déclenché à: TERMINATION_EFFECTIVE
  2. "Au courrier" (per-action billing):
     - 4.90€ par LRE envoyée (AR24/Maileva)
     - 0.99€ par lettre générée
     - 0.00€ par analyse de contrat (freemium → conversion)
  3. Subscription Plan (en option):
     - Starter: 29€/mois → 5 résiliations incluses
     - Pro: 99€/mois → 25 résiliations + API access
     - Enterprise: sur devis

Intégration Stripe Meters API (2024+):
  - stripe.billing.meter_events.create() → Usage reporting
  - stripe.billing.meters → Définition des compteurs
  - Webhooks: invoice.payment_succeeded → confirmer paiement
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Any
from uuid import UUID

import stripe
import structlog

from app.core.config import get_settings
from app.services.audit_logger import AuditEvent, AuditLogger

logger = structlog.get_logger(__name__)
settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# Modèles
# ─────────────────────────────────────────────────────────────────────────────

class BillingEvent(StrEnum):
    """Événements facturables mappés aux Stripe Meter Event Names."""
    LRE_SENT = "unsubscribe_lre_sent"           # 4.90€ par envoi
    LETTER_GENERATED = "unsubscribe_letter_gen" # 0.99€ par lettre
    TERMINATION_SUCCESS = "unsubscribe_success" # 5% des savings (cappé 500€)
    ANALYSIS_COMPLETED = "unsubscribe_analysis" # Gratuit (freemium)


@dataclass(frozen=True)
class MeteringPayload:
    """Payload pour Stripe Meter Event."""
    event_name: BillingEvent
    stripe_customer_id: str
    value: int  # En centimes (ou 1 pour les événements unitaires)
    # Idempotency: empêche la double facturation si retry
    idempotency_key: str
    # Métadonnées (non facturables, pour le dashboard Stripe)
    metadata: dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────

class StripeMeteringService:
    """
    Reporting d'usage vers Stripe Meters API.

    Thread-safe: les appels Stripe sont stateless.
    Tolérance aux pannes: si Stripe est down, l'opération principale continue
    (les événements de metering sont loggués pour replay).
    """

    # Plafond de facturation "au succès" (évite les factures aberrantes)
    SUCCESS_FEE_CAP_EUR = 500.0
    SUCCESS_FEE_RATE = 0.05  # 5%

    def __init__(self, audit_logger: AuditLogger | None = None) -> None:
        stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "sk_test_placeholder")
        self._audit = audit_logger

    async def report_lre_sent(
        self,
        stripe_customer_id: str,
        plan_id: UUID,
        tenant_id: UUID,
        lre_provider: str,
    ) -> bool:
        """Facture 4.90€ pour l'envoi d'une LRE."""
        return await self._report_usage(
            payload=MeteringPayload(
                event_name=BillingEvent.LRE_SENT,
                stripe_customer_id=stripe_customer_id,
                value=490,  # 4.90€ en centimes
                idempotency_key=f"lre-{plan_id}",
                metadata={
                    "plan_id": str(plan_id),
                    "lre_provider": lre_provider,
                },
            ),
            tenant_id=tenant_id,
        )

    async def report_letter_generated(
        self,
        stripe_customer_id: str,
        plan_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        """Facture 0.99€ pour la génération d'une lettre."""
        return await self._report_usage(
            payload=MeteringPayload(
                event_name=BillingEvent.LETTER_GENERATED,
                stripe_customer_id=stripe_customer_id,
                value=99,  # 0.99€ en centimes
                idempotency_key=f"letter-{plan_id}",
                metadata={"plan_id": str(plan_id)},
            ),
            tenant_id=tenant_id,
        )

    async def report_termination_success(
        self,
        stripe_customer_id: str,
        plan_id: UUID,
        tenant_id: UUID,
        annual_savings_eur: float,
    ) -> bool:
        """
        Facture au succès: 5% des économies annuelles (cappé à 500€).

        Exemple:
            savings = 2400€/an → fee = 120€ (5%)
            savings = 12000€/an → fee = 500€ (cappé)

        Note: Ce modèle est idéal pour le PLG (Product-Led Growth):
        l'utilisateur ne paie que s'il économise réellement.
        """
        raw_fee = annual_savings_eur * self.SUCCESS_FEE_RATE
        capped_fee = min(raw_fee, self.SUCCESS_FEE_CAP_EUR)
        fee_cents = int(capped_fee * 100)

        logger.info(
            "billing.success_fee",
            plan_id=str(plan_id),
            savings=annual_savings_eur,
            fee_eur=capped_fee,
            was_capped=raw_fee > self.SUCCESS_FEE_CAP_EUR,
        )

        return await self._report_usage(
            payload=MeteringPayload(
                event_name=BillingEvent.TERMINATION_SUCCESS,
                stripe_customer_id=stripe_customer_id,
                value=fee_cents,
                idempotency_key=f"success-{plan_id}",
                metadata={
                    "plan_id": str(plan_id),
                    "annual_savings_eur": str(annual_savings_eur),
                    "fee_eur": str(capped_fee),
                    "was_capped": str(raw_fee > self.SUCCESS_FEE_CAP_EUR),
                },
            ),
            tenant_id=tenant_id,
        )

    async def report_analysis(
        self,
        stripe_customer_id: str,
        tenant_id: UUID,
        contract_id: UUID,
    ) -> bool:
        """
        Rapport d'analyse gratuite (freemium).
        Comptabilisé dans Stripe pour le tracking usage mais pas facturé.
        Utile pour déclencher des upsells (ex: quota freemium atteint).
        """
        return await self._report_usage(
            payload=MeteringPayload(
                event_name=BillingEvent.ANALYSIS_COMPLETED,
                stripe_customer_id=stripe_customer_id,
                value=0,  # Gratuit
                idempotency_key=f"analysis-{contract_id}",
                metadata={"contract_id": str(contract_id)},
            ),
            tenant_id=tenant_id,
        )

    async def get_customer_savings_total(
        self, stripe_customer_id: str
    ) -> dict[str, float]:
        """
        Récupère les métriques d'usage d'un customer pour le dashboard.

        Returns:
            {
                "total_lre_sent": 12,
                "total_letters": 15,
                "total_savings_eur": 24500.0,
                "total_fees_paid_eur": 890.5,
            }
        """
        try:
            # Stripe Meters API: agrégation des événements usage
            # Note: l'implémentation exacte dépend de la config des Meters dans Stripe
            meter_events = stripe.billing.MeterEvent.list(
                customer=stripe_customer_id,
                limit=100,
            )

            total_lre = sum(
                1 for e in meter_events.data
                if e.event_name == BillingEvent.LRE_SENT
            )
            total_letters = sum(
                1 for e in meter_events.data
                if e.event_name == BillingEvent.LETTER_GENERATED
            )
            total_savings = sum(
                float(e.payload.get("annual_savings_eur", 0))
                for e in meter_events.data
                if e.event_name == BillingEvent.TERMINATION_SUCCESS
            )
            total_fees = sum(
                e.payload.get("value", 0) / 100.0
                for e in meter_events.data
                if e.event_name != BillingEvent.ANALYSIS_COMPLETED
            )

            return {
                "total_lre_sent": float(total_lre),
                "total_letters": float(total_letters),
                "total_savings_eur": total_savings,
                "total_fees_paid_eur": total_fees,
            }

        except stripe.StripeError as exc:
            logger.error("stripe.get_usage_failed", error=str(exc))
            return {
                "total_lre_sent": 0.0,
                "total_letters": 0.0,
                "total_savings_eur": 0.0,
                "total_fees_paid_eur": 0.0,
            }

    async def _report_usage(
        self,
        payload: MeteringPayload,
        tenant_id: UUID,
    ) -> bool:
        """
        Envoie un Meter Event à Stripe.
        Tolérant aux pannes: retourne False si Stripe est down (pas d'exception).
        """
        try:
            stripe.billing.MeterEvent.create(
                event_name=payload.event_name.value,
                payload={
                    "stripe_customer_id": payload.stripe_customer_id,
                    "value": str(payload.value),
                    **{k: str(v) for k, v in payload.metadata.items()},
                },
                identifier=payload.idempotency_key,
                timestamp=int(time.time()),
            )

            logger.info(
                "stripe.usage_reported",
                event=payload.event_name.value,
                customer=payload.stripe_customer_id[:8] + "...",
                value_cents=payload.value,
            )

            # Log audit de la facturation
            if self._audit:
                await self._audit.log(
                    AuditEvent.STRIPE_USAGE_REPORTED,
                    tenant_id=tenant_id,
                    metadata={
                        "billing_event": payload.event_name.value,
                        "value_cents": payload.value,
                        "idempotency_key": payload.idempotency_key,
                    },
                )

            return True

        except stripe.StripeError as exc:
            # Ne pas faire planter l'opération principale pour un échec billing
            logger.error(
                "stripe.meter_event_failed",
                event=payload.event_name.value,
                error=str(exc),
                idempotency_key=payload.idempotency_key,
            )
            return False


# ─────────────────────────────────────────────────────────────────────────────
# Webhook Handler (pour les confirmations de paiement)
# ─────────────────────────────────────────────────────────────────────────────

def verify_stripe_webhook(payload: bytes, sig_header: str) -> dict[str, Any]:
    """
    Vérifie la signature du webhook Stripe.
    À utiliser dans la route POST /webhooks/stripe.

    Raises:
        stripe.error.SignatureVerificationError: Si la signature est invalide.
    """
    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
    event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    return event  # type: ignore[return-value]
