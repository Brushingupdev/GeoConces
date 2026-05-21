from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from shapely.geometry import mapping, shape
from shapely import wkt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Concession,
    ConcessionEvent,
    ConcessionGeometry,
    ConcessionStatus,
    DataImportLog,
)


STATUS_ALIASES = {
    # Inglés (internos)
    "active": ConcessionStatus.active,
    "pending": ConcessionStatus.pending,
    "expired": ConcessionStatus.expired,
    "suspended": ConcessionStatus.suspended,
    # Español genérico
    "activo": ConcessionStatus.active,
    "activa": ConcessionStatus.active,
    "vigente": ConcessionStatus.active,
    "pendiente": ConcessionStatus.pending,
    "en tramite": ConcessionStatus.pending,
    "en trámite": ConcessionStatus.pending,
    "expirado": ConcessionStatus.expired,
    "vencido": ConcessionStatus.expired,
    "caducado": ConcessionStatus.expired,
    "suspendido": ConcessionStatus.suspended,
    "suspendida": ConcessionStatus.suspended,
    # GEOCATMIN / INGEMMET (campo LEYENDA)
    "titulado": ConcessionStatus.active,
    "extinguido": ConcessionStatus.expired,
    "cancelado": ConcessionStatus.expired,
    "tramite": ConcessionStatus.pending,
}

TRACKED_FIELDS = (
    "name",
    "holder_name",
    "holder_ruc",
    "status",
    "concession_type",
    "region",
    "province",
    "district",
    "area_hectares",
    "registration_date",
    "title_date",
    "expiration_date",
    "source",
)


@dataclass
class IngestionStats:
    processed: int = 0
    created: int = 0
    updated: int = 0
    events_created: int = 0


