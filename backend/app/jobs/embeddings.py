"""Tareas Celery para generar y actualizar embeddings semánticos.

El modelo se carga una sola vez por proceso worker y se cachea en memoria.
"""
from __future__ import annotations

import logging
from celery import shared_task

log = logging.getLogger(__name__)


@shared_task(name="generate_embeddings_batch", bind=True, max_retries=2)
def generate_embeddings_batch(self, batch_size: int = 500):
    """Genera embeddings para concesiones que aún no tienen uno.

    Procesa en lotes para no saturar la RAM.
    Se programa semanalmente (lunes 04:00 Lima).
    """
    from app.core.database import SessionLocal
    from app.models import Concession
    from app.search.embeddings import encode_text, build_concession_text
    from app.core.config import settings
    import time

    if not settings.GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY no configurada — embeddings desactivados")
        return {"updated": 0, "skipped": "no_api_key"}

    db = SessionLocal()
    try:
        total_updated = 0
        total_failed = 0
        while True:
            rows = (
                db.query(Concession)
                .filter(Concession.embedding.is_(None))
                .limit(batch_size)
                .all()
            )
            if not rows:
                break

            successful = 0
            failed = 0
            for c in rows:
                try:
                    text = build_concession_text(c)
                    c.embedding = encode_text(text)
                    time.sleep(0.05)  # ~20 req/s, bien bajo el límite de Gemini
                    successful += 1
                except Exception as exc:
                    failed += 1
                    log.warning("Embedding failed for %s: %s", c.code, exc)
                    continue

            db.commit()
            total_updated += successful
            total_failed += failed
            log.info(
                "Embeddings generados en el lote: %d (%d fallidos)",
                successful,
                failed,
            )

            # Failed rows remain NULL. Stop if an entire batch failed instead
            # of retrying the same rows forever in a worker process.
            if successful == 0:
                log.error("Ningún embedding generado en el último lote; deteniendo")
                break

        log.info("generate_embeddings_batch completado: %d concesiones", total_updated)
        return {"updated": total_updated, "failed": total_failed}
    except Exception as exc:
        db.rollback()
        log.error("generate_embeddings_batch falló: %s", exc)
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@shared_task(name="update_embedding_for_concession")
def update_embedding_for_concession(concession_id: int):
    """Actualiza el embedding de una concesión específica.

    Se llama automáticamente cuando se actualiza el expediente_data.
    """
    from app.core.database import SessionLocal
    from app.models import Concession
    from app.search.embeddings import encode_text, build_concession_text

    db = SessionLocal()
    try:
        c = db.query(Concession).filter(Concession.id == concession_id).first()
        if not c:
            return {"error": "not_found"}
        text = build_concession_text(c)
        c.embedding = encode_text(text)
        db.commit()
        return {"updated": concession_id, "code": c.code}
    except Exception as exc:
        db.rollback()
        log.error("update_embedding_for_concession(%s) falló: %s", concession_id, exc)
        raise
    finally:
        db.close()
