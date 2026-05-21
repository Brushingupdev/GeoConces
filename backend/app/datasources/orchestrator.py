"""Orchestrates syncing from external data sources into the database."""

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.datasources.registry import get_client, list_sources
from app.ingestion.service import IngestionService
from app.models import DataImportLog

# Commit each CHUNK_SIZE rows to avoid giant single-transaction commits
CHUNK_SIZE = 500


def sync_source(
    db: Session,
    source: str,
    since: Optional[str] = None,
    limit: Optional[int] = None,
) -> DataImportLog:
    """Run one external source through the existing ingestion pipeline.

    Rows are ingested in chunks of CHUNK_SIZE to keep transactions small
    and avoid memory/timeout issues with large catalogs (e.g. 64k records).
    """
    client = get_client(source)
    started = datetime.now(timezone.utc)

    try:
        result = client.fetch_concessions(since=since, limit=limit)
    except NotImplementedError as exc:
        log = DataImportLog(
            source=client.source_name,
            import_type="api_sync",
            records_processed=0,
            records_created=0,
            records_updated=0,
            started_at=started,
            finished_at=datetime.now(timezone.utc),
            error_message=f"not_implemented: {exc}",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    if not result.rows:
        log = DataImportLog(
            source=client.source_name,
            import_type="api_sync",
            records_processed=0,
            records_created=0,
            records_updated=0,
            started_at=started,
            finished_at=datetime.now(timezone.utc),
            error_message=result.notes,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    service = IngestionService(db)
    all_rows = [row.model_dump() for row in result.rows]

    # Aggregate stats across all chunks
    total_processed = 0
    total_created = 0
    total_updated = 0
    last_log_id: Optional[int] = None

    for i in range(0, len(all_rows), CHUNK_SIZE):
        chunk = all_rows[i : i + CHUNK_SIZE]
        outcome = service.ingest_concessions(
            rows=chunk,
            source=client.source_name,
            import_type="api_sync",
        )
        total_processed += outcome["processed"]
        total_created += outcome["created"]
        total_updated += outcome["updated"]
        last_log_id = outcome["import_log_id"]

    # Return the last import log (most recent chunk)
    return db.query(DataImportLog).filter(DataImportLog.id == last_log_id).first()


def sync_all(db: Session, since: Optional[str] = None) -> List[DataImportLog]:
    return [sync_source(db, source, since=since) for source in list_sources()]
