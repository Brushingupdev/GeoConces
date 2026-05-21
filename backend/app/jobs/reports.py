"""Maintenance tasks for the reports module.

`cleanup_old_reports` deletes Report rows whose generated_at is older than
REPORTS_TTL_DAYS (default 7) and removes the corresponding files from disk.

Scheduled daily at 04:00 America/Lima (see core.celery_app).
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import Report

REPORTS_TTL_DAYS = 7


@celery_app.task(name="reports.cleanup_old")
def cleanup_old_reports(ttl_days: int = REPORTS_TTL_DAYS) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    db = SessionLocal()
    files_removed = 0
    rows_removed = 0
    errors = 0
    try:
        # generated_at is stored naive UTC; compare with naive cutoff.
        naive_cutoff = cutoff.replace(tzinfo=None)
        stale = (
            db.query(Report)
            .filter(Report.generated_at < naive_cutoff)
            .all()
        )
        for report in stale:
            if report.file_path:
                try:
                    Path(report.file_path).unlink(missing_ok=True)
                    files_removed += 1
                except OSError:
                    errors += 1
            db.delete(report)
            rows_removed += 1
        db.commit()
        return {
            "ttl_days": ttl_days,
            "rows_removed": rows_removed,
            "files_removed": files_removed,
            "errors": errors,
        }
    finally:
        db.close()
