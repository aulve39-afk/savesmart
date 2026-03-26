"""
LREService: Intégration Lettre Recommandée Électronique.

Providers supportés:
  - AR24     (https://www.ar24.fr) — certifié eIDAS, délai: 24h
  - Maileva  (https://www.maileva.com) — filiale La Poste, délai: 24-48h

Architecture: Pattern Stratégie (Strategy) + Factory.
  Le caller choisit le provider via config, l'interface est identique.

Valeur légale: une LRE eIDAS a la même valeur probante qu'une LRAR physique
(Art. L.100 Code des Postes et Communications Électroniques).

IMPORTANT: Ces intégrations sont THÉORIQUES (sandbox/staging).
  Pour la production: obtenir un compte certifié eIDAS auprès de AR24 ou Maileva.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# Modèles de données
# ─────────────────────────────────────────────────────────────────────────────

class LREStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"   # AR signé par le destinataire
    REFUSED = "REFUSED"             # Destinataire a refusé
    UNDELIVERABLE = "UNDELIVERABLE" # Adresse invalide


@dataclass(frozen=True)
class LRERecipient:
    email: str
    full_name: str
    company_name: str | None = None
    siret: str | None = None  # Pour l'identification B2B


@dataclass(frozen=True)
class LRESender:
    email: str
    full_name: str
    company_name: str | None = None
    # Identifiant certifié eIDAS du compte expéditeur
    certified_account_id: str | None = None


@dataclass
class LRELetter:
    """Lettre à envoyer en recommandé électronique."""
    subject: str
    html_content: str
    document_sha256: str  # Hash du contenu pour intégrité
    sender: LRESender
    recipient: LRERecipient
    reference: str  # Référence interne (plan_id)
    attachments: list[tuple[str, bytes]] = field(default_factory=list)
    # (filename, content_bytes)


@dataclass(frozen=True)
class LREReceipt:
    """Preuve de dépôt immuable retournée par le provider."""
    provider: Literal["AR24", "MAILEVA"]
    lre_id: str                     # ID unique chez le provider
    sent_at: datetime
    document_sha256: str            # Renvoyé par le provider pour vérification croisée
    tracking_url: str | None        # URL publique de suivi
    estimated_delivery: datetime | None
    raw_response: dict[str, Any]    # Réponse brute pour audit trail


# ─────────────────────────────────────────────────────────────────────────────
# Interface abstraite
# ─────────────────────────────────────────────────────────────────────────────

class LREProvider(ABC):
    """Interface commune pour tous les providers LRE."""

    @abstractmethod
    async def send(self, letter: LRELetter) -> LREReceipt:
        """
        Envoie la lettre et retourne la preuve de dépôt.
        Raises:
            LREProviderError: Si l'envoi échoue après les retries.
        """

    @abstractmethod
    async def get_status(self, lre_id: str) -> LREStatus:
        """Interroge le statut d'une LRE envoyée."""

    @abstractmethod
    async def get_acknowledgment_pdf(self, lre_id: str) -> bytes:
        """Télécharge le PDF de l'accusé de réception (quand ACKNOWLEDGED)."""


class LREProviderError(Exception):
    """Erreur d'un provider LRE (réseau, auth, quotas)."""
    def __init__(self, provider: str, status_code: int | None, message: str) -> None:
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"[{provider}] HTTP {status_code}: {message}")


# ─────────────────────────────────────────────────────────────────────────────
# Implémentation AR24
# ─────────────────────────────────────────────────────────────────────────────

