"""Background and scheduled jobs live here.

Importing this package registers the Celery tasks with the worker.
"""

from app.core.celery_app import celery_app
from app.jobs import alerts as alerts_tasks
from app.jobs import sync as sync_tasks

__all__ = ("celery_app", "alerts_tasks", "sync_tasks")
