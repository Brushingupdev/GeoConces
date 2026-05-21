"""Scheduled jobs that detect changes and create alerts.

Estrategia de seguimiento:
  - Por RUC  : concesiones WHERE holder_ruc IN (tracked rucs)
  - Por nombre: concesiones WHERE holder_name IN (tracked holder_names)
  Ambos caminos se fusionan antes de generar alertas.

Tipos de alerta:
  - status_change : concesión de titular rastreado dejó de estar activa
  - debt          : concesión tiene deuda de vigencia según SIDEMCAT
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Set, Tuple

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import Alert, Concession, ConcessionStatus, Notification, TrackedRuc

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enqueue_email(db, *, user_id: int, subject: str, body: str) -> None:
    db.add(Notification(
        user_id=user_id,
        channel="email",
        status="pending",
        subject=subject,
        body=body,
    ))


def _alert_exists(db, *, user_id: int, concession_id: int,
                  alert_type: str, since_days: int = 0) -> bool:
    """Devuelve True si ya existe una alerta de ese tipo reciente."""
    q = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.related_concession_id == concession_id,
        Alert.alert_type == alert_type,
    )
    if since_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=since_days)
        q = q.filter(Alert.created_at >= cutoff)
    return q.first() is not None


def _build_user_map(db) -> Tuple[Dict[str, List[int]], Dict[str, List[int]]]:
    """Devuelve (ruc→[user_ids], holder_name→[user_ids]) desde tracked_rucs."""
    ruc_map: Dict[str, List[int]]  = {}
    name_map: Dict[str, List[int]] = {}
    for t in db.query(TrackedRuc).all():
        if t.ruc:
            ruc_map.setdefault(t.ruc, []).append(t.user_id)
        if t.holder_name:
            name_map.setdefault(t.holder_name.upper(), []).append(t.user_id)
    return ruc_map, name_map


def _users_for_concession(
    c: Concession,
    ruc_map: Dict[str, List[int]],
    name_map: Dict[str, List[int]],
) -> Set[int]:
    """Devuelve el set de user_ids que rastrean esta concesión (por RUC o nombre)."""
    users: Set[int] = set()
    if c.holder_ruc and c.holder_ruc in ruc_map:
        users.update(ruc_map[c.holder_ruc])
    if c.holder_name and c.holder_name.upper() in name_map:
        users.update(name_map[c.holder_name.upper()])
    return users


# ── Task: cambios de estado ───────────────────────────────────────────────────

@celery_app.task(name="alerts.scan_status_changes")
def scan_status_changes() -> Dict[str, int]:
    """Alerta cuando una concesión rastreada dejó de estar activa."""
    db = SessionLocal()
    created = 0
    try:
        ruc_map, name_map = _build_user_map(db)
        if not ruc_map and not name_map:
            return {"created": 0}

        rucs  = list(ruc_map.keys())
        names = [n for n in name_map]   # ya en upper

        from sqlalchemy import func, or_
        query = db.query(Concession).filter(
            Concession.status != ConcessionStatus.active
        )
        filters = []
        if rucs:
            filters.append(Concession.holder_ruc.in_(rucs))
        if names:
            filters.append(func.upper(Concession.holder_name).in_(names))
        if not filters:
            return {"created": 0}
        query = query.filter(or_(*filters))

        for c in query.all():
            user_ids = _users_for_concession(c, ruc_map, name_map)
            for uid in user_ids:
                if _alert_exists(db, user_id=uid, concession_id=c.id,
                                 alert_type="status_change"):
                    continue
                title   = f"{c.code} cambió a {c.status.value}"
                message = (
                    f"La concesión {c.name} ({c.code}) del titular "
                    f"{c.holder_name or c.holder_ruc} ahora está en estado "
                    f"{c.status.value}."
                )
                db.add(Alert(
                    user_id=uid,
                    alert_type="status_change",
                    title=title,
                    message=message,
                    related_concession_id=c.id,
                ))
                _enqueue_email(db, user_id=uid, subject=title, body=message)
                created += 1

        db.commit()
        logger.info("scan_status_changes: %d nuevas alertas", created)
        return {"created": created}
    finally:
        db.close()


# ── Task: deuda de vigencia (SIDEMCAT) ────────────────────────────────────────

@celery_app.task(name="alerts.scan_debt")
def scan_debt() -> Dict[str, int]:
    """Alerta cuando una concesión rastreada tiene deuda de derecho de vigencia.

    Solo revisa concesiones que ya tienen `sidemcat_data` en caché.
    La alerta se repite máximo una vez cada 30 días por concesión/usuario.
    """
    db = SessionLocal()
    created = 0
    try:
        ruc_map, name_map = _build_user_map(db)
        if not ruc_map and not name_map:
            return {"created": 0}

        from sqlalchemy import func, or_
        filters = []
        if ruc_map:
            filters.append(Concession.holder_ruc.in_(list(ruc_map.keys())))
        if name_map:
            filters.append(func.upper(Concession.holder_name).in_(list(name_map.keys())))

        concessions = (
            db.query(Concession)
            .filter(or_(*filters))
            .filter(Concession.sidemcat_data.isnot(None))
            .all()
        )

        for c in concessions:
            sidemcat = c.sidemcat_data or {}
            if not sidemcat.get("has_debt"):
                continue

            user_ids = _users_for_concession(c, ruc_map, name_map)
            for uid in user_ids:
                # Máximo una alerta de deuda cada 30 días por concesión
                if _alert_exists(db, user_id=uid, concession_id=c.id,
                                 alert_type="debt", since_days=30):
                    continue

                # Calcular años con deuda
                vigencias = sidemcat.get("vigencias") or []
                years_debt = [
                    str(v.get("year", ""))
                    for v in vigencias
                    if v.get("balance") and "-" in str(v.get("balance", ""))
                ]
                years_str = ", ".join(years_debt) if years_debt else "año(s) pendiente(s)"

                title   = f"{c.code} tiene deuda de vigencia ({years_str})"
                message = (
                    f"La concesión {c.name} ({c.code}) del titular "
                    f"{c.holder_name or c.holder_ruc} tiene deuda de derecho "
                    f"de vigencia en: {years_str}. El no pago por 2 años "
                    f"consecutivos puede causar caducidad de la concesión."
                )
                db.add(Alert(
                    user_id=uid,
                    alert_type="debt",
                    title=title,
                    message=message,
                    related_concession_id=c.id,
                ))
                _enqueue_email(db, user_id=uid, subject=title, body=message)
                created += 1

        db.commit()
        logger.info("scan_debt: %d nuevas alertas de deuda", created)
        return {"created": created}
    finally:
        db.close()


# ── Task: superposiciones geográficas ────────────────────────────────────────

@celery_app.task(name="alerts.scan_overlaps")
def scan_overlaps() -> Dict[str, int]:
    """Escanea superposiciones PostGIS para concesiones rastreadas."""
    from app.overlaps.service import scan_overlaps_for_tracked
    db = SessionLocal()
    try:
        result = scan_overlaps_for_tracked(db)
        logger.info("scan_overlaps: %s", result)
        return result
    finally:
        db.close()


# ── Task: scan expirations (legacy — mantener para compatibilidad) ─────────────

@celery_app.task(name="alerts.scan_expirations")
def scan_expirations() -> Dict[str, int]:
    """Alerta para concesiones con expiration_date próxima (las pocas que la tienen).

    En el sistema peruano las concesiones no tienen fecha fija de vencimiento,
    por lo que este job solo aplica a los registros que sí tienen el campo.
    """
    WINDOWS = (30, 90)
    db = SessionLocal()
    created = 0
    try:
        ruc_map, name_map = _build_user_map(db)
        if not ruc_map and not name_map:
            return {"created": 0}

        from sqlalchemy import func, or_
        filters = []
        if ruc_map:
            filters.append(Concession.holder_ruc.in_(list(ruc_map.keys())))
        if name_map:
            filters.append(func.upper(Concession.holder_name).in_(list(name_map.keys())))

        concessions = (
            db.query(Concession)
            .filter(or_(*filters))
            .filter(Concession.expiration_date.isnot(None))
            .all()
        )

        now = datetime.now(timezone.utc)
        for c in concessions:
            exp = c.expiration_date
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            days = (exp - now).days
            window = next((w for w in WINDOWS if 0 <= days <= w), None)
            if window is None:
                continue

            user_ids = _users_for_concession(c, ruc_map, name_map)
            for uid in user_ids:
                if _alert_exists(db, user_id=uid, concession_id=c.id,
                                 alert_type="expiration", since_days=window):
                    continue
                title   = f"{c.code} vence en {days} días"
                message = (
                    f"La concesión {c.name} ({c.code}) del titular "
                    f"{c.holder_name or c.holder_ruc} vence el {exp.date()}."
                )
                db.add(Alert(
                    user_id=uid,
                    alert_type="expiration",
                    title=title,
                    message=message,
                    related_concession_id=c.id,
                ))
                _enqueue_email(db, user_id=uid, subject=title, body=message)
                created += 1

        db.commit()
        logger.info("scan_expirations: %d nuevas alertas", created)
        return {"created": created}
    finally:
        db.close()