class IngestionService:
    """
    Coordinates normalization, upserts, geometry persistence, and change events.
    """

    def __init__(self, db: Session):
        self.db = db

    def ingest_concessions(
        self,
        rows: list[dict[str, Any]],
        source: str = "manual",
        import_type: str = "manual",
    ) -> dict[str, int]:
        stats = IngestionStats()
        started_at = datetime.now(timezone.utc)
        import_log = DataImportLog(
            source=source,
            import_type=import_type,
            records_processed=0,
            records_created=0,
            records_updated=0,
            started_at=started_at,
        )
        self.db.add(import_log)
        self.db.flush()

        try:
            for row in rows:
                normalized = self.normalize_row(row, source=source)
                concession = (
                    self.db.query(Concession)
                    .filter(Concession.code == normalized["code"])
                    .first()
                )

                if concession is None:
                    concession = Concession(**normalized)
                    self.db.add(concession)
                    self.db.flush()
                    stats.created += 1
                    stats.events_created += self._create_event(
                        concession.id,
                        "concession_created",
                        f"Concesion {concession.code} creada",
                        {"source": source},
                    )
                else:
                    changed_fields = self._apply_updates(concession, normalized)
                    if changed_fields:
                        stats.updated += 1
                        stats.events_created += self._create_event(
                            concession.id,
                            "concession_updated",
                            f"Concesion {concession.code} actualizada",
                            {"fields": changed_fields, "source": source},
                        )

                geometry_changed = self.upsert_geometry(
                    concession_id=concession.id,
                    geometry_wkt=row.get("geometry_wkt"),
                    geometry_geojson=row.get("geometry_geojson"),
                )
                if geometry_changed:
                    stats.events_created += self._create_event(
                        concession.id,
                        "geometry_updated",
                        f"Geometria actualizada para {concession.code}",
                        {"source": source},
                    )

                stats.processed += 1

            import_log.records_processed = stats.processed
            import_log.records_created = stats.created
            import_log.records_updated = stats.updated
            import_log.finished_at = datetime.now(timezone.utc)
            self.db.commit()
        except Exception as exc:
            self.db.rollback()
            failed_log = DataImportLog(
                source=source,
                import_type=import_type,
                records_processed=stats.processed,
                records_created=stats.created,
                records_updated=stats.updated,
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                error_message=str(exc),
            )
            self.db.add(failed_log)
            self.db.commit()
            raise

        return {
            "processed": stats.processed,
            "created": stats.created,
            "updated": stats.updated,
            "events_created": stats.events_created,
            "import_log_id": import_log.id,
        }

    def normalize_status(self, raw_status: str | None) -> ConcessionStatus:
        if not raw_status:
            return ConcessionStatus.pending

        normalized = raw_status.strip().lower()
        return STATUS_ALIASES.get(normalized, ConcessionStatus.pending)

    def normalize_row(self, row: dict[str, Any], source: str) -> dict[str, Any]:
        code = str(row["code"]).strip().upper()
        return {
            "code": code,
            "name": self._clean_text(row.get("name")) or code,
            "holder_name": self._clean_text(row.get("holder_name")),
            "holder_ruc": self._clean_ruc(row.get("holder_ruc")),
            "status": self.normalize_status(row.get("status")),
            "concession_type": self._clean_text(row.get("concession_type")),
            "region": self._clean_text(row.get("region")),
            "province": self._clean_text(row.get("province")),
            "district": self._clean_text(row.get("district")),
            "area_hectares": self._clean_float(row.get("area_hectares")),
            "registration_date": self._clean_datetime(row.get("registration_date")),
            "title_date": self._clean_datetime(row.get("title_date")),
            "expiration_date": self._clean_datetime(row.get("expiration_date")),
            "source": self._clean_text(row.get("source")) or source,
        }

    def upsert_geometry(
        self,
        concession_id: int,
        geometry_wkt: str | None = None,
        geometry_geojson: dict[str, Any] | None = None,
    ) -> bool:
        if not geometry_wkt and not geometry_geojson:
            return False

        geom_wkt = self._geometry_to_ewkt(geometry_wkt, geometry_geojson)
        centroid_wkt = self._centroid_ewkt(geometry_wkt, geometry_geojson)
        geometry = (
            self.db.query(ConcessionGeometry)
            .filter(ConcessionGeometry.concession_id == concession_id)
            .first()
        )

        if geometry is None:
            geometry = ConcessionGeometry(
                concession_id=concession_id,
                geom=geom_wkt,
                centroid=centroid_wkt,
            )
            self.db.add(geometry)
            self.db.flush()
            return True

        current_geojson = self.db.scalar(func.ST_AsGeoJSON(geometry.geom))
        incoming_geojson = self._geojson_string(geometry_wkt, geometry_geojson)
        if current_geojson and json.loads(current_geojson) == json.loads(incoming_geojson):
            return False

        geometry.geom = geom_wkt
        geometry.centroid = centroid_wkt
        return True

    def _apply_updates(self, concession: Concession, normalized: dict[str, Any]) -> list[str]:
        changed_fields: list[str] = []
        for field in TRACKED_FIELDS:
            incoming = normalized[field]
            current = getattr(concession, field)
            if current != incoming:
                setattr(concession, field, incoming)
                changed_fields.append(field)
        return changed_fields

    def _create_event(
        self,
        concession_id: int,
        event_type: str,
        title: str,
        payload: dict[str, Any] | None = None,
    ) -> int:
        event = ConcessionEvent(
            concession_id=concession_id,
            event_type=event_type,
            title=title,
            payload=payload or {},
        )
        self.db.add(event)
        self.db.flush()
        return 1

    def _geometry_to_ewkt(
        self,
        geometry_wkt: str | None,
        geometry_geojson: dict[str, Any] | None,
    ) -> str:
        geometry = wkt.loads(geometry_wkt) if geometry_wkt else shape(geometry_geojson)
        return f"SRID=4326;{geometry.wkt}"

    def _centroid_ewkt(
        self,
        geometry_wkt: str | None,
        geometry_geojson: dict[str, Any] | None,
    ) -> str:
        geometry = wkt.loads(geometry_wkt) if geometry_wkt else shape(geometry_geojson)
        return f"SRID=4326;{geometry.centroid.wkt}"

    def _geojson_string(
        self,
        geometry_wkt: str | None,
        geometry_geojson: dict[str, Any] | None,
    ) -> str:
        geometry = wkt.loads(geometry_wkt) if geometry_wkt else shape(geometry_geojson)
        return json.dumps(mapping(geometry), sort_keys=True)

    def _clean_text(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _clean_ruc(self, value: Any) -> str | None:
        text = self._clean_text(value)
        if text is None:
            return None
        digits = "".join(char for char in text if char.isdigit())
        return digits or None

    def _clean_float(self, value: Any) -> float | None:
        if value in (None, ""):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        return float(str(value).replace(",", ""))

    def _clean_datetime(self, value: Any) -> datetime | None:
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value
        text = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(text)
