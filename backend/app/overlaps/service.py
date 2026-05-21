"""Detección de superposiciones geográficas entre concesiones.

Usa ST_Intersects + ST_Intersection con PostGIS.
Filtra roces de borde (área < MIN_OVERLAP_M2).
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models import Alert, Concession, ConcessionGeometry, TrackedRuc

logger = logging.getLogger(__name__)

# Área mínima de superposición para considerarla real (100 m²)
MIN_OVERLAP_M2 = 100


def find_overlapping(
    db: Session,
    concession_id: int,
    limit: int = 20,
) -> list[dict]:
    """Encuentra concesiones que se superponen con una dada.

    Returns lista de dicts con: id, code, name, status, area_overlap_ha.
    """
    rows = db.execute(text("""
        SELECT
            c.id,
            c.code,
            c.name,
            c.status,
            c.holder_name,
            c.concession_type,
            ROUND(
                (ST_Area(
                    ST_Intersection(
                        ST_MakeValid(a.geom),
                        ST_MakeValid(b.geom)
                    )::geography
                ) / 10000.0)::numeric, 4
            ) AS area_overlap_ha
        FROM concession_geometries a
        JOIN concession_geometries b ON b.concession_id != :cid
        JOIN concessions c ON c.id = b.concession_id
        WHERE a.concession_id = :cid
          AND ST_IsValid(a.geom) AND ST_IsValid(b.geom)
          AND ST_Intersects(a.geom, b.geom)
          AND NOT ST_Touches(a.geom, b.geom)
          AND ST_Area(
                ST_Intersection(ST_MakeValid(a.geom), ST_MakeValid(b.geom))::geography
              ) > :min_area
        ORDER BY area_overlap_ha DESC
        LIMIT :limit
    """), {"cid": concession_id, "min_area": MIN_OVERLAP_M2, "limit": limit})

    return [
        {
            "id":             r.id,
            "code":           r.code,
            "name":           r.name,
            "status":         r.status,
            "holder_name":    r.holder_name,
            "concession_type": r.concession_type,
            "area_overlap_ha": float(r.area_overlap_ha),
        }
        for r in rows
    ]


def scan_overlaps_for_tracked(db: Session) -> dict:
    """Escanea superposiciones para todas las concesiones rastreadas y crea alertas."""
    from sqlalchemy import or_

    tracked = db.query(TrackedRuc).all()
    if not tracked:
        return {"scanned": 0, "alerts_created": 0}

    rucs  = [t.ruc         for t in tracked if t.ruc]
    names = [t.holder_name.upper() for t in tracked if t.holder_name]

    filters = []
    if rucs:
        filters.append(Concession.holder_ruc.in_(rucs))
    if names:
        filters.append(func.upper(Concession.holder_name).in_(names))
    if not filters:
        return {"scanned": 0, "alerts_created": 0}

    concessions = (
        db.query(Concession)
        .join(ConcessionGeometry, Concession.id == ConcessionGeometry.concession_id)
        .filter(or_(*filters))
        .all()
    )

    scanned = 0
    alerts_created = 0
    user_map: dict[int, list[int]] = {}  # concession_id → [user_ids]
    for t in tracked:
        concessions_for_t = [
            c for c in concessions
            if (t.ruc and c.holder_ruc == t.ruc)
            or (t.holder_name and c.holder_name
                and c.holder_name.upper() == t.holder_name.upper())
        ]
        for c in concessions_for_t:
            user_map.setdefault(c.id, [])
            if t.user_id not in user_map[c.id]:
                user_map[c.id].append(t.user_id)

    for c in concessions:
        scanned += 1
        overlaps = find_overlapping(db, c.id, limit=5)
        if not overlaps:
            continue

        user_ids = user_map.get(c.id, [])
        for uid in user_ids:
            # Una alerta por concesión rastreada (sin duplicar)
            existing = (
                db.query(Alert)
                .filter(
                    Alert.user_id == uid,
                    Alert.related_concession_id == c.id,
                    Alert.alert_type == "overlap",
                )
                .first()
            )
            if existing:
                # Actualizar si cambió la cantidad
                new_count = len(overlaps)
                if str(new_count) not in existing.title:
                    existing.title = _overlap_title(c.code, new_count)
                    existing.message = _overlap_message(c, overlaps)
                    existing.is_read = False
                    alerts_created += 1
                continue

            db.add(Alert(
                user_id=uid,
                alert_type="overlap",
                title=_overlap_title(c.code, len(overlaps)),
                message=_overlap_message(c, overlaps),
                related_concession_id=c.id,
            ))
            alerts_created += 1

    db.commit()
    logger.info("scan_overlaps: %d concesiones escaneadas, %d alertas", scanned, alerts_created)
    return {"scanned": scanned, "alerts_created": alerts_created}


def _overlap_title(code: str, count: int) -> str:
    return f"{code} se superpone con {count} concesión{'es' if count > 1 else ''}"


def _overlap_message(c: Concession, overlaps: list[dict]) -> str:
    lines = [
        f"La concesión {c.name} ({c.code}) tiene superposición geográfica con:",
    ]
    for o in overlaps[:3]:
        lines.append(
            f"  • {o['code']} {o['name']} — {o['area_overlap_ha']:.2f} ha superpuestas"
        )
    if len(overlaps) > 3:
        lines.append(f"  … y {len(overlaps) - 3} más.")
    lines.append("\nEsto puede implicar conflictos de derechos mineros.")
    return "\n".join(lines)
