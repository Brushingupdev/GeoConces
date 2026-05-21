from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import Optional

from app.common.dependencies import get_current_active_user
from app.core.database import get_db
from app.models import Concession, ConcessionStatus, User
from app.opportunities.scoring import score_concession

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("/stats")
def opportunity_stats(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_active_user),
):
    expired = db.query(func.count(Concession.id)).filter(
        Concession.status == ConcessionStatus.expired,
        Concession.area_hectares >= 50,
    ).scalar()

    pending_large = db.query(func.count(Concession.id)).filter(
        Concession.status == ConcessionStatus.pending,
        Concession.area_hectares >= 500,
    ).scalar()

    active_debt = db.query(func.count(Concession.id)).filter(
        Concession.status == ConcessionStatus.active,
        Concession.sidemcat_data.isnot(None),
        Concession.sidemcat_data["has_debt"].as_boolean() == True,
    ).scalar()

    return {
        "libre_denunciabilidad": expired,
        "monitoreo":             pending_large,
        "adquisicion":           active_debt,
    }


@router.get("")
def list_opportunities(
    q:         Optional[str]   = Query(None),
    region:    Optional[str]   = Query(None),
    opp_type:  Optional[str]   = Query(None),
    sustancia: Optional[str]   = Query(None),
    area_min:  Optional[float] = Query(None),
    min_score: int             = Query(30),
    limit:     int             = Query(100, le=500),
    page:      int             = Query(1, ge=1),
    db:        Session         = Depends(get_db),
    current_user: User         = Depends(get_current_active_user),
):
    query = db.query(Concession)

    if opp_type == "libre_denunciabilidad":
        query = query.filter(Concession.status == ConcessionStatus.expired)
    elif opp_type == "adquisicion":
        query = query.filter(Concession.status == ConcessionStatus.active)
    elif opp_type == "monitoreo":
        query = query.filter(Concession.status == ConcessionStatus.pending)
    else:
        query = query.filter(Concession.status.in_([
            ConcessionStatus.expired,
            ConcessionStatus.active,
            ConcessionStatus.pending,
        ]))

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(
            Concession.code.ilike(term),
            Concession.name.ilike(term),
            Concession.holder_name.ilike(term),
        ))

    if region and region.strip():
        query = query.filter(Concession.region.ilike(f"%{region.strip()}%"))

    if sustancia and sustancia.strip():
        query = query.filter(Concession.concession_type.ilike(f"%{sustancia.strip()}%"))

    if area_min is not None:
        query = query.filter(Concession.area_hectares >= area_min)

    query = query.filter(
        Concession.area_hectares.isnot(None),
        Concession.area_hectares >= 50,
    )

    query = query.order_by(Concession.area_hectares.desc().nullslast())

    rows = query.limit(max(limit * 10, 2000)).all()

    scored = []
    for c in rows:
        result = score_concession(c)
        if result and result["score"] >= min_score:
            scored.append(result)

    scored.sort(key=lambda x: x["score"], reverse=True)

    stats = {
        "libre_denunciabilidad": sum(1 for x in scored if x["opp_type"] == "libre_denunciabilidad"),
        "adquisicion":           sum(1 for x in scored if x["opp_type"] == "adquisicion"),
        "monitoreo":             sum(1 for x in scored if x["opp_type"] == "monitoreo"),
        "total":                 len(scored),
    }

    offset = (page - 1) * limit
    return {
        "items": scored[offset: offset + limit],
        "total": len(scored),
        "page":  page,
        "pages": max(1, (len(scored) + limit - 1) // limit),
        "stats": stats,
    }
