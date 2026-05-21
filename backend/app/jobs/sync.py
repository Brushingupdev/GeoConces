"""Scheduled jobs that sync from external data sources."""

import time
from datetime import datetime, timedelta, timezone
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


@celery_app.task(name="sync.build_expediente_pdf", bind=True, max_retries=1)
def build_expediente_pdf_task(self, concession_id: int) -> dict:
    """Descarga todas las páginas del expediente y construye un PDF completo en disco."""
    import os
    from app.models import Concession, ConcessionDocument
    from app.expediente.client import download_pages, count_pages
    from app.expediente.pdf_builder import build_pdf_from_pages
    from app.core.config import settings

    db = SessionLocal()
    try:
        c = db.query(Concession).filter(Concession.id == concession_id).first()
        if not c:
            return {"error": "Concesión no encontrada"}

        sidemcat = c.sidemcat_data or {}
        cod_archivo = sidemcat.get("pdf_cod_archivo") or sidemcat.get("codArchivo")
        if not cod_archivo:
            return {"error": "Sin cod_archivo — ejecuta /sidemcat primero"}

        cod_archivo = int(cod_archivo)
        cod_almacen = 1

        total_pages = int(sidemcat.get("pdf_num_paginas") or 0)
        if not total_pages:
            total_pages = count_pages(cod_archivo, cod_almacen)
        if not total_pages:
            return {"error": "No se pudo determinar el número de páginas"}

        pages_bytes = download_pages(cod_archivo, cod_almacen, list(range(1, total_pages + 1)))
        if not pages_bytes:
            return {"error": "No se pudo descargar ninguna página"}

        pdf_bytes = build_pdf_from_pages(pages_bytes)

        out_dir = os.path.join(settings.MEDIA_ROOT, "expedientes")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{c.code}.pdf")
        with open(out_path, "wb") as f:
            f.write(pdf_bytes)

        existing = db.query(ConcessionDocument).filter(
            ConcessionDocument.concession_id == concession_id,
            ConcessionDocument.document_type == "expediente_pdf",
        ).first()
        if existing:
            existing.file_path = out_path
        else:
            db.add(ConcessionDocument(
                concession_id=concession_id,
                document_type="expediente_pdf",
                file_path=out_path,
            ))
        db.commit()

        return {
            "concession_id": concession_id,
            "code": c.code,
            "pages": len(pages_bytes),
            "total_pages": total_pages,
            "size_kb": len(pdf_bytes) // 1024,
        }
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@celery_app.task(name="sync.enrich_sidemcat_batch", bind=True, max_retries=1)
def enrich_sidemcat_batch(self, batch_size: int = 150, max_age_days: int = 30) -> Dict[str, int]:
    """Enriquece concesiones con datos de SIDEMCAT en lotes nocturnos.

    Prioridad: watchlisted → activas → en trámite → caducadas.
    Delay de 0.8s entre llamadas para no saturar INGEMMET (~2min por 150).
    """
    from sqlalchemy import case, or_
    from app.models import Concession, ConcessionStatus, WatchlistItem
    from app.sidemcat.client import SIDEMCATClient

    db = SessionLocal()
    updated = 0
    failed = 0

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

        watchlisted_ids = {
            row[0] for row in db.query(WatchlistItem.concession_id).all()
        }

        priority_order = case(
            (Concession.id.in_(watchlisted_ids), 0) if watchlisted_ids else (Concession.id.is_(None), 0),
            (Concession.status == ConcessionStatus.active, 1),
            (Concession.status == ConcessionStatus.pending, 2),
            else_=3,
        )

        concessions = (
            db.query(Concession)
            .filter(
                or_(
                    Concession.sidemcat_data.is_(None),
                    Concession.sidemcat_fetched_at < cutoff,
                )
            )
            .order_by(priority_order)
            .limit(batch_size)
            .all()
        )

        client = SIDEMCATClient(timeout=20.0)

        for c in concessions:
            data = client.fetch_concession(c.code)
            if data:
                c.sidemcat_data = data
                c.sidemcat_fetched_at = datetime.now(timezone.utc)
                if data.get("title_date") and not c.title_date:
                    try:
                        c.title_date = datetime.fromisoformat(data["title_date"])
                    except Exception:
                        pass
                updated += 1
            else:
                failed += 1
            db.commit()
            time.sleep(0.8)

        return {"updated": updated, "failed": failed, "remaining": max(0, db.query(Concession).filter(Concession.sidemcat_data.is_(None)).count() - batch_size)}
    except Exception as exc:
        db.close()
        raise self.retry(exc=exc, countdown=120)
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
