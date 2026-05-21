from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional

from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Concession, ConcessionGeometry, ConcessionStatus, User

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/concessions")
def map_concessions(
    min_lng: float = Query(...),
    min_lat: float = Query(...),
    max_lng: float = Query(...),
    max_lat: float = Query(...),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    concession_type: Optional[str] = Query(None),
    area_min: Optional[float] = Query(None),
    area_max: Optional[float] = Query(None),
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    bbox = func.ST_SetSRID(
        func.ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat),
        4326,
    )

    query = (
        db.query(
            Concession.id,
            Concession.code,
            Concession.name,
            Concession.status,
            Concession.holder_name,
            Concession.region,
            Concession.area_hectares,
            func.ST_AsGeoJSON(ConcessionGeometry.centroid).label("centroid"),
        )
        .join(ConcessionGeometry, Concession.id == ConcessionGeometry.concession_id)
        .filter(func.ST_Intersects(ConcessionGeometry.geom, bbox))
    )

    if q and q.strip():
        term = f"%{q.strip().upper()}%"
        query = query.filter(
            or_(
                func.upper(Concession.code).like(term),
                func.upper(Concession.name).like(term),
                func.upper(Concession.holder_name).like(term),
            )
        )

    if status and status != "all":
        try:
            query = query.filter(Concession.status == ConcessionStatus(status))
        except ValueError:
            pass

    if region and region != "all":
        query = query.filter(
            func.upper(Concession.region).like(f"%{region.upper()}%")
        )

    if concession_type and concession_type != "all":
        query = query.filter(
            func.upper(Concession.concession_type).like(f"%{concession_type.upper()}%")
        )

    if area_min is not None:
        query = query.filter(Concession.area_hectares >= area_min)

    if area_max is not None:
        query = query.filter(Concession.area_hectares <= area_max)

    rows = query.limit(limit).all()

    features = [
        {
            "id": row.id,
            "code": row.code,
            "name": row.name,
            "status": row.status.value,
            "holder_name": row.holder_name,
            "region": row.region,
            "area_hectares": row.area_hectares,
            "centroid": row.centroid,
        }
        for row in rows
    ]

    return {"features": features, "count": len(features), "limit": limit}


@router.get("/concessions/{concession_id}/geometry")
def concession_geometry(
    concession_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    geo = (
        db.query(ConcessionGeometry)
        .filter(ConcessionGeometry.concession_id == concession_id)
        .first()
    )
    if not geo:
        return {"geojson": None}
    geojson = db.scalar(func.ST_AsGeoJSON(geo.geom))
    return {"geojson": geojson, "concession_id": concession_id}
