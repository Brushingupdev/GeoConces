# GeoConces Extraction Service

Microservicio independiente de extracción y enriquecimiento de datos de concesiones mineras peruanas.

---

## ¿Qué es?

Un servicio REST separado de GeoConces que se especializa en **obtener, extraer y cruzar** toda la información disponible públicamente sobre una concesión minera peruana, a partir de su código INGEMMET.

GeoConces lo consume como una API interna. También puede venderse como servicio independiente a otras plataformas del sector minero.

---

## Fuentes de datos

| Fuente | Datos extraídos | Método | Costo |
|---|---|---|---|
| **INGEMMET / SIDEMCAT** | Estado, deuda, fecha título, PDF del expediente | API REST (reverse-engineered) | Gratis |
| **INGEMMET / Expediente PDF** | Email, DNI, RUC, resolución, SERFOR, ANA, colindantes, vértices UTM | Gemini 2.0 Flash (OCR) | ~$0.01/expediente |
| **GEOCATMIN ArcGIS** | Geometría, área, región, estado catastral | ArcGIS REST API | Gratis |
| **SUNAT** | Razón social, dirección, actividad económica, estado tributario | API pública | Gratis |
| **REINFO** | Si está en producción activa, minerales declarados | CSV público MEM | Gratis |
| **El Peruano** | Resolución de titulación publicada, fecha exacta | Web scraping | Gratis |
| **ANA** | Permiso de uso de agua | Scraping / API | Gratis |
| **SERFOR** | Restricciones forestales y áreas protegidas | Ya en expediente PDF | Gratis |

---

## Endpoints

```
GET  /health
GET  /status/{code}           → estado rápido (caché o fresco)
POST /extract/{code}          → dispara extracción completa (async)
GET  /result/{code}           → resultado cacheado
GET  /result/{code}/progress  → progreso en tiempo real (SSE)
POST /batch                   → extracción de múltiples códigos
GET  /enrich/ruc/{ruc}        → enriquecimiento SUNAT por RUC
```

---

## Flujo de extracción

```
POST /extract/{code}
│
├── 1. SIDEMCAT → estado, deuda, ¿tiene PDF?, codArchivo, total páginas
│
├── 2. GEOCATMIN → geometría GeoJSON, área exacta, estado catastral
│
├── 3. SUNAT (si hay RUC) → razón social, dirección, actividad, estado
│
├── 4. REINFO → ¿está en producción?, ¿qué minerales?, volumen declarado
│
├── 5. Expediente PDF (si existe)
│   ├── Descargar todas las páginas (JPEG por página)
│   └── Gemini 2.0 Flash → extracción estructurada:
│       ├── Email, teléfono, dirección del titular
│       ├── DNI / RUC
│       ├── Resolución de titulación (número, fecha, autoridad)
│       ├── Fecha petitorio, fecha publicación El Peruano
│       ├── Plazo de impugnación
│       ├── SERFOR (restricciones forestales, oficio)
│       ├── ANA (recursos hídricos, oficio)
│       ├── Ministerio de Cultura (patrimonio arqueológico)
│       ├── Oposiciones presentadas y resultado
│       ├── Colindantes y superpuestos
│       ├── Vértices UTM y cuadrículas
│       └── Modificaciones y resoluciones previas
│
├── 6. El Peruano (si hay resolución) → texto oficial publicado
│
└── 7. Cruzar y unificar → JSON estructurado + score de confianza por campo
```

---

## Respuesta JSON

```json
{
  "code": "080012345",
  "extracted_at": "2026-05-21T10:00:00Z",
  "confidence": 0.94,
  "sources_used": ["sidemcat", "geocatmin", "sunat", "expediente_pdf", "reinfo"],

  "catastro": {
    "code": "080012345",
    "name": "NOMBRE DE LA CONCESIÓN",
    "status": "active",
    "concession_type": "Metálica",
    "area_hectares": 1000.0,
    "region": "Cajamarca",
    "province": "Cajamarca",
    "district": "Cajamarca",
    "registration_date": "2010-03-15",
    "expiration_date": null
  },

  "titular": {
    "name": "EMPRESA MINERA SAC",
    "ruc": "20123456789",
    "dni": null,
    "email": "contacto@empresa.com",
    "telefono": "999888777",
    "direccion": "Av. Principal 123, Lima",
    "actividad_economica": "Extracción de minerales metalíferos",
    "estado_tributario": "ACTIVO",
    "fuente_ruc": "sunat"
  },

  "titulacion": {
    "is_titled": true,
    "title_date": "2015-06-10",
    "nro_resolucion": "0491-2015-INGEMMET/PCD/PM",
    "autoridad_firmante": "Presidente del Consejo Directivo",
    "fecha_petitorio": "2010-03-15",
    "duracion_proceso_dias": 1913,
    "fecha_publicacion_peruano": "2015-07-01",
    "fecha_limite_impugnacion": "2015-07-22",
    "fuente": "expediente_pdf"
  },

  "financiero": {
    "has_debt": false,
    "debt_amount": null,
    "ultimo_pago": "2025-12-01",
    "fuente": "sidemcat"
  },

  "produccion": {
    "en_reinfo": true,
    "minerales_declarados": ["oro", "plata"],
    "volumen_tm": 500,
    "fuente": "reinfo"
  },

  "restricciones": {
    "serfor": {
      "tiene_concesion_forestal": false,
      "en_area_protegida": false,
      "oficio": "D001234-2025-MIDAGRI-SERFOR",
      "resumen": "Sin restricciones forestales ni de áreas protegidas"
    },
    "ana": {
      "opinion": "Favorable condicionado",
      "oficio": "ANA-DARH-2015-0234"
    },
    "cultura": {
      "opinion": "Sin patrimonio arqueológico",
      "oficio": null
    }
  },

  "geometria": {
    "geojson": { "type": "Polygon", "coordinates": [[...]] },
    "utm_vertices": [
      { "vertice": 1, "norte": 9234567, "este": 789012 }
    ],
    "utm_zona": "17S",
    "cuadriculas": ["14h-3-23", "14h-3-24"],
    "centroid": [-76.5, -12.3]
  },

  "colindantes": {
    "superpuestos": [],
    "colindantes": ["080012344", "080012346"]
  },

  "historial": {
    "oposiciones": [],
    "resoluciones_previas": [
      { "tipo": "admision", "nro": "...", "fecha": "2010-04-01" },
      { "tipo": "publicacion", "nro": "...", "fecha": "2010-05-15" }
    ],
    "modificaciones": []
  },

  "risk": {
    "score": 15,
    "level": "Bajo",
    "warnings": ["Deuda de derecho de vigencia"],
    "factors": ["Titulada", "Sin restricciones ambientales"]
  },

  "expediente": {
    "has_pdf": true,
    "cod_archivo": 341449,
    "total_pages": 70,
    "pages_scanned": 70,
    "ocr_engine": "gemini-2.0-flash",
    "scanned_at": "2026-05-21T10:05:00Z"
  }
}
```