class AR24Provider(LREProvider):
    """
    Intégration AR24 (https://www.ar24.fr).

    Auth: API Key + HMAC-SHA256 signature par requête
    Base URL sandbox: https://sandbox.ar24.fr/api/v1
    Base URL prod:    https://app.ar24.fr/api/v1

    Documentation: https://www.ar24.fr/documentation-api
    """

    BASE_URL_SANDBOX = "https://sandbox.ar24.fr/api/v1"
    BASE_URL_PROD = "https://app.ar24.fr/api/v1"

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        sandbox: bool = True,
    ) -> None:
        self._api_key = api_key
        self._api_secret = api_secret
        self._base_url = self.BASE_URL_SANDBOX if sandbox else self.BASE_URL_PROD
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=30.0,
            headers={"X-Api-Key": api_key},
        )

    def _sign_request(self, payload: dict[str, Any], timestamp: int) -> str:
        """HMAC-SHA256 signature pour authentification AR24."""
        message = f"{timestamp}\n{payload}"
        return hmac.new(
            self._api_secret.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=2, max=30),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def send(self, letter: LRELetter) -> LREReceipt:
        timestamp = int(time.time())
        log = logger.bind(provider="AR24", reference=letter.reference)

        payload: dict[str, Any] = {
            "subject": letter.subject,
            "from": {
                "email": letter.sender.email,
                "name": letter.sender.full_name,
                "company": letter.sender.company_name,
                "certified_id": letter.sender.certified_account_id,
            },
            "to": {
                "email": letter.recipient.email,
                "name": letter.recipient.full_name,
                "company": letter.recipient.company_name,
                "siret": letter.recipient.siret,
            },
            "content": letter.html_content,
            "content_type": "text/html",
            "reference": letter.reference,
            "document_hash": letter.document_sha256,
            # eIDAS Level: advanced (avec identité vérifiée)
            "eidas_level": "advanced",
        }

        # Ajout des pièces jointes (PDF contrat, etc.)
        for filename, content in letter.attachments:
            payload.setdefault("attachments", []).append({
                "filename": filename,
                "content": content.hex(),  # AR24 attend hex-encoded
                "mime_type": "application/pdf",
            })

        try:
            response = await self._client.post(
                "/lre/send",
                json=payload,
                headers={"X-Timestamp": str(timestamp)},
            )
            response.raise_for_status()
            data = response.json()

            log.info("ar24.sent", lre_id=data.get("id"), status=data.get("status"))

            return LREReceipt(
                provider="AR24",
                lre_id=data["id"],
                sent_at=datetime.fromisoformat(data["sent_at"]),
                document_sha256=data.get("document_hash", letter.document_sha256),
                tracking_url=data.get("tracking_url"),
                estimated_delivery=None,  # AR24 garantit J+1 ouvré
                raw_response=data,
            )

        except httpx.HTTPStatusError as exc:
            log.error("ar24.send_failed", status=exc.response.status_code)
            raise LREProviderError("AR24", exc.response.status_code, exc.response.text) from exc

    async def get_status(self, lre_id: str) -> LREStatus:
        response = await self._client.get(f"/lre/{lre_id}/status")
        response.raise_for_status()
        raw_status = response.json().get("status", "PENDING")
        return LREStatus(raw_status.upper())

    async def get_acknowledgment_pdf(self, lre_id: str) -> bytes:
        response = await self._client.get(
            f"/lre/{lre_id}/acknowledgment",
            headers={"Accept": "application/pdf"},
        )
        response.raise_for_status()
        return response.content


# ─────────────────────────────────────────────────────────────────────────────
# Implémentation Maileva
# ─────────────────────────────────────────────────────────────────────────────

