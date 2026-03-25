"""
Dépendances FastAPI réutilisables (injection de dépendances).

Pattern: chaque dépendance est une fonction async qui peut être injectée
via Depends() dans n'importe quelle route.

Dépendances disponibles:
  - get_current_tenant_id()  → UUID du tenant (extrait du JWT)
  - get_current_user_id()    → UUID de l'utilisateur
  - require_auth()            → Combinaison user + tenant (le plus courant)
  - get_db()                  → Session Supabase (à connecter)
  - RateLimiter               → Limite par endpoint (slowapi)
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.config import get_settings
from app.core.security import decode_access_token, extract_tenant_id

logger = structlog.get_logger(__name__)
settings = get_settings()

# ── Schéma d'authentification Bearer ─────────────────────────────────────────

# auto_error=False: on gère nous-mêmes l'erreur pour un message plus clair
bearer_scheme = HTTPBearer(auto_error=False)


# ── Dépendances JWT ───────────────────────────────────────────────────────────


async def get_token_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> dict:
    """
    Extrait et valide le token Bearer depuis le header Authorization.

    Raises:
        HTTP 401: Si le token est absent, invalide, ou expiré.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        return payload
    except JWTError as e:
        logger.warning("auth.jwt_invalid", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_current_user_id(
    payload: Annotated[dict, Depends(get_token_payload)],
) -> UUID:
    """Extrait l'UUID de l'utilisateur courant depuis le JWT."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier (sub claim)",
        )
    try:
        return UUID(str(sub))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
        )


async def get_current_tenant_id(
    payload: Annotated[dict, Depends(get_token_payload)],
) -> UUID:
    """
    Extrait le tenant_id depuis le JWT.
    C'est le mécanisme principal d'isolation RGPD multi-tenant.

    En production: cette valeur est automatiquement utilisée pour toutes
    les requêtes Supabase (RLS filtre par tenant_id).
    """
    try:
        return extract_tenant_id(payload)
    except ValueError as e:
        logger.error("auth.tenant_id_missing", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing tenant identifier",
        ) from e


# ── Dépendances combinées ─────────────────────────────────────────────────────


class AuthContext:
    """Contexte d'authentification complet: user + tenant."""

    def __init__(self, user_id: UUID, tenant_id: UUID) -> None:
        self.user_id = user_id
        self.tenant_id = tenant_id


async def require_auth(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
) -> AuthContext:
    """
    Dépendance combinée: valide l'auth et retourne user_id + tenant_id.

    Usage dans une route:
        @router.post("/contracts")
        async def create_contract(auth: Annotated[AuthContext, Depends(require_auth)]):
            tenant_id = auth.tenant_id
    """
    return AuthContext(user_id=user_id, tenant_id=tenant_id)


# ── Dépendance de développement (bypass auth) ────────────────────────────────


async def get_dev_tenant_id() -> UUID:
    """
    Tenant ID fixe pour le développement local.
    ATTENTION: NE JAMAIS utiliser en production.
    """
    import uuid

    # UUID déterministe pour faciliter les tests locaux
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_tenant_id_dep() -> "type":
    """
    Factory: retourne la bonne dépendance selon l'environnement.
    En dev: bypass de l'auth. En prod: JWT obligatoire.
    """
    if settings.ENVIRONMENT == "development" and settings.DEBUG:
        logger.warning(
            "auth.dev_bypass_active",
            message="JWT authentication bypassed — development mode only",
        )
        return get_dev_tenant_id  # type: ignore[return-value]
    return get_current_tenant_id  # type: ignore[return-value]


# Type alias pratique pour les routes
TenantDep = Annotated[UUID, Depends(get_current_tenant_id)]
UserDep = Annotated[UUID, Depends(get_current_user_id)]
AuthDep = Annotated[AuthContext, Depends(require_auth)]
