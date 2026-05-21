from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.common.dependencies import get_current_active_user
from app.core.database import get_db
from app.models import Concession, ConcessionStatus, User
from app.search.nlp import parse_query

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/natural")
def natural_search(
    q:     str     = Query(..., description="Consulta en lenguaje natural"),
    limit: int     = Query(50, le=200),
    db:    Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Búsqueda por lenguaje natural.

    Convierte texto libre en filtros estructurados y ejecuta la búsqueda.
    Retorna los resultados + la interpretación de los filtros detectados.
    """
    parsed = parse_query(q)
    f = parsed["filters"]

    query = db.query(Concession)

    # Texto libre
    if f.get("q"):
        term = f"%{f['q']}%"
        query = query.filter(or_(
            Concession.code.ilike(term),
            Concession.name.ilike(term),
            Concession.holder_name.ilike(term),
        ))

    # Estado
    if f.get("status"):
        try:
            query = query.filter(Concession.status == ConcessionStatus(f["status"]))
        except ValueError:
            pass

    # Región
    if f.get("region"):
        query = query.filter(Concession.region.ilike(f"%{f['region']}%"))

    # Tipo / sustancia
    if f.get("concession_type"):
        query = query.filter(Concession.concession_type.ilike(f"%{f['concession_type']}%"))

    # Área
    if f.get("area_min") is not None:
        query = query.filter(Concession.area_hectares >= f["area_min"])
    if f.get("area_max") is not None:
        query = query.filter(Concession.area_hectares <= f["area_max"])

    # Deuda (requiere sidemcat_data cacheado)
    if f.get("has_debt"):
        query = query.filter(
            Concession.sidemcat_data.isnot(None),
            Concession.sidemcat_data["has_debt"].as_boolean() == True,
        )

    # Ordenamiento
    sort_col = getattr(Concession, f.get("sort_by", "area_hectares"), Concession.area_hectares)
    if f.get("sort_dir") == "asc":
        query = query.order_by(sort_col.asc().nullslast())
    else:
        query = query.order_by(sort_col.desc().nullslast())

    total = query.count()
    items = query.limit(limit).all()

    return {
        "query":       q,
        "interpreted": parsed["interpreted"],
        "filters":     parsed["filters"],
        "total":       total,
        "items": [
            {
                "id":               c.id,
                "code":             c.code,
                "name":             c.name,
                "holder_name":      c.holder_name,
                "holder_ruc":       c.holder_ruc,
                "status":           c.status.value,
                "concession_type":  c.concession_type,
                "region":           c.region,
                "area_hectares":    c.area_hectares,
                "has_debt":         bool((c.sidemcat_data or {}).get("has_debt")),
                "registration_date": c.registration_date.isoformat() if c.registration_date else None,
            }
            for c in items
        ],
    }


@router.get("/natural/parse")
def parse_only(
    q: str = Query(...),
    current_user: User = Depends(get_current_active_user),
):
    """Solo devuelve la interpretación del query sin ejecutar la búsqueda."""
    return parse_query(q)


@router.get("/semantic")
def semantic_search_endpoint(
    q:         str   = Query(..., description="Consulta en lenguaje natural o nombre de empresa/concesión"),
    limit:     int   = Query(50, le=200),
    threshold: float = Query(0.35, ge=0.0, le=1.0, description="Score mínimo de similitud (0-1)"),
    db:        Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Búsqueda semántica por embeddings (pgvector).

    Encuentra concesiones similares semánticamente al texto proporcionado,
    incluso si no contienen exactamente las mismas palabras.

    Ejemplos:
      - "empresa minera de oro en el norte del país"
      - "HOCHSCHILD MINING grandes concesiones"
      - "concesiones vencidas con problemas legales"
    """
    try:
        from app.search.embeddings import semantic_search
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Búsqueda semántica no disponible: instala sentence-transformers",
        )

    results = semantic_search(db=db, query=q, limit=limit, threshold=threshold)
    return {
        "query":   q,
        "total":   len(results),
        "items":   results,
        "mode":    "semantic",
    }


@router.post("/semantic/reindex")
def trigger_reindex(
    current_user: User = Depends(get_current_active_user),
):
    """Dispara la generación de embeddings para concesiones sin embedding.

    Solo administradores. El proceso corre en background vía Celery.
    """
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    from app.jobs.embeddings import generate_embeddings_batch
    task = generate_embeddings_batch.delay()
    return {"queued": True, "task_id": task.id}
