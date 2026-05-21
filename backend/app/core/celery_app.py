from celery import Celery
from celery.schedules import crontab

from app.core.config import settings


celery_app = Celery(
    "geoconces",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
    include=[
        "app.jobs.alerts",
        "app.jobs.sync",
        "app.jobs.reports",
        "app.jobs.notifications",
        "app.jobs.embeddings",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Lima",
    enable_utc=True,
    beat_schedule={
        # ── Alertas (diario 07:00 Lima) ──────────────────────────────────────
        "scan-status-changes-daily": {
            "task": "alerts.scan_status_changes",
            "schedule": crontab(hour=7, minute=0),
        },
        "scan-debt-daily": {
            "task": "alerts.scan_debt",
            "schedule": crontab(hour=7, minute=10),
        },
        "scan-overlaps-weekly": {
            "task": "alerts.scan_overlaps",
            "schedule": crontab(hour=6, minute=0, day_of_week="mon"),
        },
        "scan-expirations-daily": {
            "task": "alerts.scan_expirations",
            "schedule": crontab(hour=7, minute=20),
        },
        # ── Expediente OCR (martes y viernes 02:00) ─────────────────────────
        "extract-expedientes-tracked": {
            "task": "sync.extract_expedientes_tracked",
            "schedule": crontab(hour=2, minute=0, day_of_week="tue,fri"),
        },
        # ── Sync semanal (lunes 03:00) ───────────────────────────────────────
        "sync-sources-weekly": {
            "task": "sync.run_all_sources",
            "schedule": crontab(hour=3, minute=0, day_of_week="mon"),
        },
        # ── Enriquecimiento SIDEMCAT (cada noche 01:00, 150 concesiones) ────
        "enrich-sidemcat-nightly": {
            "task": "sync.enrich_sidemcat_batch",
            "schedule": crontab(hour=1, minute=0),
            "kwargs": {"batch_size": 150, "max_age_days": 30},
        },
        # ── Embeddings semánticos (lunes 04:00) ─────────────────────────────
        "generate-embeddings-weekly": {
            "task": "generate_embeddings_batch",
            "schedule": crontab(hour=4, minute=0, day_of_week="mon"),
        },
        # ── Mantenimiento ────────────────────────────────────────────────────
        "cleanup-old-reports-daily": {
            "task": "reports.cleanup_old",
            "schedule": crontab(hour=4, minute=0),
        },
        "drain-notifications-every-2min": {
            "task": "notifications.send_pending",
            "schedule": crontab(minute="*/2"),
        },
    },
)
