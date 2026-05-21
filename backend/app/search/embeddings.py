"""Generación y búsqueda de embeddings semánticos para concesiones.

Usa Gemini text-embedding-004 (768 dims, gratis hasta 1500 req/min).
Requiere GEMINI_API_KEY en .env — si no está configurada, la búsqueda
semántica devuelve 503 (sin bloquear el resto de la app).

Sin PyTorch, sin sentence-transformers. ~0 MB extra en el contenedor.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

EMBEDDING_DIM = 768          # text-embedding-004
GEMINI_EMBED_MODEL = "models/text-embedding-004"


def _get_api_key() -> str | None:
    from app.core.config import settings
    return settings.GEMINI_API_KEY


def encode_text(text: str) -> list[float]:
    """Codifica texto en un vector de 768 dimensiones usando Gemini."""
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    result = genai.embed_content(
        model=GEMINI_EMBED_MODEL,
        content=text,
        task_type="RETRIEVAL_DOCUMENT",
    )
    return result["embedding"]


def encode_query(text: str) -> list[float]:
    """Codifica una consulta (task_type diferente para mejor recall)."""
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    result = genai.embed_content(
        model=GEMINI_EMBED_MODEL,
        content=text,
        task_type="RETRIEVAL_QUERY",
    )
    return result["embedding"]


def build_concession_text(concession) -> str:
    """Construye el texto representativo de una concesión para el embedding."""
    parts = [
        concession.name or "",
        concession.code or "",
        concession.holder_name or "",
        concession.concession_type or "",
        concession.region or "",
        concession.status.value if concession.status else "",
    ]
    if concession.area_hectares:
        parts.append(f"{concession.area_hectares:.0f} hectareas")
    if concession.province:
        parts.append(concession.province)
    if concession.district:
        parts.append(concession.district)
    return " | ".join(p for p in parts if p)


def semantic_search(
    db: "Session",
    query: str,
    limit: int = 50,
    threshold: float = 0.35,
) -> list[dict]:
    """Busca concesiones por similitud semántica con pgvector."""
    from sqlalchemy import text

    query_vec = encode_query(query)
    vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"

    sql = text("""
        SELECT
            c.id,
            c.code,
            c.name,
            c.holder_name,
            c.holder_ruc,
            c.status,
            c.concession_type,
            c.region,
            c.area_hectares,
            c.title_date,
            c.registration_date,
            c.sidemcat_data,
            1 - (c.embedding <=> :vec ::vector) AS score
        FROM concessions c
        WHERE
            c.embedding IS NOT NULL
            AND 1 - (c.embedding <=> :vec ::vector) >= :threshold
        ORDER BY c.embedding <=> :vec ::vector
        LIMIT :limit
    """)

    rows = db.execute(sql, {"vec": vec_str, "threshold": threshold, "limit": limit}).fetchall()

    results = []
    for row in rows:
        results.append({
            "id":                row.id,
            "code":              row.code,
            "name":              row.name,
            "holder_name":       row.holder_name,
            "holder_ruc":        row.holder_ruc,
            "status":            row.status,
            "concession_type":   row.concession_type,
            "region":            row.region,
            "area_hectares":     row.area_hectares,
            "title_date":        row.title_date.isoformat() if row.title_date else None,
            "registration_date": row.registration_date.isoformat() if row.registration_date else None,
            "has_debt":          bool((row.sidemcat_data or {}).get("has_debt")),
            "score":             round(float(row.score), 4),
        })
    return results
