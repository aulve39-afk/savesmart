"""
Point d'entrée FastAPI pour Audit-Agent AI.
Initialisation: middleware CORS, rate limiting, observabilité, routes.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes.contracts import router as contracts_router
from app.core.config import get_settings

settings = get_settings()
logger = structlog.get_logger(__name__)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup/shutdown hooks."""
    logger.info("startup", env=settings.ENVIRONMENT, version=settings.APP_VERSION)
    yield
    logger.info("shutdown")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    # Désactiver la doc en production (sécurité)
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Middleware CORS ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in settings.ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
    # Cache la réponse OPTIONS pendant 10 minutes
    max_age=600,
)

# ── Rate Limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── Métriques Prometheus ──────────────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(contracts_router, prefix=settings.API_PREFIX)


@app.get("/health", tags=["monitoring"])
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok", "version": settings.APP_VERSION})


# ── Gestion globale des erreurs ───────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handler global: log l'erreur complète côté serveur,
    retourne un message générique côté client (pas de stack trace en prod).
    """
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )

    detail = str(exc) if settings.DEBUG else "Internal server error"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail},
    )
