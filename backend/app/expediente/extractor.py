"""OCR + parsing del expediente minero digitalizado.

Usa Tesseract con idioma español. Extrae campos estructurados
mediante regex calibrados con expedientes reales de INGEMMET.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "setiembre": 9, "septiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def _ocr(image_bytes: bytes) -> str:
    """Extrae texto de una imagen JPEG con Tesseract."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img, lang="spa", config="--psm 3")
    except Exception as exc:
        logger.warning("OCR error: %s", exc)
        return ""


def ocr_pages(pages_bytes: dict[int, bytes]) -> dict[int, str]:
    """OCR de múltiples páginas. Retorna {pagina: texto}."""
    return {pg: _ocr(data) for pg, data in sorted(pages_bytes.items())}


# ── Parsers individuales ───────────────────────────────────────────────────────

def _parse_date_slash(s: str) -> Optional[str]:
    """DD/MM/YYYY o D/M/YYYY → YYYY-MM-DD."""
    m = re.search(r"\b(\d{1,2})[/\-](\d{1,2})[/\-](20\d{2})\b", s)
    if m:
        try:
            d = datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            return d.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _parse_date_words(s: str) -> Optional[str]:
    """'28 de agosto de 2024' → YYYY-MM-DD."""
    m = re.search(
        r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(20\d{2})",
        s, re.IGNORECASE
    )
    if m:
        mes = MESES.get(m.group(2).lower())
        if mes:
            try:
                d = datetime(int(m.group(3)), mes, int(m.group(1)))
                return d.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def _parse_date(s: str) -> Optional[str]:
    return _parse_date_words(s) or _parse_date_slash(s)