---

## Stack técnico

```
extraction-service/
├── main.py                  # FastAPI app
├── config.py                # Settings (GEMINI_API_KEY, REDIS_URL, etc.)
├── cache.py                 # Redis cache (TTL por fuente)
├── sources/
│   ├── sidemcat.py          # Cliente SIDEMCAT (reutilizado de GeoConces)
│   ├── geocatmin.py         # Cliente GEOCATMIN ArcGIS
│   ├── sunat.py             # Cliente SUNAT RUC API
│   ├── reinfo.py            # Parser CSV REINFO
│   ├── expediente.py        # Descarga + OCR Gemini
│   └── el_peruano.py        # Scraper El Peruano
├── extractor.py             # Orquestador — llama todas las fuentes
├── merger.py                # Cruza y unifica los datos
├── scorer.py                # Score de confianza por campo
└── requirements.txt
```

**Dependencias principales:**
- `fastapi` + `uvicorn`
- `httpx` (HTTP async)
- `google-generativeai` (Gemini OCR)
- `redis` (caché)
- `playwright` (scraping El Peruano)
- `celery` (tareas async batch)

---

## Cache strategy

| Fuente | TTL | Razón |
|---|---|---|
| SIDEMCAT | 7 días | Cambia poco |
| GEOCATMIN | 30 días | Casi estático |
| SUNAT | 30 días | Dato fiscal estable |
| REINFO | 7 días | Actualización mensual |
| Expediente PDF | Permanente | No cambia tras titulación |
| El Peruano | Permanente | Registro histórico |

---

## Integración con GeoConces

En `backend/app/expediente/service.py`, reemplazar la extracción actual por:

```python
# Una sola línea
result = await extraction_client.extract(concession.code)
```

```python
# extraction_client.py en GeoConces
class ExtractionClient:
    BASE = "http://extraction-service:8001"

    async def extract(self, code: str) -> dict:
        async with httpx.AsyncClient() as c:
            # Disparar extracción
            await c.post(f"{self.BASE}/extract/{code}")
            # Polling hasta completar
            for _ in range(120):
                r = await c.get(f"{self.BASE}/result/{code}")
                if r.json().get("extracted_at"):
                    return r.json()
                await asyncio.sleep(2)
```

---

## Fases de desarrollo

### Fase 1 — MVP (1-2 días)
- [ ] Setup FastAPI + Redis
- [ ] SIDEMCAT client (copiar de GeoConces)
- [ ] SUNAT RUC enrichment
- [ ] Expediente PDF + Gemini (copiar de GeoConces)
- [ ] Endpoint `/extract/{code}` y `/result/{code}`
- [ ] Integración básica con GeoConces

### Fase 2 — Fuentes adicionales (3-5 días)
- [ ] GEOCATMIN geometría
- [ ] REINFO producción
- [ ] El Peruano scraper
- [ ] Score de confianza por campo
- [ ] Batch endpoint

### Fase 3 — Producción (1 semana)
- [ ] Docker + docker-compose separado
- [ ] Rate limiting y auth
- [ ] Dashboard de monitoreo
- [ ] Documentación API (OpenAPI)
- [ ] Potencial comercialización como API pública

---

## Valor comercial

Una vez que el servicio tenga datos de miles de concesiones procesadas, puede ofrecerse como:

- **API SaaS** para estudios de abogados mineros, consultoras, bancos
- **Data feed** para plataformas de inversión en minería
- **Integración** con ERPs mineros (SAP, etc.)

Precio referencial de mercado: **$0.50 - $2.00 por consulta** en servicios similares de otros países.

---

*Proyecto complementario a GeoConces · Stack: Python + FastAPI + Redis + Gemini*
