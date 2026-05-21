"""Servicio de extracción de expedientes — orquesta descarga + OCR + DB."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional, Callable

from sqlalchemy.orm import Session

from app.expediente.client import download_pages, download_page
from app.expediente.extractor import (
    compute_risk_score,
    extract_dni,
    extract_emails,
    extract_overlapping,
    extract_petition_date,
    extract_ruc,
    extract_serfor_opinion,
    extract_title_resolution,
    extract_utm_vertices,
    ocr_pages,
    _add_business_days,
)
from app.models import Concession

logger = logging.getLogger(__name__)

PROGRESS_TTL = 3600  # 1 hora


def _redis_key(concession_id: int) -> str:
    return f"expediente:{concession_id}:progress"


def _set_progress(concession_id: int, stage: str, message: str,
                  page: int = 0, total: int = 0):
    """Guarda el progreso en Redis (no bloquea si Redis falla)."""
    try:
        from app.core.redis import redis_client
        data = json.dumps({
            "stage":   stage,
            "message": message,
            "page":    page,
            "total":   total,
        })
        redis_client.setex(_redis_key(concession_id), PROGRESS_TTL, data)
    except Exception:
        pass


def get_progress(concession_id: int) -> dict:
    """Lee el progreso desde Redis."""
    try:
        from app.core.redis import redis_client
        raw = redis_client.get(_redis_key(concession_id))
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return {"stage": "idle", "message": "", "page": 0, "total": 0}


def extract_expediente(
    db: Session,
    concession: Concession,
    full_scan: bool = True,           # por defecto analizar todo
) -> Optional[dict]:
    """Descarga páginas, hace OCR con Gemini/Tesseract, extrae datos y guarda en DB.

    Progreso disponible via get_progress(concession.id) en tiempo real.
    """
    cid = concession.id
    sidemcat = concession.sidemcat_data or {}
    cod_archivo = sidemcat.get("pdf_cod_archivo") or sidemcat.get("codArchivo")
    cod_almacen = 1

    if not cod_archivo:
        _set_progress(cid, "error", "Sin cod_archivo en SIDEMCAT")
        return None

    cod_archivo = int(cod_archivo)

    # ── Detectar total de páginas ─────────────────────────────────────────────
    _set_progress(cid, "detecting", "Detectando número de páginas del expediente…")

    # Primero usar el dato de SIDEMCAT si existe
    total_pages = int(sidemcat.get("pdf_num_paginas") or 0)

    if not total_pages:
        # Detectar con búsqueda binaria (descarga la primera y busca el límite)
        _set_progress(cid, "detecting", "Escaneando extensión del expediente…")
        from app.expediente.client import count_pages
        total_pages = count_pages(cod_archivo, cod_almacen)
        if not total_pages:
            _set_progress(cid, "error", "No se pudo acceder al expediente en INGEMMET")
            return None

    _set_progress(cid, "detecting",
                  f"Expediente detectado: {total_pages} páginas", 0, total_pages)

    # ── Selección de páginas ─────────────────────────────────────────────────
    from app.core.config import settings

    if full_scan or settings.GEMINI_API_KEY:
        # Con Gemini: enviar TODAS las páginas (1M token context lo soporta)
        pages_to_scan = list(range(1, total_pages + 1))
    else:
        # Sin Gemini (Tesseract): escaneo selectivo para no tardar demasiado
        start_pages = list(range(2, min(8, total_pages + 1)))
        end_pages   = list(range(max(1, total_pages - 9), total_pages + 1))
        pages_to_scan = sorted(set(start_pages + end_pages))

    logger.info(
        "Expediente %s (codArchivo=%d): %d páginas totales, analizando %d",
        concession.code, cod_archivo, total_pages, len(pages_to_scan)
    )

    # ── Descarga con progreso ─────────────────────────────────────────────────
    _set_progress(cid, "downloading", "Iniciando descarga de páginas…", 0, len(pages_to_scan))

    def on_page_downloaded(done: int, total: int, page_num: int):
        _set_progress(
            cid, "downloading",
            f"Descargando página {page_num} ({done}/{total})…",
            done, total,
        )

    pages_bytes = download_pages(
        cod_archivo, cod_almacen, pages_to_scan,
        progress_cb=on_page_downloaded,
    )

    if not pages_bytes:
        _set_progress(cid, "error", "No se pudo descargar ninguna página")
        return None

    # ── OCR / Análisis ────────────────────────────────────────────────────────
    gemini_key = settings.GEMINI_API_KEY

    if gemini_key:
        _set_progress(cid, "analyzing",
                      f"Analizando {len(pages_bytes)} páginas con Gemini…",
                      len(pages_bytes), len(pages_bytes))

        logger.info("Usando Gemini Flash para OCR de %s", concession.code)
        from app.expediente.gemini_extractor import ocr_pages_with_gemini
        gemini_data = ocr_pages_with_gemini(pages_bytes, gemini_key, concession.code)

        if gemini_data:
            emails     = gemini_data.get("emails") or []
            ruc        = gemini_data.get("ruc")
            dni        = gemini_data.get("dni")
            title_info = gemini_data.get("resolution") or {}
            serfor     = gemini_data.get("serfor") or {}
            overlaps   = gemini_data.get("overlapping") or {}
            vertices   = gemini_data.get("utm_vertices") or []
            pet_date   = gemini_data.get("fecha_petitorio")
            extra      = gemini_data.get("extra") or {}
            ocr_engine = "gemini-2.5-flash-lite"
        else:
            logger.warning("Gemini falló para %s, usando Tesseract", concession.code)
            gemini_key = None

    if not gemini_key:
        _set_progress(cid, "analyzing",
                      f"Analizando {len(pages_bytes)} páginas con OCR local…",
                      len(pages_bytes), len(pages_bytes))

        texts      = ocr_pages(pages_bytes)
        emails     = extract_emails(texts)
        ruc        = extract_ruc(texts)
        dni        = extract_dni(texts, ruc)
        title_info = extract_title_resolution(texts)
        serfor     = extract_serfor_opinion(texts)
        overlaps   = extract_overlapping(texts, concession.code)
        vertices   = extract_utm_vertices(texts)
        pet_date   = extract_petition_date(texts)
        extra      = {}
        ocr_engine = "tesseract"

    # ── Calcular fecha límite impugnación ─────────────────────────────────────
    if not title_info.get("fecha_limite_impugnacion") and title_info.get("fecha_publicacion_peruano"):
        title_info["fecha_limite_impugnacion"] = _add_business_days(
            title_info["fecha_publicacion_peruano"], 15
        )

    # ── Duración del proceso ──────────────────────────────────────────────────
    process_days = None
    if pet_date and title_info.get("fecha_titulo"):
        try:
            d0 = datetime.strptime(pet_date, "%Y-%m-%d")
            d1 = datetime.strptime(title_info["fecha_titulo"], "%Y-%m-%d")
            process_days = (d1 - d0).days
        except Exception:
            pass

    # ── Construir resultado ───────────────────────────────────────────────────
    data = {
        # Contacto
        "titular_email":        emails[0] if emails else None,
        "titular_email_alt":    emails[1] if len(emails) > 1 else None,
        "titular_emails":       emails,
        "titular_dni":          dni,
        "titular_ruc":          ruc,
        "titular_telefono":     extra.get("telefono"),
        "titular_direccion":    extra.get("direccion"),
        # Fechas clave
        "fecha_petitorio":              pet_date,
        "fecha_titulo":                 title_info.get("fecha_titulo"),
        "nro_resolucion_titulo":        title_info.get("nro_resolucion"),
        "autoridad_firmante":           title_info.get("autoridad_firmante"),
        "fecha_publicacion_peruano":    title_info.get("fecha_publicacion_peruano"),
        "fecha_limite_impugnacion":     title_info.get("fecha_limite_impugnacion"),
        "duracion_proceso_dias":        process_days,
        # Opiniones técnicas
        "serfor":       serfor,
        "ana":          extra.get("ana") or {},
        "cultura":      extra.get("cultura") or {},
        # Ubicación técnica
        "utm_vertices":     vertices,
        "cuadriculas":      extra.get("cuadriculas") or [],
        "utm_zona":         extra.get("utm_zona"),
        # Historial del expediente
        "oposiciones":          extra.get("oposiciones") or [],
        "resoluciones_previas": extra.get("resoluciones_previas") or [],
        "modificaciones":       extra.get("modificaciones") or [],
        # Superposiciones
        "overlapping": overlaps,
        # Meta
        "pages_scanned": len(pages_bytes),
        "total_pages":   total_pages,
        "full_scan":     full_scan or bool(settings.GEMINI_API_KEY),
        "cod_archivo":   cod_archivo,
        "ocr_engine":    ocr_engine,
    }

    # Agregar risk score
    data.update(compute_risk_score({
        **data,
        "has_debt": (sidemcat.get("has_debt") or False),
    }))

    # ── Guardar en DB ─────────────────────────────────────────────────────────
    _set_progress(cid, "saving", "Guardando resultados…", total_pages, total_pages)

    concession.expediente_data       = data
    concession.expediente_fetched_at = datetime.now(timezone.utc)

    if ruc and not concession.holder_ruc:
        concession.holder_ruc = ruc
    if title_info.get("fecha_titulo") and not concession.title_date:
        try:
            concession.title_date = datetime.strptime(
                title_info["fecha_titulo"], "%Y-%m-%d"
            ).date()
        except Exception:
            pass

    db.commit()

    _set_progress(cid, "done",
                  f"Análisis completado · {len(pages_bytes)} páginas · {ocr_engine}",
                  total_pages, total_pages)

    logger.info(
        "Expediente %s: %d/%d páginas · ocr=%s · email=%s · riesgo=%s(%d)",
        concession.code, len(pages_bytes), total_pages,
        ocr_engine, data["titular_email"],
        data["risk_level"], data["risk_score"],
    )

    # Actualizar embedding semántico
    try:
        from app.jobs.embeddings import update_embedding_for_concession
        update_embedding_for_concession.delay(concession.id)
    except Exception:
        pass

    return data
