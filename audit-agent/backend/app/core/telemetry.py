"""
Monitoring des coûts IA et observabilité OpenTelemetry.

Priorité absolue dès le jour 1:
  - Chaque appel Claude = un span tracé avec input_tokens, output_tokens, cost_usd
  - Alertes automatiques si un contrat dépasse les seuils de coût
  - Dashboard Prometheus pour visualiser l'évolution des coûts
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Generator

import structlog
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from prometheus_client import Counter, Gauge, Histogram

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# ── Métriques Prometheus ──────────────────────────────────────────────────────

# Compteur de tokens consommés (dimension: model, type=input/output)
AI_TOKENS_TOTAL = Counter(
    "audit_agent_ai_tokens_total",
    "Total AI tokens consumed",
    ["model", "token_type"],
)

# Coût cumulé en USD
AI_COST_USD_TOTAL = Counter(
    "audit_agent_ai_cost_usd_total",
    "Total estimated AI cost in USD",
    ["model"],
)

# Latence d'analyse par contrat
ANALYSIS_DURATION = Histogram(
    "audit_agent_analysis_duration_seconds",
    "Contract analysis duration",
    buckets=[5, 10, 20, 30, 60, 90, 120, 180],
)

# Nombre de clauses extraites par niveau de risque
CLAUSES_EXTRACTED = Counter(
    "audit_agent_clauses_extracted_total",
    "Clauses extracted by risk level",
    ["risk_level"],
)

# Gauge: nombre d'analyses en cours (pour le scaling auto)
ANALYSES_IN_PROGRESS = Gauge(
    "audit_agent_analyses_in_progress",
    "Number of analyses currently in progress",
)

# Compteur d'erreurs de validation (réponses IA invalides)
VALIDATION_RETRIES = Counter(
    "audit_agent_validation_retries_total",
    "AI response validation retries",
    ["reason"],
)

# Alertes de coût déclenchées
COST_ALERTS = Counter(
    "audit_agent_cost_alerts_total",
    "Cost threshold alerts triggered",
    ["alert_type"],
)

# ── Seuils d'alerte (voir TDD §5.2) ──────────────────────────────────────────

ALERT_THRESHOLDS = {
    "per_contract_usd": 0.30,  # $0.30 par contrat
    "daily_total_usd": 50.00,  # $50/jour
    "monthly_budget_pct": 0.80,  # 80% du budget mensuel
}

# Tracking du coût journalier (en mémoire, resetté à minuit)
_daily_cost_usd: float = 0.0
_daily_reset_day: int = 0


def track_ai_call(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    contract_id: str | None = None,
) -> None:
    """
    Enregistre les métriques d'un appel IA.
    Appelé après chaque appel à Claude dans ContractAnalyzer._call_claude().
    """
    global _daily_cost_usd, _daily_reset_day

    # Métriques Prometheus
    AI_TOKENS_TOTAL.labels(model=model, token_type="input").inc(input_tokens)
    AI_TOKENS_TOTAL.labels(model=model, token_type="output").inc(output_tokens)
    AI_COST_USD_TOTAL.labels(model=model).inc(cost_usd)

    # Tracking du coût journalier
    import datetime

    today = datetime.date.today().toordinal()
    if today != _daily_reset_day:
        _daily_cost_usd = 0.0
        _daily_reset_day = today
    _daily_cost_usd += cost_usd

    # ── Vérification des seuils d'alerte ──────────────────────────────────
    if cost_usd > ALERT_THRESHOLDS["per_contract_usd"]:
        COST_ALERTS.labels(alert_type="per_contract").inc()
        logger.warning(
            "cost_alert.per_contract",
            contract_id=contract_id,
            cost_usd=cost_usd,
            threshold=ALERT_THRESHOLDS["per_contract_usd"],
        )

    if _daily_cost_usd > ALERT_THRESHOLDS["daily_total_usd"]:
        COST_ALERTS.labels(alert_type="daily_total").inc()
        logger.error(
            "cost_alert.daily_total",
            daily_cost_usd=_daily_cost_usd,
            threshold=ALERT_THRESHOLDS["daily_total_usd"],
        )

    logger.debug(
        "ai_call.tracked",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=round(cost_usd, 6),
        daily_total_usd=round(_daily_cost_usd, 4),
    )


@contextmanager
def analysis_span(
    contract_id: str,
    filename: str,
) -> Generator[None, None, None]:
    """
    Context manager pour tracer une analyse complète.
    Usage:
        with analysis_span(contract_id, filename):
            result = await analyzer.analyze(...)
    """
    ANALYSES_IN_PROGRESS.inc()
    start = time.monotonic()

    try:
        yield
    finally:
        duration = time.monotonic() - start
        ANALYSIS_DURATION.observe(duration)
        ANALYSES_IN_PROGRESS.dec()

        logger.info(
            "analysis_span.complete",
            contract_id=contract_id,
            duration_s=round(duration, 2),
        )


def setup_telemetry(otlp_endpoint: str | None = None) -> None:
    """
    Configure OpenTelemetry avec export vers un collecteur OTLP.
    En production: pointer vers Grafana Cloud ou Datadog.
    En dev: utiliser Jaeger local (docker run -p 4317:4317 jaegertracing/all-in-one).
    """
    if not otlp_endpoint:
        logger.info("telemetry.otlp_disabled", message="No OTLP endpoint configured")
        return

    provider = TracerProvider()
    exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    logger.info("telemetry.otlp_enabled", endpoint=otlp_endpoint)
