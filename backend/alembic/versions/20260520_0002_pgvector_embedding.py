"""pgvector embedding para búsqueda semántica

Revision ID: 20260520_0002
Revises: 20260507_0001
Create Date: 2026-05-20 10:00:00

Agrega:
  - Extensión pgvector (si está disponible en la imagen PostgreSQL)
  - Columna embedding vector(768) en la tabla concessions
  - Índice IVFFlat para búsqueda aproximada de vecinos más cercanos
"""

from alembic import op
import sqlalchemy as sa


revision = "20260520_0002"
down_revision = "20260516_0002"
branch_labels = None
depends_on = None


def _has_column(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(
        col["name"] == column_name
        for col in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Instalar extensión pgvector (falla silenciosamente si no está disponible)
    try:
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as exc:
        print(f"[WARNING] No se pudo crear extensión vector: {exc}")
        print("[WARNING] Las búsquedas semánticas estarán desactivadas.")
        return

    # 2. Agregar columna embedding si no existe
    if not _has_column(bind, "concessions", "embedding"):
        bind.execute(sa.text(
            "ALTER TABLE concessions ADD COLUMN embedding vector(768)"
        ))

    # 3. Índice IVFFlat (aproximado, mucho más rápido que exacto para 64k+ filas)
    # lists=100 es adecuado para ~64k vectores (regla: sqrt(n))
    bind.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_concessions_embedding
        ON concessions USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "DROP INDEX IF EXISTS idx_concessions_embedding"
    ))
    bind.execute(sa.text(
        "ALTER TABLE concessions DROP COLUMN IF EXISTS embedding"
    ))
    # No eliminamos la extensión vector (puede usarse por otras tablas)
