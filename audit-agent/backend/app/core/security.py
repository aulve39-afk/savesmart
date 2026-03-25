"""
Sécurité: JWT, RBAC, validation des API keys.

Architecture:
  - JWT HS256 pour l'auth des utilisateurs (via Supabase Auth)
  - API Keys pour les intégrations machine-à-machine
  - tenant_id extrait du JWT → isolation RGPD garantie par RLS Supabase

Dépendances: python-jose[cryptography], passlib[bcrypt]
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# ── Hachage des mots de passe ─────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash bcrypt."""
    return bool(pwd_context.verify(plain_password, hashed_password))


def hash_password(password: str) -> str:
    """Hache un mot de passe avec bcrypt (work factor 12)."""
    return str(pwd_context.hash(password))


# ── JWT ───────────────────────────────────────────────────────────────────────


def create_access_token(
    subject: str,
    tenant_id: UUID,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Crée un JWT d'accès signé HS256.

    Claims standards:
      - sub: ID de l'utilisateur
      - tenant_id: isolation RGPD par client (claim custom)
      - exp: expiration
      - iat: date d'émission

    Args:
        subject: ID utilisateur (UUID string)
        tenant_id: Identifiant du tenant pour la RLS
        expires_delta: Durée de validité (défaut: ACCESS_TOKEN_EXPIRE_MINUTES)
        extra_claims: Claims supplémentaires (ex: roles, permissions)
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = {
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "iat": now,
        "exp": expire,
        "type": "access",
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.SECRET_KEY.get_secret_value(),
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Décode et valide un JWT d'accès.

    Raises:
        JWTError: Si le token est invalide, expiré, ou mal signé.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=[settings.ALGORITHM],
        )

        # Vérification du type de token
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")

        return dict(payload)

    except JWTError as e:
        logger.warning("jwt.decode_failed", error=str(e))
        raise


def extract_tenant_id(token_payload: dict[str, Any]) -> UUID:
    """
    Extrait le tenant_id du payload JWT.

    Raises:
        ValueError: Si tenant_id manquant ou invalide dans le token.
    """
    tenant_id_str = token_payload.get("tenant_id")
    if not tenant_id_str:
        raise ValueError("Missing tenant_id claim in JWT")

    try:
        return UUID(str(tenant_id_str))
    except ValueError:
        raise ValueError(f"Invalid tenant_id format in JWT: {tenant_id_str!r}")


# ── API Keys ──────────────────────────────────────────────────────────────────


def generate_api_key_hash(api_key: str) -> str:
    """
    Hash une API key pour stockage sécurisé.
    On ne stocke JAMAIS la clé en clair, uniquement son hash.
    """
    return str(pwd_context.hash(api_key))


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Vérifie une API key contre son hash."""
    return bool(pwd_context.verify(plain_key, hashed_key))


# ── Validation de tokens Supabase ─────────────────────────────────────────────


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    """
    Décode un JWT émis par Supabase Auth.

    Supabase utilise le même ALGORITHM (HS256) mais avec le SUPABASE_JWT_SECRET
    (distinct du SECRET_KEY de l'application). En production, utiliser
    SUPABASE_JWT_SECRET depuis les settings.

    Note: En développement, on peut utiliser le même SECRET_KEY pour simplifier.
    """
    try:
        # Supabase JWT secret = SUPABASE_ANON_KEY ou un secret dédié
        # Pour l'instant: même secret que l'app (valide en dev)
        payload = jwt.decode(
            token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},  # Supabase peut ne pas avoir d'audience
        )
        return dict(payload)
    except JWTError as e:
        logger.warning("supabase_jwt.decode_failed", error=str(e))
        raise
