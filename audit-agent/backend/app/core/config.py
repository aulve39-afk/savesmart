"""
Configuration centralisée via Pydantic BaseSettings.
Toutes les valeurs sensibles viennent des variables d'environnement.
Les valeurs par défaut sont sûres pour le développement local UNIQUEMENT.
"""

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Interdit les variables d'env non déclarées (évite les surprises)
        extra="forbid",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "Audit-Agent AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ── API ───────────────────────────────────────────────────────────────────
    API_PREFIX: str = "/api/v1"
    # En production: liste stricte des origines autorisées
    # Pydantic v2 validates str→AnyHttpUrl at runtime; type: ignore avoids mypy false positives
    ALLOWED_ORIGINS: list[AnyHttpUrl] = Field(default=["http://localhost:3000"])  # type: ignore[list-item]

    # ── Sécurité ──────────────────────────────────────────────────────────────
    SECRET_KEY: SecretStr = Field(  # type: ignore[assignment]
        default="CHANGE-ME-IN-PRODUCTION-USE-openssl-rand-hex-32"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # ── Supabase (Région EU obligatoire pour RGPD) ────────────────────────────
    SUPABASE_URL: AnyHttpUrl = Field(default="https://your-project.supabase.co")  # type: ignore[assignment]
    SUPABASE_ANON_KEY: SecretStr = Field(default="your-anon-key")  # type: ignore[assignment]
    SUPABASE_SERVICE_KEY: SecretStr = Field(default="your-service-key")  # type: ignore[assignment]
    DATABASE_URL: SecretStr = Field(  # type: ignore[assignment]
        default="postgresql+asyncpg://user:pass@localhost:5432/auditdb"
    )

    # ── S3 (Région EU: eu-central-1 Frankfurt obligatoire pour RGPD) ─────────
    S3_BUCKET_NAME: str = "audit-agent-contracts-eu"
    S3_REGION: str = "eu-central-1"  # NE PAS CHANGER sans validation DPO
    AWS_ACCESS_KEY_ID: SecretStr = Field(default="your-access-key")  # type: ignore[assignment]
    AWS_SECRET_ACCESS_KEY: SecretStr = Field(default="your-secret-key")  # type: ignore[assignment]
    S3_SIGNED_URL_TTL_SECONDS: int = 900  # 15 minutes

    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: SecretStr = Field(default="sk-...")  # type: ignore[assignment]
    OPENAI_BASE_URL: AnyHttpUrl | None = None  # None = API directe OpenAI
    CLAUDE_MODEL: str = "gpt-4o"
    CLAUDE_MAX_TOKENS: int = 8192
    CLAUDE_TEMPERATURE: float = 0.0  # Déterminisme maximal pour extraction

    # Limites de sécurité: empêcher les coûts runaway
    MAX_INPUT_TOKENS_PER_CONTRACT: int = 300_000  # ~400 pages max
    MAX_COST_USD_PER_CONTRACT: float = 0.50  # Rejet au-delà

    # ── Celery / Redis ────────────────────────────────────────────────────────
    REDIS_URL: SecretStr = Field(default="redis://localhost:6379/0")  # type: ignore[assignment]
    CELERY_TASK_SOFT_TIME_LIMIT: int = 180  # 3 minutes: exception levée
    CELERY_TASK_TIME_LIMIT: int = 240  # 4 minutes: kill process

    # ── Upload ────────────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_MIME_TYPES: list[str] = ["application/pdf"]

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 20
    RATE_LIMIT_ANALYSIS_PER_HOUR: int = 10  # Limite analyse (coût élevé)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: SecretStr) -> SecretStr:
        """Interdit la clé par défaut en production."""
        # La validation de l'environnement se fait dans la factory get_settings()
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """
    Singleton thread-safe des settings.
    lru_cache garantit qu'on ne relit pas .env à chaque requête.
    """
    settings = Settings()

    # Guard de sécurité en production
    if settings.is_production:
        default_key = "CHANGE-ME-IN-PRODUCTION-USE-openssl-rand-hex-32"
        if settings.SECRET_KEY.get_secret_value() == default_key:
            raise RuntimeError(
                "SECRET_KEY must be set to a secure random value in production. "
                "Generate with: openssl rand -hex 32"
            )

    return settings
