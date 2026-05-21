"""Construye un PDF a partir de páginas JPEG descargadas de INGEMMET."""

from __future__ import annotations

import io
from PIL import Image


def build_pdf_from_pages(pages: dict[int, bytes]) -> bytes:
    """Une páginas JPEG ordenadas en un único PDF. Retorna bytes del PDF."""
    if not pages:
        raise ValueError("No hay páginas para construir el PDF")

    images = []
    for _, data in sorted(pages.items()):
        img = Image.open(io.BytesIO(data)).convert("RGB")
        images.append(img)

    buf = io.BytesIO()
    images[0].save(buf, format="PDF", save_all=True, append_images=images[1:])
    return buf.getvalue()
