import os
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Concession, ConcessionStatus, Report, TrackedRuc, User
from app.schemas import ReportOut, ReportRequest
from app.exports import build_concessions_xlsx, build_concessions_pdf
from app.scoring import score_opportunity


REPORTS_DIR = Path(os.getenv("REPORTS_DIR", "/app/storage/reports"))
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


router = APIRouter(prefix="/reports", tags=["reports"])


def _build_query(db: Session, current_user: User, req: ReportRequest):
    query = db.query(Concession)

    if req.concession_ids:
        query = query.filter(Concession.id.in_(req.concession_ids))

    if req.scope == "mine":
        rucs = [t.ruc for t in db.query(TrackedRuc).filter(TrackedRuc.user_id == current_user.id).all()]
        if not rucs:
            return query.filter(Concession.id == -1)  # empty
        query = query.filter(Concession.holder_ruc.in_(rucs))
    elif req.scope == "opportunities":
        query = query.filter(Concession.status.in_([
            ConcessionStatus.pending,
            ConcessionStatus.expired,
            ConcessionStatus.suspended,
        ]))

    if req.q:
        like = f"%{req.q}%"
        query = query.filter(
            (Concession.code.ilike(like))
            | (Concession.name.ilike(like))
            | (Concession.holder_name.ilike(like))
        )
    if req.region:
        query = query.filter(Concession.region.ilike(f"%{req.region}%"))
    if req.status:
        query = query.filter(Concession.status == req.status)

    return query


@router.get("", response_model=List[ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return (
        db.query(Report)
        .filter(Report.user_id == current_user.id)
        .order_by(Report.generated_at.desc())
        .limit(50)
        .all()
    )


@router.post("", response_model=ReportOut, status_code=201)
def create_report(
    req: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    fmt = req.format.lower()
    if fmt not in {"xlsx", "pdf"}:
        raise HTTPException(status_code=400, detail="Formato no soportado (xlsx | pdf)")

    rows = _build_query(db, current_user, req).limit(5000).all()

    if req.scope == "opportunities":
        rows.sort(key=lambda c: score_opportunity(c)[0], reverse=True)

    if fmt == "xlsx":
        content = build_concessions_xlsx(rows)
        ext = "xlsx"
    else:
        title = {
            "all": "Reporte de concesiones",
            "mine": "Mis concesiones",
            "opportunities": "Oportunidades",
        }.get(req.scope, "Reporte de concesiones")
        content = build_concessions_pdf(rows, title=title)
        ext = "pdf"

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"user{current_user.id}_{req.scope}_{ts}.{ext}"
    file_path = REPORTS_DIR / filename
    file_path.write_bytes(content)

    report = Report(
        user_id=current_user.id,
        report_type=f"{req.report_type}_{fmt}",
        file_path=str(file_path),
        filters=req.model_dump(exclude_none=True),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report or not report.file_path:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    path = Path(report.file_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Archivo expirado o eliminado")
    media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if path.suffix == ".xlsx" else "application/pdf"
    return FileResponse(str(path), media_type=media, filename=path.name)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if report.file_path:
        try:
            Path(report.file_path).unlink(missing_ok=True)
        except OSError:
            pass
    db.delete(report)
    db.commit()
    return
