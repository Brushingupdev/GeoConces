"""tracked rucs

Revision ID: 20260516_0002
Revises: 20260507_0001
Create Date: 2026-05-16 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260516_0002"
down_revision = "20260507_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "tracked_rucs" in inspector.get_table_names():
        return
    op.create_table(
        "tracked_rucs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ruc", sa.String(), nullable=False),
        sa.Column("holder_name", sa.String(), nullable=True),
        sa.Column("label", sa.String()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_tracked_rucs_user_id", "tracked_rucs", ["user_id"])
    op.create_index("ix_tracked_rucs_ruc", "tracked_rucs", ["ruc"])
    op.create_index(
        "idx_tracked_rucs_user_ruc", "tracked_rucs", ["user_id", "ruc"], unique=True
    )


def downgrade() -> None:
    op.drop_index("idx_tracked_rucs_user_ruc", table_name="tracked_rucs")
    op.drop_index("ix_tracked_rucs_ruc", table_name="tracked_rucs")
    op.drop_index("ix_tracked_rucs_user_id", table_name="tracked_rucs")
    op.drop_table("tracked_rucs")
