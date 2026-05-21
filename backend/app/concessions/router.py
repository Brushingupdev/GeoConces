from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Concession, ConcessionGeometry, ConcessionEvent, User, ConcessionStatus, TrackedRuc
from app.schemas import ConcessionSearchResult, ConcessionDetail

router = APIRouter(prefix="/concessions", tags=["concessions"])


@router.get("/holders")
def search_holders(
    q:            str     = Query(..., min_length=2, description="Nombre del titular"),
    limit:        int     = Query(10, le=20),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    """Busca titulares por nombre y devuelve {holder_name, holder_ruc, concession_count}.
    Útil para agregar titulares a seguimiento sin saber el RUC de memoria.
    """
    rows = (
        db.query(
            Concession.holder_name,
            Concession.holder_ruc,
            func.count(Concession.id).label("concession_count"),
        )
        .filter(
            Concession.holder_name.ilike(f"%{q.strip()}%"),
            Concession.holder_name.isnot(None),
        )
        .group_by(Concession.holder_name, Concession.holder_ruc)
        .order_by(func.count(Concession.id).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "holder_name":      r.holder_name,
            "holder_ruc":       r.holder_ruc,
            "concession_count": r.concession_count,
        }
        for r in rows
    ]


@router.get("/substance-types")
def substance_types(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    """Devuelve tipos de sustancia distintos con conteo de concesiones."""
    rows = (
        db.query(
            Concession.concession_type,
            func.count(Concession.id).label("count"),
        )
        .filter(Concession.concession_type.isnot(None))
        .group_by(Concession.concession_type)
        .order_by(func.count(Concession.id).desc())
        .all()
    )
    return [{"type": r.concession_type, "count": r.count} for r in rows]


@router.get("")
def list_concessions(
    q:               Optional[str]              = Query(None),
    region:          Optional[str]              = Query(None),
    status:          Optional[str]              = Query(None),
    concession_type: Optional[str]              = Query(None),
    sort_by:         str                        = Query("name", regex="^(name|code|area_hectares|registration_date|status)$"),
    sort_dir:        str                        = Query("asc",  regex="^(asc|desc)$"),
    page:            int                        = Query(1, ge=1),
    limit:           int                        = Query(50, ge=1, le=200),
    db:              Session                    = Depends(get_db),
    current_user:    User                       = Depends(get_current_active_user),
):
    """Lista concesiones con búsqueda full-text, filtros y paginación."""
    query = db.query(Concession)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Concession.code.ilike(term),
                Concession.name.ilike(term),
                Concession.holder_name.ilike(term),
                Concession.holder_ruc.ilike(term),
            )
        )

    if region and region.strip() and region != "all":
        query = query.filter(Concession.region.ilike(f"%{region.strip()}%"))

    if status and status != "all":
        try:
            query = query.filter(Concession.status == ConcessionStatus(status))
        except ValueError:
            pass

    if concession_type and concession_type != "all":
        query = query.filter(Concession.concession_type.ilike(f"%{concession_type.strip()}%"))

    total = query.count()

    # Sorting
    col = getattr(Concession, sort_by, Concession.name)
    order = col.desc() if sort_dir == "desc" else col.asc()
    query = query.order_by(order)

    items = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [_to_search(c) for c in items],
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/mine", response_model=List[ConcessionSearchResult])
def my_concessions(
    q:      Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db:     Session       = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    tracked = db.query(TrackedRuc).filter(TrackedRuc.user_id == current_user.id).all()
    if not tracked:
        return []

    rucs   = [t.ruc         for t in tracked if t.ruc]
    names  = [t.holder_name for t in tracked if t.holder_name and not t.ruc]

    # Build OR filter: match by RUC or by exact holder_name
    filters = []
    if rucs:
        filters.append(Concession.holder_ruc.in_(rucs))
    if names:
        filters.append(Concession.holder_name.in_(names))

    if not filters:
        return []

    query = db.query(Concession).filter(or_(*filters))

    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(Concession.code.ilike(term), Concession.name.ilike(term), Concession.holder_name.ilike(term))
        )
    if region and region != "all":
        query = query.filter(Concession.region.ilike(f"%{region}%"))
    if status and status != "all":
        try:
            query = query.filter(Concession.status == ConcessionStatus(status))
        except ValueError:
            pass
    return query.order_by(Concession.expiration_date.asc().nullslast()).limit(500).all()