class MailevaProvider(LREProvider):
    """
    Intégration Maileva (https://www.maileva.com) — filiale La Poste.

    Auth: OAuth2 Client Credentials Flow
    Base URL sandbox: https://api.sandbox.maileva.net
    Base URL prod:    https://api.maileva.net

    Documentation: https://developer.maileva.com
    """

    BASE_URL_SANDBOX = "https://api.sandbox.maileva.net"
    BASE_URL_PROD = "https://api.maileva.net"

    # Mapping statuts Maileva → LREStatus interne
    STATUS_MAP: dict[str, LREStatus] = {
        "CREATED": LREStatus.PENDING,
        "ACCEPTED": LREStatus.SENT,
        "DEPOSITED": LREStatus.DELIVERED,
        "ACKNOWLEDGED": LREStatus.ACKNOWLEDGED,
        "REFUSED": LREStatus.REFUSED,
        "FAILED": LREStatus.UNDELIVERABLE,
    }

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        sandbox: bool = True,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._base_url = self.BASE_URL_SANDBOX if sandbox else self.BASE_URL_PROD
        self._access_token: str | None = None
        self._token_expiry: float = 0

    async def _get_token(self) -> str:
        """OAuth2 Client Credentials avec cache du token."""
        if self._access_token and time.time() < self._token_expiry:
            return self._access_token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/authentication/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data["access_token"]
            self._token_expiry = time.time() + data["expires_in"] - 60  # Marge 60s
            return self._access_token

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=2, max=30),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def send(self, letter: LRELetter) -> LREReceipt:
        token = await self._get_token()
        log = logger.bind(provider="MAILEVA", reference=letter.reference)

        async with httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        ) as client:
            # Maileva: création en 2 étapes (create + send)
            # Étape 1: Créer l'envoi
            create_payload = {
                "name": f"Résiliation {letter.reference}",
                "custom_id": letter.reference,
                "sender": {
                    "address_line_1": letter.sender.full_name,
                    "email": letter.sender.email,
                },
                "recipients": [{
                    "address_line_1": letter.recipient.full_name,
                    "email": letter.recipient.email,
                    "company_name": letter.recipient.company_name,
                }],
                "documents": [{
                    "content": letter.html_content,
                    "content_type": "text/html",
                    "priority": 1,
                }],
                "notification": {
                    "email": True,
                    "tracking": True,
                },
            }

            create_resp = await client.post("/lre/v2/sendings", json=create_payload)
            create_resp.raise_for_status()
            sending_id = create_resp.json()["id"]

            # Étape 2: Déclencher l'envoi
            send_resp = await client.post(f"/lre/v2/sendings/{sending_id}/submit")
            send_resp.raise_for_status()
            data = send_resp.json()

            log.info("maileva.sent", lre_id=sending_id, status=data.get("status"))

            return LREReceipt(
                provider="MAILEVA",
                lre_id=sending_id,
                sent_at=datetime.utcnow(),
                document_sha256=letter.document_sha256,
                tracking_url=data.get("tracking_url"),
                estimated_delivery=None,
                raw_response=data,
            )

    async def get_status(self, lre_id: str) -> LREStatus:
        token = await self._get_token()
        async with httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {token}"},
        ) as client:
            resp = await client.get(f"/lre/v2/sendings/{lre_id}")
            resp.raise_for_status()
            raw = resp.json().get("status", "CREATED")
            return self.STATUS_MAP.get(raw, LREStatus.PENDING)

    async def get_acknowledgment_pdf(self, lre_id: str) -> bytes:
        token = await self._get_token()
        async with httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {token}"},
        ) as client:
            resp = await client.get(f"/lre/v2/sendings/{lre_id}/acknowledgment")
            resp.raise_for_status()
            return resp.content


# ─────────────────────────────────────────────────────────────────────────────
# E-Signature Service
# ─────────────────────────────────────────────────────────────────────────────

class ESignatureProvider(StrEnum):
    DOCUSIGN = "DOCUSIGN"
    DROPBOX_SIGN = "DROPBOX_SIGN"


@dataclass(frozen=True)
class ESignatureRequest:
    document_html: str
    document_sha256: str
    signer_email: str
    signer_name: str
    reference: str  # plan_id
    subject: str = "Signature de votre lettre de résiliation"
    message: str = "Veuillez signer ce document pour finaliser votre demande de résiliation."


@dataclass(frozen=True)
class ESignatureResult:
    provider: ESignatureProvider
    signature_request_id: str
    signing_url: str           # URL unique pour signer (expire en 24h)
    reference: str
    created_at: datetime