def _add_business_days(date_str: str, days: int) -> Optional[str]:
    """Agrega días hábiles (aprox. excluye fines de semana)."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        added = 0
        while added < days:
            d += timedelta(days=1)
            if d.weekday() < 5:  # lun-vie
                added += 1
        return d.strftime("%Y-%m-%d")
    except Exception:
        return None


def extract_emails(texts: dict[int, str]) -> list[str]:
    full = "\n".join(texts.values())
    cleaned = []

    # Patrón 1: email bien formado
    for m in re.finditer(r"[A-Z0-9][A-Z0-9._+\-]{2,}@[A-Z0-9.\-]+\.[A-Z]{2,4}", full, re.IGNORECASE):
        e = m.group(0).lower().strip(".,;'\"")
        if e not in cleaned:
            cleaned.append(e)

    # Patrón 2: OCR deforma @ → letras/símbolos cerca de GMAIL/HOTMAIL
    for m in re.finditer(
        r"([A-Z0-9][A-Z0-9._+\-]{3,})\s*(?:@|0|©|Q)\s*(GMAIL|HOTMAIL|YAHOO|OUTLOOK)\s*[.,]?\s*(COM|PE|NET)",
        full, re.IGNORECASE
    ):
        e = f"{m.group(1)}@{m.group(2)}.{m.group(3)}".lower().strip()
        if e not in cleaned:
            cleaned.append(e)

    # Patrón 3: buscar líneas que contengan "gmail" o "hotmail"
    for line in full.split("\n"):
        if re.search(r"GMAIL|HOTMAIL|@", line, re.IGNORECASE):
            line_clean = re.sub(r"\s+", "", line)
            # Intentar reconstruir el email
            m = re.search(
                r"([A-Z0-9._+\-]{4,})[@0©]([A-Z0-9.\-]+\.[A-Z]{2,4})",
                line_clean, re.IGNORECASE
            )
            if m:
                e = f"{m.group(1)}@{m.group(2)}".lower().strip(".,;'\"")
                if "@" in e and e not in cleaned:
                    cleaned.append(e)

    return cleaned


def extract_ruc(texts: dict[int, str]) -> Optional[str]:
    full = "\n".join(texts.values())
    # RUC persona natural empieza con 10, jurídica con 20
    matches = re.findall(r"\b(10\d{9}|20\d{9})\b", full)
    if matches:
        # El más frecuente suele ser el del titular
        from collections import Counter
        return Counter(matches).most_common(1)[0][0]
    return None


def extract_dni(texts: dict[int, str], ruc: Optional[str] = None) -> Optional[str]:
    """DNI de persona natural: 8 dígitos, descartando fechas y otros."""
    full = "\n".join(texts.values())
    candidates = re.findall(r"\b(\d{8})\b", full)
    # Si tenemos RUC de persona natural (10XXXXXXXXX), el DNI son los 8 del medio
    if ruc and ruc.startswith("10"):
        dni_from_ruc = ruc[2:10]
        if dni_from_ruc in candidates:
            return dni_from_ruc
    # Filtrar los que parecen fechas (DDMMYYYY o YYYYMMDD)
    from collections import Counter
    freq = Counter(candidates)
    for dni, _ in freq.most_common(10):
        if not re.match(r"^(19|20)\d{6}$", dni):  # no es año
            return dni
    return None


def extract_title_resolution(texts: dict[int, str]) -> dict:
    """Extrae número de resolución y fecha de titulación."""
    result = {"nro_resolucion": None, "fecha_titulo": None,
              "fecha_publicacion_peruano": None, "fecha_limite_impugnacion": None}

    # Buscar en páginas de mayor a menor (el título está al final)
    for pg in sorted(texts.keys(), reverse=True):
        text = texts[pg]

        # Número de resolución de presidencia
        if not result["nro_resolucion"]:
            m = re.search(
                r"N[°º?][\s]*(\d{3,5}[\s\-]+\d{4}[\s\-]+INGEMMET[^\n]{0,30})",
                text, re.IGNORECASE
            )
            if m:
                result["nro_resolucion"] = re.sub(r"\s+", " ", m.group(1)).strip()

        # Fecha del título (palabras)
        if not result["fecha_titulo"]:
            m = re.search(
                r"fecha\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})[^.]{0,60}[Tt][íi]tulo",
                text, re.IGNORECASE
            )
            if not m:
                m = re.search(
                    r"[Tt][íi]tulo[^.]{0,60}fecha\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})",
                    text, re.IGNORECASE
                )
            if m:
                result["fecha_titulo"] = _parse_date(m.group(1))

        # Fecha publicación El Peruano
        if not result["fecha_publicacion_peruano"]:
            m = re.search(
                r"[Pp]eruano[^.]{0,30}(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})",
                text, re.IGNORECASE
            )
            if not m:
                m = re.search(
                    r"(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})[^.]{0,30}[Pp]eruano",
                    text, re.IGNORECASE
                )
            if m:
                result["fecha_publicacion_peruano"] = _parse_date(m.group(1))

    # Calcular plazo de impugnación: 15 días hábiles desde publicación
    if result["fecha_publicacion_peruano"]:
        result["fecha_limite_impugnacion"] = _add_business_days(
            result["fecha_publicacion_peruano"], 15
        )

    return result


def extract_petition_date(texts: dict[int, str]) -> Optional[str]:
    """Fecha de formulación del petitorio (página 2)."""
    for pg in [2, 3, 4]:
        if pg not in texts:
            continue
        text = texts[pg]
        m = re.search(r"[Ff]ormul[ae]c[ió]n\s*:?\s*(\d{1,2}/\d{2}/\d{4})", text)
        if m:
            return _parse_date_slash(m.group(1))
        # Formato DD/MM/YYYY en las primeras líneas
        dates = re.findall(r"\b(\d{2}/\d{2}/20\d{2})\b", text)
        if dates:
            return _parse_date_slash(dates[0])
    return None


def extract_serfor_opinion(texts: dict[int, str]) -> dict:
    """Extrae la opinión de SERFOR y si hay restricciones forestales."""
    result = {
        "tiene_concesion_forestal": None,
        "en_area_protegida": None,
        "serfor_oficio": None,
        "serfor_resumen": None,
    }
    full = "\n".join(texts.values()).upper()

    result["tiene_concesion_forestal"] = (
        False if "NO SE ENCUENTRA SOBRE CONCESIONES FORESTALES" in full
        else True if "SE ENCUENTRA SOBRE CONCESIONES FORESTALES" in full
        else None
    )
    result["en_area_protegida"] = (
        False if "NO SE ENCUENTRA SOBRE ÁREAS PROTEGIDA" in full or "NO SE ENCUENTRA SOBRE AREAS PROTEGIDA" in full
        else True if "SE ENCUENTRA SOBRE ÁREAS PROTEGIDA" in full
        else None
    )

    # Oficio SERFOR
    for _, text in texts.items():
        m = re.search(
            r"(D\d{6}-\d{4}-(?:MIDAGRI|SERFOR)[^\n]{0,60})",
            text, re.IGNORECASE
        )
        if m and not result["serfor_oficio"]:
            result["serfor_oficio"] = m.group(1).strip()

    if result["tiene_concesion_forestal"] is False and result["en_area_protegida"] is False:
        result["serfor_resumen"] = "Sin restricciones forestales ni de áreas protegidas"
    elif result["tiene_concesion_forestal"]:
        result["serfor_resumen"] = "⚠️ Se encuentra sobre concesiones forestales"
    elif result["en_area_protegida"]:
        result["serfor_resumen"] = "⚠️ Se encuentra sobre áreas protegidas"

    return result


def extract_overlapping(texts: dict[int, str], own_code: str) -> dict:
    """Detecta concesiones superpuestas y colindantes mencionadas."""
    full = "\n".join(texts.values())
    # Códigos de concesión: 9 dígitos empezando con 0
    all_codes = re.findall(r"\b0\d{8}\b", full)
    other_codes = list({c for c in all_codes if c != own_code})

    superpuestos = []
    colindantes = []

    for code in other_codes:
        # Buscar contexto alrededor del código
        idx = full.find(code)
        while idx != -1:
            ctx = full[max(0, idx-150):idx+50].upper()
            if any(k in ctx for k in ["SUPERPOS", "PRIORITARIO", "RESPETO"]):
                if code not in superpuestos:
                    superpuestos.append(code)
            elif any(k in ctx for k in ["COLINDAN", "ADYACEN", "VECIN"]):
                if code not in colindantes:
                    colindantes.append(code)
            idx = full.find(code, idx + 1)

    # Los que no clasificamos van a colindantes si se mencionan varias veces
    from collections import Counter
    freq = Counter(all_codes)
    for code, count in freq.most_common():
        if code != own_code and code not in superpuestos and code not in colindantes and count >= 2:
            colindantes.append(code)

    return {
        "superpuestos": superpuestos,
        "colindantes":  colindantes[:10],  # máximo 10
    }


def extract_utm_vertices(texts: dict[int, str]) -> list[dict]:
    """Extrae vértices UTM del formulario de petitorio (páginas 3-5)."""
    vertices = []
    for pg in [3, 4, 5, 6]:
        if pg not in texts:
            continue
        text = texts[pg]
        # Pares Norte/Este en formato 8XXXXXX / 5XXXXXX
        nortes = re.findall(r"\b8[123]\d{5}\b", text)
        estes  = re.findall(r"\b5[89]\d{5}\b", text)
        if nortes and estes:
            for i, (n, e) in enumerate(zip(nortes[:4], estes[:4])):
                vertices.append({"vertice": i+1, "norte": int(n), "este": int(e)})
            if vertices:
                break
    return vertices


def compute_risk_score(data: dict) -> dict:
    """Calcula score de riesgo 0-100 (menor = más atractivo para adquirir).

    Para la versión Pro: identifica concesiones con problemas que el titular
    podría querer resolver (o que un comprador debe conocer).
    """
    score = 0
    factors = []
    warnings = []

    serfor = data.get("serfor", {})
    if serfor.get("tiene_concesion_forestal"):
        score += 30
        warnings.append("Superposición con concesión forestal")
    if serfor.get("en_area_protegida"):
        score += 25
        warnings.append("Dentro de área protegida")

    overlap = data.get("overlapping", {})
    n_superp = len(overlap.get("superpuestos", []))
    if n_superp > 0:
        score += min(n_superp * 10, 30)
        warnings.append(f"Superpuesto con {n_superp} derecho(s) prioritario(s)")

    if data.get("has_debt"):
        score += 15
        warnings.append("Deuda de derecho de vigencia")

    # Factores positivos (reducen score de riesgo)
    if data.get("fecha_titulo"):
        factors.append("Titulada")
    if not serfor.get("tiene_concesion_forestal") and not serfor.get("en_area_protegida"):
        factors.append("Sin restricciones ambientales")
    if not overlap.get("superpuestos"):
        factors.append("Sin superposiciones")

    return {
        "risk_score": min(score, 100),
        "risk_level":   "Alto" if score >= 50 else "Medio" if score >= 20 else "Bajo",
        "risk_warnings": warnings,
        "risk_factors":  factors,
    }
