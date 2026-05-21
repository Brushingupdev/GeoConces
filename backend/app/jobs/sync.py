"""Scheduled jobs that sync from external data sources."""

from typing import Dict, List

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.datasources.orchestrator import sync_all, sync_source
from app.datasources.registry import list_sources
from app.reinfo.enrichment import enrich_ruc_from_reinfo


@celery_app.task(name="sync.run_all_sources")
def run_all_sources() -> List[Dict[str, int | str | None]]:
    db = SessionLocal()
    try:
        logs = sync_all(db)
        return [
            {
                "source": log.source,
                "processed": log.records_processed,
                "created": log.records_created,
                "updated": log.records_updated,
                "error": log.error_message,
            }
            for log in logs
        ]
    finally:
        db.close()


@celery_app.task(name="sync.run_source", bind=True, max_retries=2)
def run_source(self, source: str, limit: int | None = None) -> Dict[str, int | str | None]:
    """Sincroniza una fuente externa. Reintenta hasta 2 veces en caso de error."""
    db = SessionLocal()
    try:
        log = sync_source(db, source, limit=limit)
        return {
            "source": log.source,
            "processed": log.records_processed,
            "created": log.records_created,
            "updated": log.records_updated,
            "error": log.error_message,
        }
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@celery_app.task(name="sync.list_sources")
def known_sources() -> List[str]:
    return list_sources()


@celery_app.task(name="sync.extract_expediente", bind=True, max_retries=1)
def extract_expediente_task(self, concession_id: int, full_scan: bool = False):
    """Extrae datos del expediente OCR para una concesión específica."""
    from app.expediente.service import extract_expediente
    db = SessionLocal()
    try:
        from app.models import Concession
        c = db.query(Concession).filter(Concession.id == concession_id).first()
        if not c:
            return {"error": f"Concesión {concession_id} no encontrada"}
        result = extract_expediente(db, c, full_scan=full_scan)
        return {"concession_id": concession_id, "code": c.code,
                "success": result is not None,
                "email": result.get("titular_email") if result else None,
                "risk_score": result.get("risk_score") if result else None}
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=30)
    finally:
        db.close()


@celery_app.task(name="sync.extract_expedientes_tracked")
def extract_expedientes_tracked():
    """Extrae expedientes de concesiones rastreadas con PDF disponible."""
    from app.models import Concession, TrackedRuc
    from sqlalchemy import func, or_
    db = SessionLocal()
    queued = 0
    try:
        tracked = db.query(TrackedRuc).all()
        rucs  = [t.ruc for t in tracked if t.ruc]
        names = [t.holder_name.upper() for t in tracked if t.holder_name]

        filters = []
        if rucs:  filters.append(Concession.holder_ruc.in_(rucs))
        if names: filters.append(func.upper(Concession.holder_name).in_(names))
        if not filters:
            return {"queued": 0}

        concessions = (
            db.query(Concession)
            .filter(or_(*filters))
            .filter(Concession.sidemcat_data.isnot(None))
            .filter(Concession.sidemcat_data["has_pdf"].as_boolean() == True)
            .filter(Concession.expediente_data.is_(None))  # solo sin caché
            .limit(50)
            .all()
        )
        for c in concessions:
            extract_expediente_task.delay(c.id)
            queued += 1
        return {"queued": queued}
    finally:
        db.close()


@celery_app.task(name="sync.enrich_ruc", bind=True, max_retries=2)
def enrich_ruc(self, limit: int | None = None) -> Dict[str, int | str | None]:
    """Enriquece holder_ruc en concesiones existentes con datos del REINFO (MINEM)."""
    db = SessionLocal()
    try:
        result = enrich_ruc_from_reinfo(db, limit=limit)
        return result
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()
