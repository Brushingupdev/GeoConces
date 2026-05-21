"""Parser de búsqueda por lenguaje natural para concesiones mineras.

Convierte texto libre en filtros estructurados de la API.

Ejemplos:
  "metálicas en Cajamarca mayores a 500 ha" →
    {concession_type: "Metálica", region: "Cajamarca", area_min: 500}

  "caducadas con deuda en Arequipa" →
    {status: "expired", has_debt: true, region: "Arequipa"}

  "petitorios grandes de HOCHSCHILD" →
    {status: "pending", area_min: 500, q: "HOCHSCHILD"}
"""

from __future__ import annotations

import re

# ── Diccionarios de mapeo ────────────────────────────────────────────────────

REGIONS = {
    "amazonas": "Amazonas", "ancash": "Ancash", "apurimac": "Apurimac",
    "apurímac": "Apurimac", "arequipa": "Arequipa", "ayacucho": "Ayacucho",
    "cajamarca": "Cajamarca", "callao": "Callao", "cusco": "Cusco",
    "cuzco": "Cusco", "huancavelica": "Huancavelica", "huanuco": "Huanuco",
    "huánuco": "Huanuco", "ica": "Ica", "junin": "Junin", "junín": "Junin",
    "la libertad": "La Libertad", "lambayeque": "Lambayeque", "lima": "Lima",
    "loreto": "Loreto", "madre de dios": "Madre De Dios", "moquegua": "Moquegua",
    "pasco": "Pasco", "piura": "Piura", "puno": "Puno",
    "san martin": "San Martin", "san martín": "San Martin",
    "tacna": "Tacna", "tumbes": "Tumbes", "ucayali": "Ucayali",
}

STATUS_KEYWORDS = {
    # Vigentes / activas
    "vigente": "active", "vigentes": "active", "activa": "active",
    "activas": "active", "activos": "active", "titulada": "active",
    "tituladas": "active",
    # Caducadas
    "caducada": "expired", "caducadas": "expired", "extinguida": "expired",
    "extinguidas": "expired", "vencida": "expired", "vencidas": "expired",
    "cancelada": "expired",
    # En trámite
    "tramite": "pending", "trámite": "pending", "petitorio": "pending",
    "petitorios": "pending", "en tramite": "pending", "pendiente": "pending",
    # Suspendida
    "suspendida": "suspended", "suspendidas": "suspended",
}

SUBSTANCE_KEYWORDS = {
    "metálica": "Metálica", "metalica": "Metálica",
    "metálicas": "Metálica", "metalicas": "Metálica",
    "metálico": "Metálica", "metalicos": "Metálica",
    "metalífera": "Metálica", "metalifera": "Metálica",
    "no metálica": "No metálica", "no metalica": "No metálica",
    "no metálicas": "No metálica", "no metalicas": "No metálica",
    "energética": "Energética", "energetica": "Energética",
    # Minerales específicos → metálica
    "oro": "Metálica", "cobre": "Metálica", "plata": "Metálica",
    "plomo": "Metálica", "zinc": "Metálica", "hierro": "Metálica",
    "molibdeno": "Metálica", "estaño": "Metálica",
    # No metálicos
    "sal": "No metálica", "caliza": "No metálica", "fosfato": "No metálica",
}

AREA_PREFIXES = [
    r"mayor(?:es)?\s+a\s+",
    r"m[aá]s\s+de\s+",
    r"sobre\s+",
    r"encima\s+de\s+",
    r"m[ií]nimo\s+",
    r"desde\s+",
    r">\s*",
]

AREA_SUFFIXES_MAX = [
    r"menor(?:es)?\s+a\s+",
    r"menos\s+de\s+",
    r"hasta\s+",
    r"m[aá]ximo\s+",
    r"<\s*",
]

DEBT_KEYWORDS = [
    "deuda", "adeuda", "debe", "con deuda", "deudas", "morosa", "moroso",
    "impago", "sin pagar", "pendiente de pago",
]

LARGE_KEYWORDS = [
    "grande", "grandes", "gran", "extensas", "extensa",
    "amplia", "amplias",
]

OPP_TYPE_KEYWORDS = {
    "libre": "libre_denunciabilidad",
    "denunciabilidad": "libre_denunciabilidad",
    "libre denunciabilidad": "libre_denunciabilidad",
    "adquisicion": "adquisicion",
    "adquisición": "adquisicion",
    "monitoreo": "monitoreo",
}


