"""OCR con Gemini Flash para expedientes mineros de INGEMMET.

Mucho más preciso que Tesseract para:
  - Emails con @ deformado por compresión JPEG
  - Números de resolución con caracteres especiales
  - Texto en tablas y formularios complejos
  - Fechas en formato mixto

Costo estimado: ~$0.01 por expediente (100 páginas × 4 imágenes × ~$0.00025/imagen)
"""
from __future__ import annotations

import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Prompt de extracción estructurada
EXTRACTION_PROMPT = """Eres un experto en análisis de expedientes mineros peruanos del INGEMMET (Instituto Geológico, Minero y Metalúrgico del Perú).

Analiza TODAS las imágenes del expediente y extrae TODA la información disponible.
Responde ÚNICAMENTE con JSON válido sin markdown ni texto adicional.

Formato requerido:
{
  "emails": [],
  "ruc": null,
  "dni": null,
  "telefono": null,
  "direccion": null,
  "nro_resolucion": null,
  "autoridad_firmante": null,
  "fecha_titulo": null,
  "fecha_publicacion_peruano": null,
  "fecha_petitorio": null,
  "tiene_concesion_forestal": null,
  "en_area_protegida": null,
  "serfor_oficio": null,
  "ana_opinion": null,
  "ana_oficio": null,
  "cultura_opinion": null,
  "cultura_oficio": null,
  "superpuestos": [],
  "colindantes": [],
  "utm_vertices": [],
  "cuadriculas": [],
  "utm_zona": null,
  "oposiciones": [],
  "resoluciones_previas": [],
  "modificaciones": []
}

Instrucciones por campo:
- emails: SOLO el correo electrónico del TITULAR DE LA CONCESIÓN (persona o empresa que formula el petitorio). NO incluir emails de funcionarios, SERFOR, ANA, GOREMAD, ministerios, ni del INGEMMET. Buscar en las primeras páginas donde aparece el formulario del petitorio. Si @ aparece deformado (0, ©, Q), reconstruye el email
- ruc: 11 dígitos del titular (10=persona natural, 20=empresa)
- dni: 8 dígitos solo si el titular es persona natural
- telefono: número de teléfono o celular del titular
- direccion: dirección del titular o domicilio fiscal
- nro_resolucion: número completo de la resolución que otorga el título (ej: "001-2024-INGEMMET/PCD/PM")
- autoridad_firmante: nombre y cargo de quien firma la resolución
- fecha_titulo: fecha de firma del título en ISO 8601 (YYYY-MM-DD)
- fecha_publicacion_peruano: fecha de publicación en El Peruano en ISO 8601
- fecha_petitorio: fecha de formulación del petitorio en ISO 8601
- tiene_concesion_forestal: true si hay superposición con concesión forestal, false si se confirma que no, null si no se menciona
- en_area_protegida: true/false/null igual que anterior
- serfor_oficio: código completo del oficio SERFOR/MIDAGRI (ej: "D001234-2024-MIDAGRI-SERFOR-DGGSPFFS")
- ana_opinion: resumen de la opinión de la Autoridad Nacional del Agua (ANA)
- ana_oficio: código del oficio de ANA
- cultura_opinion: resumen de opinión del Ministerio de Cultura (patrimonio arqueológico)
- cultura_oficio: código del oficio de Cultura
- superpuestos: lista de códigos (9 dígitos empezando con 0) de derechos mineros prioritarios o superpuestos
- colindantes: lista de códigos (9 dígitos) de derechos colindantes/adyacentes
- utm_vertices: lista de {"vertice": N, "norte": XXXXXXX, "este": XXXXXX} con coordenadas UTM
- cuadriculas: lista de códigos de cuadrículas mineras (ej: ["14h-3-23", "14h-3-24"])
- utm_zona: zona UTM (ej: "18S", "17S", "19S")
- oposiciones: lista de {"oponente": "nombre", "resultado": "texto", "fecha": "YYYY-MM-DD"} si hubo oposiciones
- resoluciones_previas: lista de {"nro": "...", "tipo": "admision/publicacion/etc", "fecha": "YYYY-MM-DD"}
- modificaciones: lista de {"tipo": "cambio_titular/reduccion_area/etc", "fecha": "YYYY-MM-DD", "detalle": "..."}
- Usa null para campos no encontrados, [] para listas vacías
"""


