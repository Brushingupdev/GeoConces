"""Background sender that drains the Notification queue.

Runs every 2 minutes via celery-beat. Picks all Notifications with
status='pending' and channel='email', sends them through the configured
provider, and marks them as sent or failed accordingly.

Failures are kept in 'failed' state so they can be inspected; a simple
retry policy (max 3 attempts) is enforced via the `retries` field stored
in the JSON body fallback, or implicitly by leaving them as pending if
unrecoverable transient errors are detected. For Sprint B we keep this
simple: one attempt, mark failed on any error.
"""

from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import Notification, User
from app.notifications.sender import EmailSendError, send_email


@celery_app.task(name="notifications.send_pending")
def send_pending_notifications() -> dict:
    db = SessionLocal()
    sent = 0
    failed = 0
    skipped = 0
    try:
        pending = (
            db.query(Notification)
            .filter(
                Notification.status == "pending",
                Notification.channel == "email",
            )
            .limit(100)
            .all()
        )
        for notif in pending:
            user = db.query(User).filter(User.id == notif.user_id).first()
            if not user or not user.email:
                notif.status = "failed"
                skipped += 1
                continue
            try:
                send_email(
                    to=user.email,
                    subject=notif.subject or "Notificación de GeoConces",
                    body=notif.body or "",
                )
                notif.status = "sent"
                notif.sent_at = datetime.now(timezone.utc).replace(tzinfo=None)
                sent += 1
            except EmailSendError:
                notif.status = "failed"
                failed += 1
        db.commit()
        return {"sent": sent, "failed": failed, "skipped": skipped}
    finally:
        db.close()