@router.get("/stats")
def concession_stats(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    total     = db.query(Concession).count()
    active    = db.query(Concession).filter(Concession.status == ConcessionStatus.active).count()
    expired   = db.query(Concession).filter(Concession.status == ConcessionStatus.expired).count()
    pending   = db.query(Concession).filter(Concession.status == ConcessionStatus.pending).count()
    with_ruc  = db.query(Concession).filter(Concession.holder_ruc.isnot(None)).count()
    return {"total": total, "active": active, "expired": expired, "pending": pending, "with_ruc": with_ruc}


@router.get("/by-holder/{holder_ruc}", response_model=List[ConcessionSearchResult])
def by_holder(
    holder_ruc:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    return db.query(Concession).filter(Concession.holder_ruc == holder_ruc).all()


@router.get("/{concession_id}/expediente")
def get_expediente_data(
    concession_id: int,
    refresh:     bool = Query(False, description="Forzar re-extracción aunque haya caché"),
    full_scan:   bool = Query(False, description="Escanear todas las páginas (~2min)"),
    check_only:  bool = Query(False, description="Solo verificar caché, nunca correr OCR"),
    db:          Session = Depends(get_db),
    current_user: User   = Depends(get_current_active_user),
):
    """Extrae y devuelve datos del expediente digitalizado vía OCR (Tesseract).

    Modos:
    - ?check_only=true : responde en <100ms — devuelve caché si existe, si no {found:false}
    - Sin params       : si hay caché la devuelve; si no, corre OCR (~25s) y guarda en DB
    - ?refresh=true    : fuerza re-extracción aunque haya caché
    - ?full_scan=true  : escanea todas las páginas (~2min)
    """
    from app.expediente.service import extract_expediente
    from datetime import datetime, timezone

    c = db.query(Concession).filter(Concession.id == concession_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Concesión no encontrada")

    has_cache = c.expediente_data is not None and c.expediente_fetched_at is not None

    # ── Siempre devolver caché si existe (a menos que refresh=true) ───────────
    if has_cache and not refresh:
        return {
            "found":      True,
            "cached":     True,
            "fetched_at": c.expediente_fetched_at.isoformat(),
            **c.expediente_data,
        }

    # ── check_only: no hay caché → responder inmediatamente sin OCR ───────────
    if check_only:
        return {"found": False, "cached": False, "check_only": True}

    # ── Modo extracción: encola en Celery y retorna task_id ───────────────────
    if not c.sidemcat_data:
        from app.sidemcat.client import SIDEMCATClient
        sid = SIDEMCATClient().fetch_concession(c.code)
        if sid:
            c.sidemcat_data = sid
            c.sidemcat_fetched_at = datetime.now(timezone.utc)
            db.commit()

    if not c.sidemcat_data or not c.sidemcat_data.get("has_pdf"):
        return {"found": False, "reason": "Sin expediente digitalizado", "code": c.code}

    # Encolar el OCR en Celery para no bloquear el HTTP request
    from app.jobs.sync import extract_expediente_task
    task = extract_expediente_task.delay(concession_id, full_scan=full_scan)
    return {
        "found":    False,
        "queued":   True,
        "task_id":  task.id,
        "message":  "Extracción encolada. Consulta /jobs/tasks/{task_id} para el estado.",
    }


@router.get("/{concession_id}/expediente/progress")
def get_expediente_progress(
    concession_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Progreso en tiempo real de la extracción del expediente (Redis)."""
    from app.expediente.service import get_progress
    return get_progress(concession_id)


@router.get("/{concession_id}/sidemcat")
def get_sidemcat_data(
    concession_id: int,
    refresh:       bool    = Query(False, description="Forzar re-consulta aunque haya datos cacheados"),
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_active_user),
):
    """Consulta SIDEMCAT para una concesión. Guarda el resultado en la DB.

    - Primera vez: consulta SIDEMCAT y guarda en DB.
    - Siguientes veces: devuelve datos cacheados (hasta 7 días).
    - ?refresh=true: fuerza re-consulta aunque haya datos recientes.
    """
    from app.sidemcat.client import SIDEMCATClient
    from datetime import datetime, timezone, timedelta

    c = db.query(Concession).filter(Concession.id == concession_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Concesión no encontrada")

    # Usar caché si existe y tiene menos de 7 días (y no se forzó refresh)
    cache_ttl = timedelta(days=7)
    has_cache = (
        c.sidemcat_data is not None
        and c.sidemcat_fetched_at is not None
        and (datetime.now(timezone.utc) - c.sidemcat_fetched_at.replace(tzinfo=timezone.utc)) < cache_ttl
    )

    if has_cache and not refresh:
        # Aunque sea caché, si la concesión todavía no tiene title_date en DB
        # y el JSON cacheado sí lo tiene, lo grabamos ahora.
        cached = c.sidemcat_data
        if cached.get("title_date") and not c.title_date:
            try:
                c.title_date = datetime.fromisoformat(cached["title_date"]).date()
                db.commit()
            except Exception:
                pass
        return {
            "found": True,
            "cached": True,
            "fetched_at": c.sidemcat_fetched_at.isoformat(),
            **cached,
        }

    # Consultar SIDEMCAT
    data = SIDEMCATClient().fetch_concession(c.code)

    if not data:
        return {"found": False, "code": c.code, "cached": False}

    # Guardar en DB
    c.sidemcat_data = data
    c.sidemcat_fetched_at = datetime.now(timezone.utc)

    # Actualizar title_date en la concesión si SIDEMCAT lo tiene y aún no está guardado
    if data.get("title_date") and not c.title_date:
        from datetime import date
        try:
            td = data["title_date"]
            # title_date viene como ISO string "YYYY-MM-DDTHH:MM:SS+00:00"
            c.title_date = datetime.fromisoformat(td).date()
        except Exception:
            pass

    db.commit()

    return {
        "found": True,
        "cached": False,
        "fetched_at": c.sidemcat_fetched_at.isoformat(),
        **data,
    }


@router.get("/{concession_id}")
def get_concession(
    concession_id: int,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_active_user),
):
    c = db.query(Concession).filter(Concession.id == concession_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Concesión no encontrada")

    geom = db.query(ConcessionGeometry).filter(ConcessionGeometry.concession_id == concession_id).first()
    geojson = None
    if geom:
        geojson = db.scalar(func.ST_AsGeoJSON(geom.geom))

    events = (
        db.query(ConcessionEvent)
        .filter(ConcessionEvent.concession_id == concession_id)
        .order_by(ConcessionEvent.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "id": c.id,
        "code": c.code,
        "name": c.name,
        "holder_name": c.holder_name,
        "holder_ruc": c.holder_ruc,
        "status": c.status.value,
        "concession_type": c.concession_type,
        "region": c.region,
        "province": c.province,
        "district": c.district,
        "area_hectares": c.area_hectares,
        "registration_date": c.registration_date.isoformat() if c.registration_date else None,
        "title_date": c.title_date.isoformat() if c.title_date else None,
        "expiration_date": c.expiration_date.isoformat() if c.expiration_date else None,
        "source": c.source,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "geometry_geojson": geojson,
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "title": e.title,
                "payload": e.payload,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }


def _to_search(c: Concession) -> dict:
    return {
        "id":               c.id,
        "code":             c.code,
        "name":             c.name,
        "holder_name":      c.holder_name,
        "holder_ruc":       c.holder_ruc,
        "status":           c.status.value,
        "concession_type":  c.concession_type,
        "region":           c.region,
        "province":         c.province,
        "area_hectares":    c.area_hectares,
        "registration_date": c.registration_date.isoformat() if c.registration_date else None,
        "title_date":       c.title_date.isoformat() if c.title_date else None,
        "expiration_date":  c.expiration_date.isoformat() if c.expiration_date else None,
    }
