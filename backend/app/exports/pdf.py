"""PDF export for concessions using reportlab."""

from datetime import datetime
from io import BytesIO
from typing import Iterable, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)

from app.models import Concession


COLUMNS: List[tuple[str, str, float]] = [
    ("code", "Código", 25 * mm),
    ("name", "Nombre", 55 * mm),
    ("holder_name", "Titular", 45 * mm),
    ("status", "Estado", 18 * mm),
    ("region", "Región", 25 * mm),
    ("area_hectares", "Área (ha)", 20 * mm),
    ("expiration_date", "Vencimiento", 25 * mm),
]


def _fmt(value):
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "value"):
        return value.value
    return str(value)


def build_concessions_pdf(concessions: Iterable[Concession], title: str = "Reporte de concesiones") -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"<b>{title}</b>", styles["Title"]))
    story.append(Paragraph(
        f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        styles["Normal"],
    ))
    story.append(Spacer(1, 6 * mm))

    rows = list(concessions)
    story.append(Paragraph(f"Total: <b>{len(rows)}</b> concesiones", styles["Normal"]))
    story.append(Spacer(1, 4 * mm))

    header = [label for _, label, _ in COLUMNS]
    data = [header]
    for c in rows:
        data.append([_fmt(getattr(c, attr, None)) for attr, _, _ in COLUMNS])

    col_widths = [w for _, _, w in COLUMNS]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F6F69")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
    ]))
    story.append(table)

    doc.build(story)
    return buf.getvalue()