def ocr_pages_with_gemini(
    pages_bytes: dict[int, bytes],
    api_key: str,
    own_code: str = "",
) -> dict:
    """Extrae datos estructurados de las páginas del expediente usando Gemini Flash.

    Args:
        pages_bytes: dict {page_num: jpeg_bytes}
        api_key: clave de API de Google Gemini
        own_code: código de la concesión propia (para filtrar colindantes)

    Returns:
        dict con los campos extraídos (compatible con el formato de Tesseract extractor)
    """
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # Construir partes del mensaje: texto + imágenes
    parts = [EXTRACTION_PROMPT]
    for page_num, jpeg_bytes in sorted(pages_bytes.items()):
        parts.append(f"\n--- PÁGINA {page_num} ---\n")
        parts.append({
            "mime_type": "image/jpeg",
            "data": base64.b64encode(jpeg_bytes).decode("utf-8"),
        })

    try:
        response = model.generate_content(parts)
        raw = response.text.strip()

        # Limpiar markdown si Gemini lo incluye
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        import json
        data = json.loads(raw)
        logger.info("Gemini OCR exitoso: %d campos extraídos", len(data))
        return _normalize_gemini_output(data, own_code)

    except Exception as exc:
        logger.error("Gemini OCR falló: %s", exc)
        return {}


def _normalize_gemini_output(data: dict, own_code: str) -> dict:
    """Convierte el JSON de Gemini al formato esperado por el service."""
    colindantes  = [c for c in (data.get("colindantes") or []) if c != own_code]
    superpuestos = [c for c in (data.get("superpuestos") or []) if c != own_code]

    return {
        "emails":          data.get("emails") or [],
        "ruc":             data.get("ruc"),
        "dni":             data.get("dni"),
        "telefono":        data.get("telefono"),
        "direccion":       data.get("direccion"),
        "resolution": {
            "nro_resolucion":             data.get("nro_resolucion"),
            "autoridad_firmante":         data.get("autoridad_firmante"),
            "fecha_titulo":               data.get("fecha_titulo"),
            "fecha_publicacion_peruano":  data.get("fecha_publicacion_peruano"),
            "fecha_limite_impugnacion":   None,  # se calcula en service
        },
        "fecha_petitorio": data.get("fecha_petitorio"),
        "serfor": {
            "tiene_concesion_forestal": data.get("tiene_concesion_forestal"),
            "en_area_protegida":        data.get("en_area_protegida"),
            "serfor_oficio":            data.get("serfor_oficio"),
            "serfor_resumen":           _build_serfor_summary(data),
        },
        "overlapping": {
            "superpuestos": superpuestos,
            "colindantes":  colindantes[:20],
        },
        "utm_vertices":      data.get("utm_vertices") or [],
        "cuadriculas":       data.get("cuadriculas") or [],
        "utm_zona":          data.get("utm_zona"),
        "oposiciones":       data.get("oposiciones") or [],
        "resoluciones_previas": data.get("resoluciones_previas") or [],
        "modificaciones":    data.get("modificaciones") or [],
        "extra": {
            "telefono":          data.get("telefono"),
            "direccion":         data.get("direccion"),
            "autoridad_firmante": data.get("autoridad_firmante"),
            "ana": {
                "opinion": data.get("ana_opinion"),
                "oficio":  data.get("ana_oficio"),
            },
            "cultura": {
                "opinion": data.get("cultura_opinion"),
                "oficio":  data.get("cultura_oficio"),
            },
            "cuadriculas": data.get("cuadriculas") or [],
            "utm_zona":    data.get("utm_zona"),
            "oposiciones": data.get("oposiciones") or [],
            "resoluciones_previas": data.get("resoluciones_previas") or [],
            "modificaciones": data.get("modificaciones") or [],
        },
        "ocr_engine": "gemini-2.0-flash",
    }


def _build_serfor_summary(data: dict) -> Optional[str]:
    cf = data.get("tiene_concesion_forestal")
    ap = data.get("en_area_protegida")
    if cf is False and ap is False:
        return "Sin restricciones forestales ni de áreas protegidas"
    if cf:
        return "⚠️ Se encuentra sobre concesiones forestales"
    if ap:
        return "⚠️ Se encuentra sobre áreas protegidas"
    return None
