"""
Modèles SQLModel pour la persistance Supabase (PostgreSQL).

Architecture:
  - SQLModel combine Pydantic v2 et SQLAlchemy
  - Row Level Security (RLS) Supabase assure l'isolation par tenant
  - Toutes les tables ont un tenant_id non-nullable (isolation RGPD)
  - Les colonnes sensibles (pii_mapping) sont chiffrées côté application

Tables:
  - contracts         → Métadonnées du PDF uploadé
  - analysis_results  → Résultats des analyses IA (JSON)
  - analysis_jobs     → État des jobs Celery (dénormalisé pour perf)

SQL de migration (Supabase):
  Voir /backend/migrations/001_initial_schema.sql
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


# ── Base ──────────────────────────────────────────────────────────────────────


class TimestampMixin(SQLModel):
    """Colonnes created_at / updated_at automatiques."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Date de création (UTC)",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Dernière modification (UTC)",
    )


# ── Table: contracts ──────────────────────────────────────────────────────────


class ContractDB(TimestampMixin, table=True):
    """
    Métadonnées d'un contrat PDF uploadé.

    Le fichier PDF lui-même est stocké dans S3:
      s3://{bucket}/{tenant_id}/{contract_id}/original.pdf

    Politique RLS Supabase:
      CREATE POLICY "tenant_isolation" ON contracts
        FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');
    """

    __tablename__ = "contracts"  # type: ignore[assignment]

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Isolation RGPD: NON-NULLABLE, indexé pour la RLS
    tenant_id: UUID = Field(
        index=True,
        description="ID du client — filtre RLS Supabase",
    )

    # Référence S3
    s3_key: str = Field(
        max_length=500,
        description="Clé S3 du PDF: {tenant_id}/{contract_id}/original.pdf",
    )
    original_filename: str = Field(max_length=255)
    file_size_bytes: int = Field(ge=0)
    mime_type: str = Field(default="application/pdf", max_length=100)

    # Statut
    analysis_status: str = Field(
        default="pending",
        description="pending | processing | completed | failed | requires_review",
    )

    # Référence vers le résultat (null jusqu'à la complétion de l'analyse)
    analysis_result_id: UUID | None = Field(default=None, foreign_key="analysis_results.id")


# ── Table: analysis_results ───────────────────────────────────────────────────


class AnalysisResultDB(TimestampMixin, table=True):
    """
    Résultat complet d'une analyse IA stocké en JSON.

    Le champ `result_json` contient l'AnalysisResult Pydantic sérialisé.
    Cela permet de récupérer le résultat complet en une seule requête SQL
    sans jointures complexes.

    Pour les recherches avancées (ex: "tous les contrats avec risque > 70"),
    les colonnes dénormalisées global_risk_score, risk_level sont indexées.
    """

    __tablename__ = "analysis_results"  # type: ignore[assignment]

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Isolation RGPD
    tenant_id: UUID = Field(index=True)

    # Référence vers le contrat source
    contract_id: UUID = Field(
        foreign_key="contracts.id",
        index=True,
        description="Lien vers la table contracts",
    )

    # Résultat complet sérialisé (AnalysisResult.model_dump(mode='json'))
    result_json: dict[str, Any] = Field(
        sa_column_kwargs={"type_": "JSONB"},
        description="AnalysisResult Pydantic complet — requêtable via JSONB operators",
    )

    # Colonnes dénormalisées pour les filtres/tris côté DB (évite de parser le JSON)
    global_risk_score: float = Field(ge=0.0, le=100.0, index=True)
    risk_level: str = Field(max_length=20, index=True)  # LOW | MEDIUM | HIGH | CRITICAL
    clauses_count: int = Field(ge=0, default=0)
    critical_clauses_count: int = Field(ge=0, default=0)
    page_count: int = Field(ge=1, default=1)
    processing_time_seconds: float = Field(ge=0.0, default=0.0)
    estimated_cost_usd: float = Field(ge=0.0, default=0.0)

    # Version du modèle d'analyse (pour les migrations de données)
    analysis_version: str = Field(default="2.1.0", max_length=20)


# ── Table: analysis_jobs ──────────────────────────────────────────────────────


class AnalysisJobDB(TimestampMixin, table=True):
    """
    État d'un job Celery d'analyse.

    Complémentaire au state Celery/Redis:
    - Redis: état temps-réel (TTL 24h)
    - Cette table: historique permanent pour audit et debug

    Utile pour:
    - Afficher l'historique des analyses dans l'UI
    - Calculer les métriques de coût mensuelles
    - Débugger les failures (error_message persisté)
    """

    __tablename__ = "analysis_jobs"  # type: ignore[assignment]

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Isolation RGPD
    tenant_id: UUID = Field(index=True)

    # Identifiants
    celery_task_id: str = Field(max_length=255, index=True, description="ID Celery de la tâche")
    contract_id: UUID = Field(foreign_key="contracts.id", index=True)

    # État
    status: str = Field(
        default="pending",
        max_length=30,
        index=True,
        description="pending | processing | completed | failed | requires_review",
    )
    progress_pct: int = Field(default=0, ge=0, le=100)
    current_step: str = Field(default="", max_length=200)

    # Timestamps de traitement
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)

    # Résultat ou erreur
    analysis_result_id: UUID | None = Field(default=None, foreign_key="analysis_results.id")
    error_message: str | None = Field(default=None, max_length=1000)

    # Métriques (remplies à la complétion)
    processing_time_seconds: float | None = Field(default=None)
    estimated_cost_usd: float | None = Field(default=None)
    retry_count: int = Field(default=0, ge=0)


# ── Script de migration SQL ───────────────────────────────────────────────────

MIGRATION_SQL = """
-- ============================================================
-- Migration 001: Schéma initial Audit-Agent
-- Exécuter via le dashboard Supabase ou psql
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Table contracts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    analysis_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    analysis_result_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);

-- RLS: isolation totale par tenant
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON contracts
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ── Table analysis_results ───────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL,
    global_risk_score NUMERIC(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    clauses_count INTEGER NOT NULL DEFAULT 0,
    critical_clauses_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 1,
    processing_time_seconds NUMERIC(8,2) NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(8,6) NOT NULL DEFAULT 0,
    analysis_version VARCHAR(20) NOT NULL DEFAULT '2.1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_tenant ON analysis_results(tenant_id);
CREATE INDEX idx_analysis_results_contract ON analysis_results(contract_id);
CREATE INDEX idx_analysis_results_risk ON analysis_results(global_risk_score DESC);

-- RLS
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON analysis_results
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ── Table analysis_jobs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    celery_task_id VARCHAR(255) NOT NULL,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    progress_pct INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(200) NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    analysis_result_id UUID REFERENCES analysis_results(id),
    error_message VARCHAR(1000),
    processing_time_seconds NUMERIC(8,2),
    estimated_cost_usd NUMERIC(8,6),
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_jobs_tenant ON analysis_jobs(tenant_id);
CREATE INDEX idx_analysis_jobs_celery ON analysis_jobs(celery_task_id);
CREATE INDEX idx_analysis_jobs_contract ON analysis_jobs(contract_id);
CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);

-- RLS
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON analysis_jobs
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ── Trigger: updated_at automatique ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_analysis_results_updated_at
    BEFORE UPDATE ON analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_analysis_jobs_updated_at
    BEFORE UPDATE ON analysis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
"""
