"""Email sender abstraction.

If RESEND_API_KEY is set, emails go out via Resend's HTTP API.
Otherwise the sender is a no-op that just logs — useful for local dev so the
notification pipeline can be tested end-to-end without external credentials.
"""

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


class EmailSendError(Exception):
    pass


def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
) -> dict:
    """Send a plain-text email. Returns provider response or a dev stub.

    Raises EmailSendError on provider failure; callers should catch and mark
    the Notification as failed (so it can be retried later).
    """
    api_key = settings.RESEND_API_KEY
    if not api_key:
        logger.info(
            "[email-dev] to=%s subject=%r body_len=%d  (no RESEND_API_KEY set; skipping send)",
            to,
            subject,
            len(body),
        )
        return {"provider": "noop", "status": "logged"}

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "text": body,
    }
    final_reply_to = reply_to or settings.EMAIL_REPLY_TO
    if final_reply_to:
        payload["reply_to"] = [final_reply_to]

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                RESEND_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 400:
            raise EmailSendError(
                f"Resend returned {resp.status_code}: {resp.text[:200]}"
            )
        return {"provider": "resend", "response": resp.json()}
    except httpx.HTTPError as exc:
        raise EmailSendError(f"HTTP error talking to Resend: {exc}") from exc
