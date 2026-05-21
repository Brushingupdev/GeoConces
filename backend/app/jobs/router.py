"""Endpoints para disparar jobs en background (uso admin/dev).

Todos requieren rol admin. Los jobs de sync se envían al worker Celery
(.delay()) para no bloquear el servidor HTTP. Los jobs de alertas son
livianos y se ejecutan de forma síncrona desde el endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.common.dependencies import require_admin
from app.datasources.registry import list_sources, get_client
from app.jobs.alerts import scan_expirations, scan_status_changes, scan_debt, scan_overlaps
from app.jobs.sync import run_source, run_all_sources, enrich_ruc, extract_expediente_task, extract_expedientes_tracked
from app.models import User


router = APIRouter(prefix="/jobs", tags=["jobs"])


# ── Fuentes disponibles ───────────────────────────────────────────────────────

@router.get("/sources")
def get_sources(current_user: User = Depends(require_admin)):
    """Lista las fuentes registradas con su estado de health check."""
    sources = []
    for name in list_sources():
        try:
            client = get_client(name)
            healthy = client.health_check()
        except Exception:
            healthy = False
        sources.append({"source": name, "healthy": healthy})
    return {"sources": sources}


# ── Sync de fuentes — ASYNC vía Celery ───────────────────────────────────────

@router.post("/sync/{source}")
def trigger_sync_source(
    source: str,
    limit: int = 1000,
    current_user: User = Depends(require_admin),
):
    """Encola una sincronización de una fuente específica.

    Retorna inmediatamente con el task_id de Celery para que el cliente
    pueda seguir el progreso si lo necesita.
    """
    try:
        get_client(source)  # valida que la fuente exista
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Fuente desconocida: {source}")

    task = run_source.delay(source, limit=limit)
    return {
        "status": "queued",
        "task_id": task.id,
        "source": source.upper(),
        "message": f"Sync de {source.upper()} encolado. Puede tomar varios minutos para catálogos grandes.",
    }


@router.post("/sync")
def trigger_sync_all(current_user: User = Depends(require_admin)):
    """Encola sincronización de TODAS las fuentes registradas."""
    task = run_all_sources.delay()
    return {
        "status": "queued",
        "task_id": task.id,
        "sources": list_sources(),
        "message": "Sync completo encolado. Revisa los logs de importación para el progreso.",
    }


# ── Jobs de alertas — síncronos (son livianos) ───────────────────────────────

@router.post("/alerts/expirations")
def trigger_scan_expirations(current_user: User = Depends(require_admin)):
    """Ejecuta el scan de vencimientos inmediatamente y retorna el resultado."""
    return scan_expirations()


@router.post("/alerts/status-changes")
def trigger_scan_status_changes(current_user: User = Depends(require_admin)):
    """Ejecuta el scan de cambios de estado inmediatamente."""
    return scan_status_changes()


@router.post("/alerts/debt")
def trigger_scan_debt(current_user: User = Depends(require_admin)):
    """Escanea concesiones rastreadas con deuda de vigencia en SIDEMCAT."""
    return scan_debt()


@router.post("/alerts/overlaps")
def trigger_scan_overlaps(current_user: User = Depends(require_admin)):
    """Escanea superposiciones PostGIS para concesiones rastreadas."""
    return scan_overlaps()


@router.post("/alerts/all")
def trigger_all_alerts(current_user: User = Depends(require_admin)):
    """Ejecuta todos los scans de alerta en secuencia."""
    r1 = scan_status_changes()
    r2 = scan_debt()
    r3 = scan_expirations()
    r4 = scan_overlaps()
    return {
        "status_changes": r1,
        "debt":           r2,
        "expirations":    r3,
        "overlaps":       r4,
        "total_created":  r1["created"] + r2["created"] + r3["created"] + r4["alerts_created"],
    }


# ── Enriquecimiento RUC desde REINFO ─────────────────────────────────────────

@router.post("/enrich/ruc")
def trigger_enrich_ruc(current_user: User = Depends(require_admin)):
    """Enriquece holder_ruc en concesiones existentes con datos del REINFO (MINEM).

    Descarga ~87k registros del SERV_REINFO de GEOCATMIN y actualiza el RUC
    de las concesiones que tengan match por código y aún no tengan RUC.
    """
    task = enrich_ruc.delay()
    return {
        "status": "queued",
        "task_id": task.id,
        "message": "Enriquecimiento RUC desde REINFO encolado. ~87k registros, tardará ~3 min.",
    }


# ── Expediente OCR ───────────────────────────────────────────────────────────

@router.post("/expediente/{concession_id}")
def trigger_expediente(
    concession_id: int,
    full_scan: bool = False,
    current_user: User = Depends(require_admin),
):
    """Encola extracción OCR del expediente para una concesión."""
    task = extract_expediente_task.delay(concession_id, full_scan=full_scan)
    return {"status": "queued", "task_id": task.id, "concession_id": concession_id}


@router.post("/expediente/batch/tracked")
def trigger_expediente_batch(current_user: User = Depends(require_admin)):
    """Extrae expedientes de concesiones rastreadas sin caché (hasta 50)."""
    result = extract_expedientes_tracked()
    return result


# ── Estado de una tarea Celery ────────────────────────────────────────────────

@router.get("/tasks/{task_id}")
def task_status(task_id: str, current_user: User = Depends(require_admin)):
    """Consulta el estado de una tarea Celery por su ID."""
    from app.core.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.status,          # PENDING, STARTED, SUCCESS, FAILURE
        "result": result.result if result.ready() else None,
    }
