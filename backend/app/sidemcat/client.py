"""Cliente SIDEMCAT — API completa descubierta por reverse-engineering.

Endpoints disponibles (sin autenticación):
  GetTipoDocumentoPorCodigo/{code}   → tipo de expediente
  GetConsultaDm/2/{code}             → estado, nombre, tipo
  GetEncabezado/{code}               → titular, doCodigo, nroPaginas, codArchivo
  GetConsultaResolucionesDm/{code}   → resoluciones (incluye fecha titulación)
  GetVigencia/{code}                 → pagos anuales de vigencia
  GetVigenciaDetalle/{code}          → detalle de pagos (banco, fecha, monto)
  GetPenalidad/{code}                → penalidades por año
  GetPenalidadDetalle/{code}         → detalle de penalidades
  Serfor/GetSerfor?codigo={code}     → opinión SERFOR
  GetConsultaCuadernos/{code}        → cuadernos del expediente
  CertificadoDevolucion/GetCertificadoDevolucion?codigo={code}

La FECHA DE TITULACIÓN se obtiene de GetConsultaResolucionesDm:
  → resolución con reDesRes = "CONCESION MINERA" → su fRes = fecha titulación
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE = "https://digital.ingemmet.gob.pe/serviciosdigitales/services/api"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
    "Accept": "application/json",
    "Referer": "https://digital.ingemmet.gob.pe/serviciosdigitales/app/sidemcat/consulta",
    "Origin": "https://digital.ingemmet.gob.pe",
}


def _parse_date(s: str) -> Optional[datetime]:
    """Parse YYYYMMDD o DD/MM/YYYY → datetime UTC."""
    if not s:
        return None
    s = s.strip()
    try:
        if len(s) == 8 and s.isdigit():
            return datetime(int(s[:4]), int(s[4:6]), int(s[6:8]), tzinfo=timezone.utc)
        if len(s) == 10 and s[2] == "/" and s[5] == "/":
            d, m, y = s.split("/")
            return datetime(int(y), int(m), int(d), tzinfo=timezone.utc)
    except (ValueError, OverflowError):
        pass
    return None


class SIDEMCATClient:
    """Consulta on-demand de SIDEMCAT — todos los datos disponibles para una concesión."""

    source_name = "SIDEMCAT"

    def __init__(self, timeout: float = 25.0):
        self._timeout = timeout

    def fetch_concession(self, code: str) -> Optional[dict]:
        """Obtiene todos los datos disponibles de SIDEMCAT para un código."""
        code = code.strip().upper()
        try:
            with httpx.Client(timeout=self._timeout, verify=False, headers=HEADERS) as http:
                tipo      = self._get(http, f"Consulta/GetTipoDocumentoPorCodigo/{code}")
                dm        = self._get(http, f"Consulta/GetConsultaDm/2/{code}")
                enc       = self._get(http, f"Consulta/GetEncabezado/{code}")
                res       = self._get(http, f"Consulta/GetConsultaResolucionesDm/{code}")
                vig       = self._get(http, f"Consulta/GetVigencia/{code}")
                vig_det   = self._get(http, f"Consulta/GetVigenciaDetalle/{code}")
                pen       = self._get(http, f"Consulta/GetPenalidad/{code}")
                pen_det   = self._get(http, f"Consulta/GetPenalidadDetalle/{code}")
                serfor    = self._get(http, f"Serfor/GetSerfor?codigo={code}")
                cuadernos = self._get(http, f"Consulta/GetConsultaCuadernos/{code}")

            if not dm:
                return None

            dm_res = ((dm.get("data") or {}).get("resultado") or [{}])[0]
            if not dm_res:
                return None

            enc_res  = (enc or {}).get("data", {}).get("resultado") or {}
            tipo_res = (tipo or {}).get("data", {}).get("resultado") or {}

            # ── Resoluciones → extraer fecha de titulación ─────────────────────
            resoluciones = []
            title_date = None
            for r in ((res or {}).get("data") or {}).get("resultado") or []:
                d = _parse_date(r.get("fRes") or r.get("fResolucion", ""))
                resoluciones.append({
                    "numero":       r.get("nroResolucion"),
                    "descripcion":  r.get("reDesRes"),
                    "fecha":        r.get("fResolucion"),
                    "notificacion": r.get("fNotificacion"),
                    "nro_notif":    r.get("nroNotificacion"),
                })
                # Buscar la resolución de titulación por distintas descripciones posibles
                desc = (r.get("reDesRes") or "").upper()
                is_title_res = any(kw in desc for kw in (
                    "CONCESION MINERA",
                    "OTORGAMIENTO DE CONCESION",
                    "TITULACION",
                    "TITULO DE CONCESION",
                    "CONCESION NO METALICA",
                    "CONCESION ENERGETICA",
                ))
                if is_title_res and d and (title_date is None or d > title_date):
                    title_date = d

            # ── Vigencia ───────────────────────────────────────────────────────
            vigencias = []
            for v in ((vig or {}).get("data") or {}).get("resultado") or []:
                vigencias.append({
                    "year":    v.get("dvAnoeje") or v.get("dvAnoEje"),
                    "owed":    v.get("dvDeudol", "").strip(),
                    "paid":    v.get("dvPagdol", "").strip(),
                    "balance": v.get("saldo", "").strip(),
                    "ha":      v.get("dvHasdol"),
                })

            # ── Vigencia detalle ───────────────────────────────────────────────
            vig_detalles = []
            for v in ((vig_det or {}).get("data") or {}).get("resultado") or []:
                vig_detalles.append({
                    "year":   v.get("pvAnoEje"),
                    "banco":  v.get("baDesAbr"),
                    "nro":    v.get("pvNroDoc"),
                    "fecha":  v.get("pvFecPag"),
                    "monto":  v.get("pvMonPag"),
                })

            # ── Penalidades ────────────────────────────────────────────────────
            penalidades = []
            for p in ((pen or {}).get("data") or {}).get("resultado") or []:
                penalidades.append({
                    "year":    p.get("dvAnoEje"),
                    "owed":    p.get("dvDeuPen"),
                    "paid":    p.get("dvPagPen"),
                    "balance": p.get("saldo"),
                })

            # ── SERFOR ─────────────────────────────────────────────────────────
            serfor_res = (serfor or {}).get("data", {}).get("resultado") or {}

            # ── Deuda vigencia ─────────────────────────────────────────────────
            has_debt = any(
                v.get("balance") and "-" in str(v.get("balance", ""))
                for v in vigencias
            )

            # ── PDF info ───────────────────────────────────────────────────────
            doc_codigo  = enc_res.get("doCodigo")
            cod_archivo = enc_res.get("codArchivo")
            num_paginas = enc_res.get("paNumPag")

            return {
                "code":            code,
                "sidemcat_status": dm_res.get("seDesSit"),
                "estado_detail":   dm_res.get("estado"),
                "ubicacion":       dm_res.get("ubicacion"),
                "tipo":            tipo_res.get("descripcion") or dm_res.get("teDesTip"),
                "tipo_expediente": tipo_res.get("tipoExpediente"),
                "medida_cautelar": dm_res.get("mCautelar"),
                "cod_titular":     enc_res.get("tiCodTit"),
                "nro_titulares":   enc_res.get("nroTitulares"),
                "porcentaje":      enc_res.get("tiPorPar"),
                "title_date":      title_date.isoformat() if title_date else None,
                "is_titled":       (dm_res.get("estado") or "").upper().startswith("TIT-"),
                "resoluciones":    resoluciones,
                "vigencias":       vigencias,
                "vig_detalles":    vig_detalles,
                "penalidades":     penalidades,
                "has_debt":        has_debt,
                "vigencia_years":  len(vigencias),
                "serfor":          serfor_res if serfor_res else None,
                "cuadernos":       ((cuadernos or {}).get("data") or {}).get("resultado") or [],
                "pdf_doc_codigo":  doc_codigo,
                "pdf_cod_archivo": cod_archivo,
                "pdf_num_paginas": num_paginas,
                "has_pdf":         bool(doc_codigo),
            }

        except Exception as exc:
            logger.error("SIDEMCAT fetch error (code=%s): %s", code, exc)
            return None

    def health_check(self) -> bool:
        try:
            with httpx.Client(timeout=10.0, verify=False, headers=HEADERS) as http:
                resp = http.get(f"{BASE}/Demarcacion/GetDepartamentos")
                return resp.status_code == 200
        except Exception:
            return False

    def _get(self, http: httpx.Client, path: str) -> Optional[dict]:
        try:
            resp = http.get(f"{BASE}/{path}")
            resp.raise_for_status()
            data = resp.json()
            return data if data.get("code") == 200 else None
        except Exception as exc:
            logger.warning("SIDEMCAT %s → %s", path, exc)
            return None