def parse_query(text: str) -> dict:
    """Convierte texto libre en filtros de búsqueda estructurados.

    Returns dict con claves compatibles con los endpoints:
      q, region, status, concession_type, area_min, area_max,
      has_debt, opp_type, sort_by, sort_dir
    """
    raw   = text.strip()
    lower = raw.lower()
    filters: dict = {}
    interpreted: list[str] = []

    # ── Región ────────────────────────────────────────────────────────────────
    # Probar primero frases de 3 palabras, luego 2, luego 1
    for phrase_len in [3, 2, 1]:
        words = lower.split()
        for i in range(len(words) - phrase_len + 1):
            phrase = " ".join(words[i:i + phrase_len])
            if phrase in REGIONS:
                filters["region"] = REGIONS[phrase]
                interpreted.append(f"Región: {REGIONS[phrase]}")
                break
        if "region" in filters:
            break

    # ── Estado ────────────────────────────────────────────────────────────────
    for kw, status in STATUS_KEYWORDS.items():
        if kw in lower:
            filters["status"] = status
            interpreted.append(f"Estado: {status}")
            break

    # ── Sustancia / tipo ──────────────────────────────────────────────────────
    # Probar frases de 2 palabras primero ("no metálica")
    for phrase_len in [2, 1]:
        words = lower.split()
        for i in range(len(words) - phrase_len + 1):
            phrase = " ".join(words[i:i + phrase_len])
            if phrase in SUBSTANCE_KEYWORDS:
                filters["concession_type"] = SUBSTANCE_KEYWORDS[phrase]
                interpreted.append(f"Sustancia: {SUBSTANCE_KEYWORDS[phrase]}")
                break
        if "concession_type" in filters:
            break

    # ── Área mínima ───────────────────────────────────────────────────────────
    for prefix in AREA_PREFIXES:
        m = re.search(prefix + r"(\d[\d,.]*)\s*(?:ha|hectáreas?|hectareas?)?", lower)
        if m:
            val = float(m.group(1).replace(",", ""))
            filters["area_min"] = val
            interpreted.append(f"Área mínima: {val:,.0f} ha")
            break

    # ── Área máxima ───────────────────────────────────────────────────────────
    for prefix in AREA_SUFFIXES_MAX:
        m = re.search(prefix + r"(\d[\d,.]*)\s*(?:ha|hectáreas?|hectareas?)?", lower)
        if m:
            val = float(m.group(1).replace(",", ""))
            filters["area_max"] = val
            interpreted.append(f"Área máxima: {val:,.0f} ha")
            break

    # ── Números sueltos como área ─────────────────────────────────────────────
    if "area_min" not in filters and "area_max" not in filters:
        m = re.search(r"(\d{3,})\s*(?:ha|hectáreas?|hectareas?)", lower)
        if m:
            val = float(m.group(1))
            filters["area_min"] = val
            interpreted.append(f"Área mínima: {val:,.0f} ha")

    # ── Deuda ─────────────────────────────────────────────────────────────────
    if any(kw in lower for kw in DEBT_KEYWORDS):
        filters["has_debt"] = True
        interpreted.append("Con deuda de vigencia")

    # ── Palabras clave de tamaño ──────────────────────────────────────────────
    if any(kw in lower for kw in LARGE_KEYWORDS) and "area_min" not in filters:
        filters["area_min"] = 500
        interpreted.append("Área grande (>500 ha)")

    # ── Tipo de oportunidad ───────────────────────────────────────────────────
    for kw, otype in OPP_TYPE_KEYWORDS.items():
        if kw in lower:
            filters["opp_type"] = otype
            interpreted.append(f"Tipo: {otype}")
            break

    # ── Ordenamiento ──────────────────────────────────────────────────────────
    if any(w in lower for w in ["mayor área", "más grande", "grandes primero"]):
        filters["sort_by"] = "area_hectares"
        filters["sort_dir"] = "desc"
    elif any(w in lower for w in ["reciente", "nuevo", "nuevas", "últimas"]):
        filters["sort_by"] = "registration_date"
        filters["sort_dir"] = "desc"

    # ── Texto libre restante como búsqueda q ──────────────────────────────────
    # Quitar palabras ya interpretadas para extraer nombres propios
    stop_words = set(
        list(REGIONS.keys()) +
        list(STATUS_KEYWORDS.keys()) +
        list(SUBSTANCE_KEYWORDS.keys()) +
        DEBT_KEYWORDS + LARGE_KEYWORDS +
        ["en", "de", "del", "la", "las", "los", "el", "con", "sin",
         "ha", "hectareas", "hectáreas", "mayor", "menor", "mas", "más",
         "a", "y", "o", "que", "para", "sobre", "desde", "hasta",
         "concesiones", "concesion", "concesión", "mineras", "minera",
         "titulares", "titular", "petitorios", "petitorio",
         "mayores", "menores", "grandes", "grande", "pequeñas", "pequeños",
         "primero", "primeras", "primeros", "todas", "todos", "libre",
         "denunciabilidad", "adquisicion", "adquisición", "monitoreo",
         "buscar", "mostrar", "dame", "quiero", "ver"]
    )
    remaining = [
        w for w in re.findall(r"[a-záéíóúñü]+", lower)
        if w not in stop_words and len(w) > 3
    ]
    if remaining:
        # Buscar nombres en mayúsculas en el texto original
        names = re.findall(r"\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,}\b", raw)
        if names:
            filters["q"] = names[0].strip()
            interpreted.append(f"Texto: '{names[0].strip()}'")
        elif remaining:
            # Tomar las palabras más largas como probable nombre propio
            candidate = max(remaining, key=len)
            if len(candidate) > 4:
                filters["q"] = candidate
                interpreted.append(f"Texto: '{candidate}'")

    return {
        "filters":     filters,
        "interpreted": interpreted,
        "original":    raw,
    }
