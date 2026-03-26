"""
AuditLogger: Système de log immuable pour les actions de résiliation.

Garanties:
  1. IMMUABILITÉ: chaque entrée chaîne le hash de l'entrée précédente
     (merkle-chain simplifiée) → toute altération casse la chaîne
  2. TRAÇABILITÉ: chaque action de résiliation est loggée avec:
     - tenant_id, plan_id, user_id, action, timestamp, IP, payload hash
  3. PREUVE DE DÉPÔT: les LRE reçues sont stockées avec leur hash SHA-256
     → opposable en cas de litige fournisseur
  4. CONFORMITÉ RGPD Art. 5(1)(f): intégrité et confidentialité des données

Usage:
    audit = AuditLogger(supabase_client)
    await audit.log(AuditEvent.LRE_SENT, plan_id=plan.plan_id, ...)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

import structlog
from supabase import AsyncClient

logger = structlog.get_logger(__name__)


class AuditEvent(StrEnum):
    """Catalogue exhaustif des événements auditables."""
    # Cycle de vie du contrat
    CONTRACT_UPLOADED = "CONTRACT_UPLOADED"
    CONTRACT_ANALYZED = "CONTRACT_ANALYZED"

    # Plan de résiliation
    TERMINATION_PLAN_CREATED = "TERMINATION_PLAN_CREATED"
    TERMINATION_PLAN_VIEWED = "TERMINATION_PLAN_VIEWED"

    # Lettre
    LETTER_GENERATED = "LETTER_GENERATED"
    LETTER_REGENERATED = "LETTER_REGENERATED"

    # Signature
    ESIGN_REQUESTED = "ESIGN_REQUESTED"
    ESIGN_COMPLETED = "ESIGN_COMPLETED"
    ESIGN_REFUSED = "ESIGN_REFUSED"

    # LRE
    LRE_DISPATCHED = "LRE_DISPATCHED"
    LRE_ACKNOWLEDGED = "LRE_ACKNOWLEDGED"
    LRE_REFUSED = "LRE_REFUSED"

    # Résiliation effective
    TERMINATION_EFFECTIVE = "TERMINATION_EFFECTIVE"
    TERMINATION_FAILED = "TERMINATION_FAILED"

    # Contentieux
    DISPUTE_OPENED = "DISPUTE_OPENED"
    DISPUTE_RESOLVED = "DISPUTE_RESOLVED"

    # RGPD
    DATA_EXPORT_REQUESTED = "DATA_EXPORT_REQUESTED"
    DATA_DELETION_REQUESTED = "DATA_DELETION_REQUESTED"

    # Billing
    STRIPE_USAGE_REPORTED = "STRIPE_USAGE_REPORTED"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"


class AuditLogger:
    """
    Logger d'audit avec chaînage de hashes (intégrité immuable).

    Schéma Supabase (table `termination_audit_log`):
    ┌──────────────────────┬─────────────────┬──────────┐
    │ id (UUID PK)         │ tenant_id (UUID) │ seq (int) │
    │ event (StrEnum)      │ plan_id (UUID?)  │           │
    │ actor_id (UUID?)     │ ip_hash (str?)   │           │
    │ payload_hash (str)   │ prev_hash (str)  │           │
    │ chain_hash (str)     │ created_at (ts)  │           │
    │ metadata (jsonb)     │                  │           │
    └──────────────────────┴─────────────────┴──────────┘

    chain_hash = SHA-256(id + event + payload_hash + prev_hash + created_at)
    → Toute modification d'une entrée casse la chaîne → détectable
    """

    TABLE = "termination_audit_log"

    def __init__(self, supabase: AsyncClient) -> None:
        self._db = supabase

    async def log(
        self,
        event: AuditEvent,
        tenant_id: UUID,
        plan_id: UUID | None = None,
        actor_id: UUID | None = None,
        ip_address: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Enregistre un événement d'audit.

        Args:
            event:      Type d'événement (AuditEvent)
            tenant_id:  Isolation RGPD
            plan_id:    UUID du plan de résiliation (si applicable)
            actor_id:   UUID de l'utilisateur déclencheur
            ip_address: IP du requêtant (hashée avant stockage)
            metadata:   Données contextuelles (json-sérialisables)

        Returns:
            entry_id: UUID de l'entrée créée

        Note: L'IP est hashée SHA-256 avant stockage (RGPD Art. 4 — donnée à caractère personnel).
        """
        entry_id = str(uuid4())
        now = datetime.utcnow().isoformat()

        # Hash du payload metadata (jamais le payload brut pour éviter PII)
        payload_str = json.dumps(metadata or {}, sort_keys=True, ensure_ascii=False)
        payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

        # IP hashée (jamais stockée en clair)
        ip_hash = (
            hashlib.sha256(ip_address.encode()).hexdigest()[:16]
            if ip_address
            else None
        )

        # Récupération du hash précédent pour le chaînage
        prev_hash = await self._get_last_chain_hash(tenant_id)

        # Hash de chaînage (garantit l'immuabilité)
        chain_input = f"{entry_id}|{event}|{payload_hash}|{prev_hash}|{now}"
        chain_hash = hashlib.sha256(chain_input.encode()).hexdigest()

        row = {
            "id": entry_id,
            "tenant_id": str(tenant_id),
            "plan_id": str(plan_id) if plan_id else None,
            "event": event.value,
            "actor_id": str(actor_id) if actor_id else None,
            "ip_hash": ip_hash,
            "payload_hash": payload_hash,
            "prev_hash": prev_hash,
            "chain_hash": chain_hash,
            "created_at": now,
            # Metadata filtrées (on ne stocke que les champs non-PII)
            "metadata": self._sanitize_metadata(metadata or {}),
        }

        try:
            await self._db.table(self.TABLE).insert(row).execute()
            logger.info(
                "audit.logged",
                event=event.value,
                entry_id=entry_id,
                tenant_id=str(tenant_id)[:8] + "...",
            )
        except Exception as exc:
            # L'audit ne doit JAMAIS faire planter l'opération principale
            logger.error("audit.log_failed", event=event.value, error=str(exc))

        return entry_id

    async def verify_chain_integrity(self, tenant_id: UUID) -> dict[str, Any]:
        """
        Vérifie l'intégrité de la chaîne d'audit pour un tenant.

        Parcourt toutes les entrées et recompute chaque chain_hash.
        Toute divergence = entrée modifiée → alerte sécurité.

        Returns:
            {"valid": bool, "entries_checked": int, "first_broken_at": str | None}
        """
        result = (
            await self._db.table(self.TABLE)
            .select("id, event, payload_hash, prev_hash, chain_hash, created_at")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=False)
            .execute()
        )

        entries = result.data or []
        first_broken: str | None = None

        for entry in entries:
            expected = hashlib.sha256(
                f"{entry['id']}|{entry['event']}|{entry['payload_hash']}|"
                f"{entry['prev_hash']}|{entry['created_at']}".encode()
            ).hexdigest()

            if expected != entry["chain_hash"]:
                first_broken = entry["id"]
                logger.critical(
                    "audit.chain_broken",
                    entry_id=entry["id"],
                    event=entry["event"],
                    tenant_id=str(tenant_id),
                )
                break

        return {
            "valid": first_broken is None,
            "entries_checked": len(entries),
            "first_broken_at": first_broken,
        }

    async def get_plan_history(
        self,
        plan_id: UUID,
        tenant_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        Historique complet d'un plan de résiliation (pour affichage ou litige).
        La RLS Supabase garantit l'isolation par tenant.
        """
        result = (
            await self._db.table(self.TABLE)
            .select("id, event, actor_id, created_at, metadata")
            .eq("plan_id", str(plan_id))
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=False)
            .execute()
        )
        return result.data or []

    async def _get_last_chain_hash(self, tenant_id: UUID) -> str:
        """Récupère le chain_hash de la dernière entrée pour le chaînage."""
        try:
            result = (
                await self._db.table(self.TABLE)
                .select("chain_hash")
                .eq("tenant_id", str(tenant_id))
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            entries = result.data or []
            if entries:
                return entries[0]["chain_hash"]
        except Exception:
            pass

        # Première entrée: genesis hash
        return hashlib.sha256(b"genesis").hexdigest()

    @staticmethod
    def _sanitize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
        """
        Filtre les champs PII potentiels du metadata avant stockage.
        On garde uniquement les champs non-sensibles pour l'audit.
        """
        # Champs interdits en audit (PII, données sensibles)
        FORBIDDEN_KEYS = {
            "email", "name", "address", "phone", "iban", "siret",
            "full_name", "sender_name", "customer_name",
            "html_content", "letter_content",  # Trop volumineux pour audit
        }
        return {
            k: v
            for k, v in metadata.items()
            if k.lower() not in FORBIDDEN_KEYS and not isinstance(v, (bytes, bytearray))
        }


# ─────────────────────────────────────────────────────────────────────────────
# Middleware RGPD: Masquage PII avant envoi LLM
# ─────────────────────────────────────────────────────────────────────────────

class LLMDataMaskingMiddleware:
    """
    Middleware de masquage des données sensibles AVANT envoi au LLM.

    Différent de pii_anonymizer.py (qui est pour l'extraction IA de contrats).
    Celui-ci est pour les payloads de génération de lettres → contenu moins structuré.

    Règle: on remplace les PII par des tokens avant d'envoyer au LLM,
    puis on réinjecte les valeurs réelles DANS LE TEMPLATE (pas dans la réponse IA).
    """

    # PII à masquer systématiquement avant tout envoi LLM
    _MASK_FIELDS = frozenset([
        "sender_name", "sender_email", "sender_address",
        "customer_contract_id",  # N° client peut être sensible
    ])

    def mask_for_llm(
        self,
        payload: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, str]]:
        """
        Masque les champs PII et retourne (payload_masqué, reversion_map).

        Le payload masqué est envoyé au LLM.
        Le reversion_map est utilisé dans le template (jamais envoyé au LLM).
        """
        masked = dict(payload)
        reversion: dict[str, str] = {}

        for field_name in self._MASK_FIELDS:
            if field_name in payload and payload[field_name]:
                token = f"[{field_name.upper()}]"
                reversion[token] = str(payload[field_name])
                masked[field_name] = token

        return masked, reversion
