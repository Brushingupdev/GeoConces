"""Scoring helpers for risk and opportunity ranking."""

from datetime import datetime, timezone
from typing import List, Tuple

from app.models import Concession, ConcessionStatus


def score_opportunity(concession: Concession, now: datetime | None = None) -> Tuple[int, List[str]]:
    """Score a concession as an opportunity (0-100) and return the factors driving it."""
    if now is None:
        now = datetime.now(timezone.utc)

    score = 0
    factors: List[str] = []

    status = concession.status
    if status == ConcessionStatus.expired:
        score += 50
        factors.append("Concesión vencida")
    elif status == ConcessionStatus.pending:
        score += 30
        factors.append("Estado pendiente")
    elif status == ConcessionStatus.suspended:
        score += 20
        factors.append("Suspendida")

    expiration = concession.expiration_date
    if expiration is not None:
        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=timezone.utc)
        days_to_exp = (expiration - now).days
        if days_to_exp < 0:
            score += 20
            factors.append(f"Venció hace {abs(days_to_exp)} días")
        elif days_to_exp <= 30:
            score += 25
            factors.append(f"Vence en {days_to_exp} días")
        elif days_to_exp <= 90:
            score += 15
            factors.append(f"Vence en {days_to_exp} días")
        elif days_to_exp <= 180:
            score += 5
            factors.append(f"Vence en {days_to_exp} días")

    area = concession.area_hectares or 0
    if area >= 1000:
        score += 15
        factors.append(f"Área grande ({int(area)} ha)")
    elif area >= 500:
        score += 10
        factors.append(f"Área media ({int(area)} ha)")
    elif area >= 100:
        score += 5

    if not concession.holder_ruc:
        score += 10
        factors.append("Sin titular registrado")

    return min(score, 100), factors