class ESignatureService:
    """
    Service de signature électronique eIDAS Niveau 1.

    Supporte DocuSign et Dropbox Sign (anciennement HelloSign).
    Le provider est sélectionné par configuration.

    Note: Les signatures générées ont une valeur probante légale (eIDAS Level 1)
    suffisante pour des contrats commerciaux standard.
    Pour les contrats critiques (>100k€): utiliser eIDAS Level 2 (QES).
    """

    def __init__(
        self,
        provider: ESignatureProvider,
        api_key: str,
        sandbox: bool = True,
    ) -> None:
        self._provider = provider
        self._api_key = api_key
        self._sandbox = sandbox

    async def request_signature(self, request: ESignatureRequest) -> ESignatureResult:
        """Crée une demande de signature et retourne l'URL de signature."""
        if self._provider == ESignatureProvider.DROPBOX_SIGN:
            return await self._dropbox_sign(request)
        elif self._provider == ESignatureProvider.DOCUSIGN:
            return await self._docusign(request)
        raise NotImplementedError(f"Provider {self._provider} not implemented")

    async def _dropbox_sign(self, request: ESignatureRequest) -> ESignatureResult:
        """
        Dropbox Sign (ex HelloSign) — REST API simple, idéale pour les startups.
        Sandbox: les emails de signature ne sont pas réellement envoyés.
        Doc: https://developers.hellosign.com
        """
        base_url = (
            "https://api.hellosign.com/v3"
            if not self._sandbox
            else "https://api.hellosign.com/v3"  # Même URL, sandbox via test mode
        )

        payload: dict[str, Any] = {
            "test_mode": 1 if self._sandbox else 0,
            "title": request.subject,
            "subject": request.subject,
            "message": request.message,
            "signers": [{
                "email_address": request.signer_email,
                "name": request.signer_name,
                "order": 0,
            }],
            "files": [],  # En production: PDF bytes encodés en base64
            "metadata": {"reference": request.reference, "sha256": request.document_sha256},
            "signing_redirect_url": f"{settings.API_PREFIX}/termination/{request.reference}/signed",
        }

        async with httpx.AsyncClient(
            base_url=base_url,
            auth=(self._api_key, ""),
            timeout=30.0,
        ) as client:
            resp = await client.post("/signature_request/send", json=payload)
            resp.raise_for_status()
            data = resp.json()["signature_request"]

            sig_id = data["signature_request_id"]
            signing_url = data["signing_url"] if "signing_url" in data else (
                f"https://app.hellosign.com/sign/{sig_id}"
            )

            logger.info("esign.dropbox.requested", sig_id=sig_id)

            return ESignatureResult(
                provider=ESignatureProvider.DROPBOX_SIGN,
                signature_request_id=sig_id,
                signing_url=signing_url,
                reference=request.reference,
                created_at=datetime.utcnow(),
            )

    async def _docusign(self, request: ESignatureRequest) -> ESignatureResult:
        """
        DocuSign — Entreprise, idéal pour les contrats B2B à fort enjeu.
        Nécessite un account_id + JWT OAuth (plus complexe que Dropbox Sign).
        Doc: https://developers.docusign.com
        """
        # DocuSign utilise OAuth JWT, pas une simple API key
        # Implémentation simplifiée pour illustration
        logger.info("esign.docusign.requested", reference=request.reference)

        return ESignatureResult(
            provider=ESignatureProvider.DOCUSIGN,
            signature_request_id=f"docusign-{request.reference}-mock",
            signing_url=f"https://demo.docusign.net/signing/{request.reference}",
            reference=request.reference,
            created_at=datetime.utcnow(),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────────────────────

def get_lre_provider(provider_name: Literal["AR24", "MAILEVA"] = "AR24") -> LREProvider:
    """Factory: retourne le provider LRE configuré."""
    sandbox = not settings.is_production

    if provider_name == "AR24":
        return AR24Provider(
            api_key=getattr(settings, "AR24_API_KEY", "sandbox-key"),
            api_secret=getattr(settings, "AR24_API_SECRET", "sandbox-secret"),
            sandbox=sandbox,
        )
    elif provider_name == "MAILEVA":
        return MailevaProvider(
            client_id=getattr(settings, "MAILEVA_CLIENT_ID", "sandbox-client"),
            client_secret=getattr(settings, "MAILEVA_CLIENT_SECRET", "sandbox-secret"),
            sandbox=sandbox,
        )
    raise ValueError(f"Unknown LRE provider: {provider_name}")


def get_esign_service() -> ESignatureService:
    """Factory: retourne le service de signature configuré."""
    return ESignatureService(
        provider=ESignatureProvider.DROPBOX_SIGN,
        api_key=getattr(settings, "DROPBOX_SIGN_API_KEY", "sandbox-key"),
        sandbox=not settings.is_production,
    )
