"""Servicio de enriquecimiento de concesiones con datos REINFO.

Enriquece holder_ruc en concesiones existentes usando el mapa
{code → ruc} obtenido del SERV_REINFO de GEOCATMIN/INGEMMET.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Concession, DataImportLog
from app.reinfo.client import REINFOClient

logger = logging.getLogger(__name__)

COMMIT_EVERY = 2000  # filas por commit


def enrich_ruc_from_reinfo(
    db: Session,
    limit: Optional[int] = None,
) -> dict:
    """Descarga REINFO y actualiza holder_ruc en concesiones que no lo tienen.

    Returns stats dict: {updated, skipped, total_reinfo}.
    """
    started = datetime.now(timezone.utc)
    client = REINFOClient()

    logger.info("REINFO enrich: descargando mapa RUC...")
    ruc_map = client.fetch_ruc_map(limit=limit)

    if not ruc_map:
        log = DataImportLog(
            source="REINFO",
            import_type="ruc_enrichment",
            records_processed=0,
            records_created=0,
            records_updated=0,
            started_at=started,
            finished_at=datetime.now(timezone.utc),
            error_message="No se obtuvieron RUCs del servicio REINFO",
        )
        db.add(log)
        db.commit()
        return {"updated": 0, "skipped": 0, "total_reinfo": 0}

    logger.info("REINFO enrich: %d RUCs disponibles — actualizando concesiones...", len(ruc_map))

    updated = 0
    skipped = 0
    batch_updates = []

    for code, ruc in ruc_map.items():
        batch_updates.append({"code": code, "ruc": ruc})

        if len(batch_updates) >= COMMIT_EVERY:
            n = _apply_batch(db, batch_updates)
            updated += n
            skipped += len(batch_updates) - n
            batch_updates = []

    if batch_updates:
        n = _apply_batch(db, batch_updates)
        updated += n
        skipped += len(batch_updates) - n

    log = DataImportLog(
        source="REINFO",
        import_type="ruc_enrichment",
        records_processed=len(ruc_map),
        records_created=0,
        records_updated=updated,
        started_at=started,
        finished_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    logger.info(
        "REINFO enrich completo — %d actualizadas, %d sin match, %d RUCs totales",
        updated, skipped, len(ruc_map),
    )
    return {"updated": updated, "skipped": skipped, "total_reinfo": len(ruc_map)}


def _apply_batch(db: Session, items: list[dict]) -> int:
    """Actualiza holder_ruc para una lista de {code, ruc}. Retorna nº actualizadas."""
    updated = 0
    for item in items:
        result = (
            db.query(Concession)
            .filter(
                Concession.code == item["code"],
                Concession.holder_ruc.is_(None),  # solo si aún no tiene RUC
            )
            .update({"holder_ruc": item["ruc"]}, synchronize_session=False)
        )
        updated += result
    db.commit()
    return updated
