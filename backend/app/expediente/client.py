"""Descarga páginas del expediente digitalizado de INGEMMET.

Endpoint descubierto por reverse-engineering:
  GET /serviciosdigitales/services/api/Consulta/GetImgOfPdf/{codArchivo}/{codAlmacen}/{pagina}

Retorna JPEG de la página solicitada.
codArchivo y codAlmacen vienen de GetEncabezado/{code} del cliente SIDEMCAT.
"""

from __future__ import annotations

import io
import logging
import ssl
import time
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

BASE = "https://digital.ingemmet.gob.pe/serviciosdigitales/services/api"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
    "Referer":    "https://digital.ingemmet.gob.pe/serviciosdigitales/app/sidemcat/consulta",
}

# Páginas por fase de extracción
PHASE_FAST = list(range(2, 11)) + list(range(95, 102))   # ~17 páginas → ~10s
PHASE_FULL = list(range(2, 11)) + list(range(15, 65)) + list(range(85, 102))  # ~65 págs → ~45s


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def download_page(cod_archivo: int, cod_almacen: int, page: int,
                  timeout: float = 20.0) -> Optional[bytes]:
    """Descarga una página como bytes JPEG. Retorna None si falla."""
    url = f"{BASE}/Consulta/GetImgOfPdf/{cod_archivo}/{cod_almacen}/{page}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as r:
            if r.status == 200:
                return r.read()
    except Exception as exc:
        logger.debug("GetImgOfPdf page=%d: %s", page, exc)
    return None


def download_pages(
    cod_archivo: int,
    cod_almacen: int,
    pages: list[int],
    delay: float = 0.15,
    progress_cb=None,           # callback(page_done, total)
) -> dict[int, bytes]:
    """Descarga múltiples páginas. Retorna {pagina: bytes}."""
    result: dict[int, bytes] = {}
    total = len(pages)
    for i, page in enumerate(pages, 1):
        data = download_page(cod_archivo, cod_almacen, page)
        if data:
            result[page] = data
        if progress_cb:
            progress_cb(i, total, page)
        time.sleep(delay)
    return result


def count_pages(cod_archivo: int, cod_almacen: int,
                max_pages: int = 200) -> int:
    """Detecta cuántas páginas tiene el expediente con búsqueda binaria."""
    # Verificar si la primera página existe
    if not download_page(cod_archivo, cod_almacen, 1):
        return 0

    lo, hi = 1, max_pages
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if download_page(cod_archivo, cod_almacen, mid):
            lo = mid
        else:
            hi = mid - 1
    return lo
