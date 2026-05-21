"""Cliente REINFO — ArcGIS REST API (MINEM / INGEMMET).

Fuente: Registro Integral de Formalización Minera (REINFO)
Servicio: SERV_REINFO / MapServer / Layer 0

Contiene 87k+ registros de mineros informales en proceso de formalización.
Dato clave: M_RUC — número de RUC del titular, vinculado a ID_UNIDAD (código concesión).

Estrategia de paginación: returnIdsOnly=true → batches por objectIds=
(mismo patrón que GEOCATMIN — el layer tampoco soporta resultOffset).
"""

from __future__ import annotations

import logging
import time
from typing import Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

BASE_URL = (
    "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
    "/SERV_REINFO/MapServer/0/query"
)

BATCH_SIZE = 500
REQUEST_DELAY = 0.3
TIMEOUT = 60.0

OUT_FIELDS = "M_RUC,ID_UNIDAD,NOMBRE_DM,NOMBRE_MIN,DEPARTAMENTO,TIPO_ACT,ESTADO,COD_REINFO"


class REINFOClient:
    """Descarga el registro REINFO y devuelve un dict {code → ruc}."""

    def __init__(self, base_url: str = BASE_URL, timeout: float = TIMEOUT):
        self._base_url = base_url
        self._timeout = timeout

    def fetch_ruc_map(self, limit: Optional[int] = None) -> dict[str, str]:
        """Retorna {ID_UNIDAD: M_RUC} para todos los registros con RUC válido."""
        ruc_map: dict[str, str] = {}

        with httpx.Client(timeout=self._timeout) as http:
            all_ids = self._fetch_all_ids(http)
            if all_ids is None:
                logger.error("REINFO: no se pudo obtener IDs")
                return {}

            if limit:
                all_ids = all_ids[:limit]

            total = len(all_ids)
            logger.info("REINFO: %d registros — descargando en batches de %d", total, BATCH_SIZE)

            for i in range(0, total, BATCH_SIZE):
                batch = all_ids[i : i + BATCH_SIZE]
                chunk = self._fetch_batch(http, batch)
                if chunk:
                    ruc_map.update(chunk)
                batch_num = i // BATCH_SIZE + 1
                logger.info(
                    "REINFO batch %d/%d: +%d RUCs (total=%d)",
                    batch_num, -(-total // BATCH_SIZE), len(chunk or {}), len(ruc_map),
                )
                time.sleep(REQUEST_DELAY)

        logger.info("REINFO: %d entradas RUC obtenidas", len(ruc_map))
        return ruc_map

    def health_check(self) -> bool:
        try:
            params = urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
            resp = httpx.get(f"{self._base_url}?{params}", timeout=10.0)
            count = resp.json().get("count", 0)
            return count > 0
        except Exception:
            return False

    # ── Internals ─────────────────────────────────────────────────────────────

    def _fetch_all_ids(self, http: httpx.Client) -> Optional[list[int]]:
        params = urlencode({"where": "1=1", "returnIdsOnly": "true", "f": "json"})
        try:
            resp = http.get(f"{self._base_url}?{params}")
            resp.raise_for_status()
            data = resp.json()
            return sorted(data.get("objectIds") or [])
        except Exception as exc:
            logger.error("REINFO returnIdsOnly falló: %s", exc)
            return None

    def _fetch_batch(self, http: httpx.Client, ids: list[int]) -> Optional[dict[str, str]]:
        params = urlencode({
            "objectIds": ",".join(map(str, ids)),
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        })
        try:
            resp = http.get(f"{self._base_url}?{params}")
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error("REINFO batch falló: %s", exc)
            return None

        if "error" in data:
            logger.error("REINFO API error: %s", data["error"])
            return None

        result: dict[str, str] = {}
        for feat in data.get("features") or []:
            attrs = feat.get("attributes") or {}
            code = str(attrs.get("ID_UNIDAD") or "").strip().upper()
            ruc = str(attrs.get("M_RUC") or "").strip()
            # Validate RUC: 11 digits
            if code and ruc and ruc.isdigit() and len(ruc) == 11:
                result[code] = ruc
        return result
