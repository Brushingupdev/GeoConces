from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.common.dependencies import get_current_active_user
from app.core.database import get_db
from app.models import Concession, User
from app.overlaps.service import find_overlapping

router = APIRouter(prefix="/concessions", tags=["overlaps"])


@router.get("/{concession_id}/overlapping")
def get_overlapping(
    concession_id: int,
    limit: int   = Query(20, le=50),
    db:    Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retorna concesiones que se superponen geográficamente con la dada.

    Usa ST_Intersects + ST_Intersection de PostGIS.
    Filtra superposiciones de borde (área < 100 m²).
    """
    c = db.query(Concession).filter(Concession.id == concession_id).first()
    if not c:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Concesión no encontrada")

    overlaps = find_overlapping(db, concession_id, limit=limit)
    return {
        "concession_id":   concession_id,
        "code":            c.code,
        "overlapping":     overlaps,
        "count":           len(overlaps),
        "has_overlaps":    len(overlaps) > 0,
    }
