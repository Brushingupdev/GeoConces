"""Single shared rate limiter instance used across the app.

Both `main.py` (attaches it to app.state) and route modules (use the
decorator) must import the same instance, so state and config stay aligned.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
)
