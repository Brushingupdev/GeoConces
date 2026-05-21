from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.common.dependencies import require_admin
from app.core.database import get_db
from app.models import DataImportLog, User
from app.schemas import IngestionConcessionRequest, IngestionConcessionResult
from app.ingestion.parser import IngestionParseError, parse_tabular_upload
from app.ingestion.service import IngestionService


router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/concessions", response_model=IngestionConcessionResult)
def ingest_concessions(
    payload: IngestionConcessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = IngestionService(db)
    rows = [row.model_dump() for row in payload.rows]
    return service.ingest_concessions(
        rows=rows,
        source=payload.source,
        import_type=payload.import_type,
    )


@router.post("/concessions/upload", response_model=IngestionConcessionResult)
async def ingest_concessions_upload(
    file: UploadFile = File(...),
    source: str = "upload",
    import_type: str = "file_upload",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    content = await file.read()
    try:
        rows = parse_tabular_upload(content, file.filename or "upload.csv")
    except IngestionParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    service = IngestionService(db)
    return service.ingest_concessions(
        rows=rows,
        source=source,
        import_type=import_type,
    )


@router.get("/logs")
def list_import_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return (
        db.query(DataImportLog)
        .order_by(DataImportLog.started_at.desc())
        .limit(limit)
        .all()
    )
