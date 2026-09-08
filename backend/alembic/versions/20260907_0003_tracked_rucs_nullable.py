"""Allow tracked holders without a RUC.

Revision ID: 20260907_0003
Revises: 20260520_0002
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_0003"
down_revision = "20260520_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "tracked_rucs",
        "ruc",
        existing_type=sa.String(),
        nullable=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    has_nulls = bind.execute(
        sa.text("SELECT 1 FROM tracked_rucs WHERE ruc IS NULL LIMIT 1")
    ).first()
    if has_nulls:
        raise RuntimeError("Cannot make tracked_rucs.ruc NOT NULL while NULL rows exist")

    op.alter_column(
        "tracked_rucs",
        "ruc",
        existing_type=sa.String(),
        nullable=False,
    )
