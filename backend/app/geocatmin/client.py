"""Cliente real de GEOCATMIN — ArcGIS REST API.

Fuente: Instituto Geológico, Minero y Metalúrgico del Perú (INGEMMET)
Servicio: SERV_CATASTRO_MINERO / MapServer / Layer 0

El layer NO soporta resultOffset (devuelve 400 "Pagination is not supported").
Estrategia: returnIdsOnly=true para obtener todos los OBJECTIDs, luego
batches de BATCH_SIZE usando el parámetro objectIds= .
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.datasources.base import DataSourceClient, FetchResult
from app.schemas import IngestionConcessionRow

logger = logging.getLogger(__name__)

# ── Configuración ────────────────────────────────────────────────────────────

BASE_URL = (
    "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
    "/SERV_CATASTRO_MINERO/MapServer/0/query"
)

BATCH_SIZE = 200      # OBJECTIDs por request (valores grandes pueden dar timeout)
REQUEST_DELAY = 0.3   # segundos entre batches
TIMEOUT = 90.0        # timeout por request

OUT_FIELDS = (
    "OBJECTID,CODIGOU,CONCESION,TIT_CONCES,"
    "HECTAGIS,LEYENDA,SUSTANCIA,DEPA,PROVI,DISTRI,FEC_DENU"
)

# ── Mapeo de estados (campo LEYENDA) ─────────────────────────────────────────

STATUS_MAP: dict[str, str] = {
    "TITULADO":   "active",
    "VIGENTE":    "active",
    "EN TRAMITE": "pending",
    "TRAMITE":    "pending",
    "EN TRÁMITE": "pending",
    "EXTINGUIDO": "expired",
    "CADUCADO":   "expired",
    "VENCIDO":    "expired",
    "CANCELADO":  "expired",
    "SUSPENDIDO": "suspended",
    "SUSPENDIDA": "suspended",
}

SUBSTANCE_MAP: dict[str, str] = {
    "M":  "Metálica",
    "N":  "No metálica",   # GEOCATMIN usa "N" (no "NM") para no metálica
    "NM": "No metálica",
    "MN": "Metálica y no metálica",
    "E":  "Energética",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _rings_to_wkt(rings: list) -> Optional[str]:
    if not rings or not rings[0] or len(rings[0]) < 4:
        return None
    exterior = rings[0]
    coords = ", ".join(f"{pt[0]} {pt[1]}" for pt in exterior)
    return f"POLYGON(({coords}))"


def _epoch_ms_to_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (ValueError, OSError, OverflowError):
        return None


def _safe_float(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


# ── Cliente ───────────────────────────────────────────────────────────────────

class GEOCATMINClient(DataSourceClient):
    """Descarga el catastro minero desde el ArcGIS REST de INGEMMET.

    Flujo:
      1. GET returnIdsOnly=true  → lista completa de OBJECTIDs
      2. Batches de BATCH_SIZE  → features con geometría
    """

    source_name = "GEOCATMIN"

    def __init__(self, base_url: str = BASE_URL, timeout: float = TIMEOUT):
        self._base_url = base_url
        self._timeout = timeout

    # ── Interfaz pública ──────────────────────────────────────────────────────

    def fetch_concessions(
        self,
        since: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """Descarga concesiones usando la estrategia returnIdsOnly → batches."""
        rows: list[IngestionConcessionRow] = []

        with httpx.Client(timeout=self._timeout) as http:
            # Paso 1: obtener todos los OBJECTIDs
            all_ids = self._fetch_all_ids(http)
            if all_ids is None:
                logger.error("GEOCATMIN: no se pudo obtener IDs — abortando")
                return FetchResult(
                    source=self.source_name,
                    rows=[],
                    notes="Error al obtener IDs del catastro",
                )

            if limit:
                all_ids = all_ids[:limit]

            total_ids = len(all_ids)
            logger.info("GEOCATMIN: %d OBJECTIDs obtenidos — descargando en batches de %d", total_ids, BATCH_SIZE)

            # Paso 2: batches por objectIds=
            for batch_start in range(0, total_ids, BATCH_SIZE):
                batch_ids = all_ids[batch_start : batch_start + BATCH_SIZE]
                chunk = self._fetch_batch(http, batch_ids)

                if chunk is None:
                    logger.warning("GEOCATMIN: error en batch offset=%d — continuando", batch_start)
                    continue

                rows.extend(chunk)
                batch_num = batch_start // BATCH_SIZE + 1
                logger.info(
                    "GEOCATMIN batch %d/%d: +%d filas (total=%d)",
                    batch_num,
                    -(-total_ids // BATCH_SIZE),
                    len(chunk),
                    len(rows),
                )
                time.sleep(REQUEST_DELAY)

        logger.info("GEOCATMIN sync completo — %d concesiones", len(rows))
        return FetchResult(
            source=self.source_name,
            rows=rows,
            notes=f"{len(rows)} concesiones de {total_ids} IDs",
        )

    def health_check(self) -> bool:
        try:
            params = urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
            resp = httpx.get(f"{self._base_url}?{params}", timeout=10.0)
            data = resp.json()
            count = data.get("count", 0)
            logger.info("GEOCATMIN health_check: %d registros disponibles", count)
            return count > 0
        except Exception as exc:
            logger.warning("GEOCATMIN health_check falló: %s", exc)
            return False

    # ── Internals ─────────────────────────────────────────────────────────────

    def _fetch_all_ids(self, http: httpx.Client) -> Optional[list[int]]:
        """Obtiene todos los OBJECTIDs del catastro en una sola llamada."""
        params = urlencode({
            "where": "1=1",
            "returnIdsOnly": "true",
            "f": "json",
        })
        try:
            resp = http.get(f"{self._base_url}?{params}")
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error("GEOCATMIN returnIdsOnly falló: %s", exc)
            return None

        if "error" in data:
            logger.error("GEOCATMIN API error en returnIdsOnly: %s", data["error"])
            return None

        ids = data.get("objectIds") or []
        if not ids:
            logger.warning("GEOCATMIN: returnIdsOnly devolvió lista vacía")
            return []

        return sorted(ids)

    def _fetch_batch(
        self,
        http: httpx.Client,
        object_ids: list[int],
    ) -> Optional[list[IngestionConcessionRow]]:
        """Solicita un batch de features por lista de OBJECTIDs."""
        ids_str = ",".join(str(i) for i in object_ids)
        params = urlencode({
            "objectIds": ids_str,
            "outFields": OUT_FIELDS,
            "returnGeometry": "true",
            "geometryPrecision": "6",
            "outSR": "4326",
            "f": "json",
        })

        try:
            resp = http.get(f"{self._base_url}?{params}")
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error("GEOCATMIN batch request falló: %s", exc)
            return None

        if "error" in data:
            logger.error("GEOCATMIN API error en batch: %s", data["error"])
            return None

        features = data.get("features") or []
        result = []
        for feature in features:
            row = self._map_feature(feature)
            if row is not None:
                result.append(row)
        return result

    def _map_feature(self, feature: dict) -> Optional[IngestionConcessionRow]:
        attrs = feature.get("attributes") or {}
        geom = feature.get("geometry")

        code = str(attrs.get("CODIGOU") or "").strip().upper()
        if not code:
            return None

        status_raw = str(attrs.get("LEYENDA") or "").strip().upper()
        substance_raw = str(attrs.get("SUSTANCIA") or "").strip().upper()

        geometry_wkt: Optional[str] = None
        if geom and isinstance(geom.get("rings"), list):
            geometry_wkt = _rings_to_wkt(geom["rings"])

        try:
            return IngestionConcessionRow(
                code=code,
                name=str(attrs.get("CONCESION") or code).strip(),
                holder_name=str(attrs.get("TIT_CONCES") or "").strip() or None,
                status=STATUS_MAP.get(status_raw, "active"),
                concession_type=SUBSTANCE_MAP.get(substance_raw) or (substance_raw or None),
                region=str(attrs.get("DEPA") or "").strip().title() or None,
                province=str(attrs.get("PROVI") or "").strip().title() or None,
                district=str(attrs.get("DISTRI") or "").strip().title() or None,
                area_hectares=_safe_float(attrs.get("HECTAGIS")),
                registration_date=_epoch_ms_to_dt(attrs.get("FEC_DENU")),
                geometry_wkt=geometry_wkt,
                source=self.source_name,
                raw=dict(attrs),
            )
        except Exception as exc:
            logger.warning("GEOCATMIN fila inválida (code=%s): %s", code, exc)
            return None
