"""Motor de scoring de oportunidades mineras.

Tres tipos de oportunidad:
  - libre_denunciabilidad : concesión caducada → el área puede pedirse
  - adquisicion           : concesión activa con señales de titular débil
  - monitoreo             : petitorio grande en zona de alto valor

Score 0-100. Los factores explican por qué es una oportunidad.
"""

from __future__ import annotations

from app.models import Concession, ConcessionStatus

# Regiones con actividad minera consolidada en Perú
MINING_REGIONS = {
    "Cajamarca", "Arequipa", "Junin", "Ancash", "Puno", "La Libertad",
    "Moquegua", "Tacna", "Apurimac", "Huancavelica", "Ica", "Ayacucho",
}


def score_concession(c: Concession) -> dict | None:
    """Calcula score y factores para una concesión.

    Retorna None si la concesión no es una oportunidad relevante (score < 20).
    """
    score = 0
    factors: list[str] = []
    opp_type: str | None = None
    sidemcat = c.sidemcat_data or {}
    expediente = c.expediente_data or {}

    area = c.area_hectares or 0
    region = (c.region or "").strip().title()
    sustancia = (c.concession_type or "").lower()
    is_metalica = "metál" in sustancia or "metalíf" in sustancia

    # ── Región minera ─────────────────────────────────────────────────────────
    in_mining_region = region in MINING_REGIONS

    # ═══════════════════════════════════════════════════════════════════════════
    # TIPO 1: LIBRE DENUNCIABILIDAD
    # Concesiones caducadas → el área queda libre para nuevos petitorios
    # ═══════════════════════════════════════════════════════════════════════════
    if c.status == ConcessionStatus.expired:
        opp_type = "libre_denunciabilidad"
        score += 40  # base: está caducada

        if area >= 1000:
            score += 25
            factors.append(f"Área grande ({area:,.0f} ha)")
        elif area >= 500:
            score += 15
            factors.append(f"Área significativa ({area:,.0f} ha)")
        elif area >= 100:
            score += 8
            factors.append(f"{area:,.0f} ha disponibles")

        if is_metalica:
            score += 15
            factors.append("Sustancia metálica")

        if in_mining_region:
            score += 15
            factors.append(f"Zona minera activa ({region})")

        # Sin titular con RUC = difícil rastrear propietario anterior
        if not c.holder_ruc:
            score += 5
            factors.append("Titular sin RUC registrado")

    # ═══════════════════════════════════════════════════════════════════════════
    # TIPO 2: ADQUISICIÓN
    # Concesiones activas con señales de titular débil o interesado en vender
    # ═══════════════════════════════════════════════════════════════════════════
    elif c.status == ConcessionStatus.active:
        opp_type = "adquisicion"

        # Deuda de vigencia = titular no puede / no quiere pagar
        if sidemcat.get("has_debt"):
            score += 35
            vigencias = sidemcat.get("vigencias") or []
            years_debt = [
                str(v.get("year", ""))
                for v in vigencias
                if v.get("balance") and "-" in str(v.get("balance", ""))
            ]
            years_str = ", ".join(years_debt) if years_debt else "pendientes"
            factors.append(f"Deuda vigencia {years_str}")

        # Sin RUC = persona natural pequeña → más probable a negociar
        if not c.holder_ruc:
            score += 15
            factors.append("Titular persona natural sin RUC")

        # Área grande = mayor valor para adquirir
        if area >= 1000:
            score += 20
            factors.append(f"Área grande ({area:,.0f} ha)")
        elif area >= 500:
            score += 12
            factors.append(f"Área significativa ({area:,.0f} ha)")

        # Ya titulada = tiene el derecho completo, menor riesgo
        if sidemcat.get("is_titled") or c.title_date:
            score += 15
            factors.append("Concesión titulada")

        if is_metalica:
            score += 10
            factors.append("Sustancia metálica")

        if in_mining_region:
            score += 10
            factors.append(f"Zona minera activa ({region})")

        # Risk score del expediente
        exp_risk = expediente.get("risk_score")
        if exp_risk is not None and exp_risk <= 15:
            score += 10
            factors.append("Sin restricciones ambientales (expediente)")

    # ═══════════════════════════════════════════════════════════════════════════
    # TIPO 3: MONITOREO
    # Petitorios grandes en zonas de alto valor → seguir el proceso
    # ═══════════════════════════════════════════════════════════════════════════
    elif c.status == ConcessionStatus.pending:
        opp_type = "monitoreo"

        if area >= 1000:
            score += 35
            factors.append(f"Petitorio grande ({area:,.0f} ha)")
        elif area >= 500:
            score += 20
            factors.append(f"Petitorio significativo ({area:,.0f} ha)")
        elif area >= 100:
            score += 8
            factors.append(f"Petitorio {area:,.0f} ha")

        if is_metalica:
            score += 25
            factors.append("Sustancia metálica")

        if in_mining_region:
            score += 20
            factors.append(f"Zona minera activa ({region})")

        # Con expediente digitalizado = más avanzado en el proceso
        if sidemcat.get("has_pdf"):
            score += 10
            factors.append("Expediente digitalizado")

    # ── Filtro mínimo ─────────────────────────────────────────────────────────
    if score < 20 or not factors:
        return None

    return {
        "id":              c.id,
        "code":            c.code,
        "name":            c.name,
        "holder_name":     c.holder_name,
        "holder_ruc":      c.holder_ruc,
        "status":          c.status.value,
        "concession_type": c.concession_type,
        "region":          c.region,
        "province":        c.province,
        "area_hectares":   c.area_hectares,
        "title_date":      c.title_date.isoformat() if c.title_date else None,
        "expiration_date": c.expiration_date.isoformat() if c.expiration_date else None,
        "score":           min(score, 100),
        "opp_type":        opp_type,
        "factors":         factors,
        "has_debt":        bool(sidemcat.get("has_debt")),
        "is_titled":       bool(sidemcat.get("is_titled") or c.title_date),
        "has_pdf":         bool(sidemcat.get("has_pdf")),
    }
