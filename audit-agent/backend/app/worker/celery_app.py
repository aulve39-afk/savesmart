"""Configuration Celery pour les analyses de contrats longues (jusqu'à 4 minutes)."""
from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "audit_agent",
    broker=settings.REDIS_URL.get_secret_value(),
    backend=settings.REDIS_URL.get_secret_value(),
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    # Sérialisation JSON (pas pickle: sécurité)
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,

    # Timeouts (voir TDD §5.3)
    task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,

    # Retry automatique sur les erreurs transitoires (réseau, rate limit)
    task_max_retries=3,
    task_default_retry_delay=5,  # secondes

    # Résultats expirés après 24h (ne pas saturer Redis)
    result_expires=86400,

    # Priorités: 0 (basse) → 9 (haute)
    task_queue_max_priority=10,
    task_default_priority=5,

    # Worker: 1 tâche à la fois par worker (analyse CPU+réseau intensive)
    worker_concurrency=2,
    worker_prefetch_multiplier=1,

    # Monitoring Flower
    worker_send_task_events=True,
    task_send_sent_event=True,
)
