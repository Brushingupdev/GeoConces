# ⬡ GeoConces — Catastro Minero · Perú

> **Inteligencia sobre el territorio minero peruano.** Monitorea vencimientos, detecta oportunidades y genera reportes con datos oficiales de **INGEMMET**, **GEOCATMIN** y **SIDEMCAT**.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![PostGIS](https://img.shields.io/badge/PostGIS-3.3-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker)
![Status](https://img.shields.io/badge/Estado-MVP_/_Fase_2-amber)

<!-- Recomendado: mover frontend/image/Image.png → docs/screenshots/dashboard.png (1.5 MB, comprimir a ~300 KB) y actualizar la ruta de abajo -->
![Dashboard de GeoConces](frontend/image/Image.png)

---

## Qué resuelve

Dejar de depender de PDFs desactualizados y consultas manuales al catastro. GeoConces centraliza las concesiones que te importan y te avisa **antes** de que un vencimiento se vuelva un problema legal o comercial.

| # | Funcionalidad | Qué hace |
|---|---|---|
| 01 | 🔔 **Alertas** | Vencimientos, deudas y cambios de estado detectados en el escaneo **diario** (07:00 Lima) |
| 02 | 🎯 **Oportunidades** | Concesiones caducadas/disponibles rankeadas por score (vencimiento, área, ubicación) |
| 03 | 🗺️ **Mapa** | Geometrías oficiales INGEMMET con Leaflet + PostGIS: filtra por estado, titular y región |
| 04 | 📄 **Reportes** | Exportación Excel y PDF filtrada por titular, región o estado |
| 05 | 📥 **Ingestión** | Carga CSV, XLSX, GeoJSON o shapefile (.zip) con el mismo pipeline del backend |

**Frecuencia de datos:** escaneo de alertas **diario**; sincronización de fuentes **semanal** (lunes); enriquecimiento SIDEMCAT nocturno. Ver `backend/app/core/celery_app.py` (`beat_schedule`).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Leaflet + Zustand + TanStack Query |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic 2 + Alembic |
| Datos | PostgreSQL 15 + PostGIS + pgvector · Redis 7 · Celery (worker + beat) |
| Fuentes | INGEMMET / GEOCATMIN (ArcGIS REST) / SIDEMCAT / REINFO |

