# GeoConces

SaaS para **gestión y búsqueda de concesiones mineras en Perú** usando información pública de INGEMMET / GEOCATMIN / SIDEMCAT.

---

## Arquitectura

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui (estilo) + Leaflet + Zustand + TanStack Query
- **Backend:** FastAPI + SQLAlchemy + Pydantic
- **Base de datos:** PostgreSQL + PostGIS
- **Colas / Cache:** Redis
- **Tareas:** Celery (preparado)

---

## Requisitos

- Docker + Docker Compose
- Node.js 20+ (solo si corres el frontend fuera de Docker)
- Python 3.11+ (solo si corres el backend fuera de Docker)

---

## Levantar el proyecto (desarrollo)

```bash
# 1. Posicionarte en la raíz del proyecto
cd GeoConces

# 2. Levantar base, redis y backend
docker compose up --build db redis backend

# 3. En otra terminal, correr el frontend local
cd frontend
npm run dev

# 4. Opcional: sembrar datos demo
cd ../backend
docker compose exec backend python scripts/seed.py
```

Si quieres levantar también el frontend dentro de Docker:

```bash
docker compose --profile fullstack up --build
```

Servicios disponibles:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

---

## Base de datos y migraciones

Usa Alembic como flujo principal de esquema.

```bash
cd backend
alembic upgrade head
```

Si estás usando Docker para el backend, no hace falta correr ese comando a mano: `docker compose` ya ejecuta `alembic upgrade head` antes de iniciar FastAPI.

Si por alguna razón quieres que FastAPI cree tablas automáticamente al arrancar, activa `AUTO_CREATE_TABLES=true` en tu entorno. Por defecto está desactivado.

---

## Importar concesiones reales

Puedes cargar archivos `CSV`, `XLSX`, `GeoJSON` o shapefile comprimido en `.zip` usando el mismo pipeline de ingestión del backend.

```bash
cd backend
python scripts/import_concessions.py /ruta/al/archivo.csv
python scripts/import_concessions.py /ruta/al/archivo.geojson --source geocatmin
python scripts/import_concessions.py /ruta/al/archivo.zip --source shapefile --import-type bulk_sync
```

También existe endpoint autenticado:

```bash
POST /ingestion/concessions/upload
```

Y para revisar historial de importaciones:

```bash
GET /ingestion/logs
```

---

## Estructura

```
GeoConces/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── core/          # config, db, security
│   │   ├── auth/          # login, registro, JWT
│   │   ├── users/         # perfil
│   │   ├── concessions/   # concesiones
│   │   ├── maps/          # endpoints de mapa (PostGIS)
│   │   ├── watchlists/    # listas de seguimiento
│   │   ├── alerts/        # alertas
│   │   └── models.py      # modelos SQLAlchemy
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── scripts/seed.py
└── frontend/
    ├── app/
    │   ├── (public)/      # landing
    │   ├── (auth)/        # login, registro
    │   └── (dashboard)/   # dashboard, mapa, explorar, watchlist, alertas
    ├── components/
    │   └── maps/PeruMap.tsx
    ├── lib/api.ts
    └── store/auth.ts
```

---

## Funcionalidades del MVP (Fase 1)

- Registro e inicio de sesión con JWT
- Dashboard con resumen
- Mapa interactivo de concesiones con Leaflet + PostGIS
- Búsqueda por código, nombre, titular y región
- Perfil de concesión básico
- Watchlist (guardar concesiones)
- Alertas básicas

---

## Próximos pasos (Fase 2)

- Parser de SIDEMCAT (pagos, expedientes)
- Historial de cambios
- Reportes PDF / Excel
- Detección de oportunidades (vencimientos, libre denunciabilidad)
- Integración de pagos (Culqi)
- Notificaciones por email y WhatsApp

---

## Licencia

Privado / Propietario
