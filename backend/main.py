from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine
from sqlalchemy import text
from app.core.rate_limit import limiter
from app import models
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.companies.router import router as companies_router
from app.subscriptions.router import router as subscriptions_router
from app.concessions.router import router as concessions_router
from app.ingestion.router import router as ingestion_router
from app.maps.router import router as maps_router
from app.watchlists.router import router as watchlists_router
from app.opportunities.router import router as opportunities_router
from app.alerts.router import router as alerts_router
from app.notifications.router import router as notifications_router
from app.reports.router import router as reports_router
from app.billing.router import router as billing_router
from app.jobs.router import router as jobs_router
from app.overlaps.router import router as overlaps_router
from app.search.router import router as search_router


app = FastAPI(
    title="GeoConces API",
    description="SaaS para gestión y búsqueda de concesiones mineras en Perú",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- CORS ---
# In production, the localhost regex is disabled (effective_cors_origin_regex
# returns None). Explicit CORS_ORIGINS is always honored.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.effective_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(companies_router)
app.include_router(subscriptions_router)
app.include_router(concessions_router)
app.include_router(ingestion_router)
app.include_router(maps_router)
app.include_router(watchlists_router)
app.include_router(opportunities_router)
app.include_router(alerts_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(billing_router)
app.include_router(jobs_router)
app.include_router(overlaps_router)
app.include_router(search_router)


@app.on_event("startup")
def on_startup():
    if settings.AUTO_CREATE_TABLES:
        models.Base.metadata.create_all(bind=engine)

    # Ensure pgvector extension and embedding column exist (idempotent)
    _ensure_pgvector()


def _ensure_pgvector():
    """Create pgvector extension and embedding column if they don't exist."""
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(text(
                "ALTER TABLE concessions ADD COLUMN IF NOT EXISTS embedding vector(768)"
            ))
            # IVFFlat index for fast ANN (approximate nearest neighbor) search
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_concessions_embedding "
                "ON concessions USING ivfflat (embedding vector_cosine_ops) "
                "WITH (lists = 100)"
            ))
            conn.commit()
    except Exception as exc:
        # Don't block startup if pgvector is not installed in the DB
        import logging
        logging.getLogger(__name__).warning("pgvector setup skipped: %s", exc)


@app.get("/health")
def health_check():
    return {"status": "ok"}
