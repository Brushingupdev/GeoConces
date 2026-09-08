"""initial schema

Revision ID: 20260507_0001
Revises:
Create Date: 2026-05-07 21:10:00
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql


revision = "20260507_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role_enum = sa.Enum("admin", "user", name="userrole")
company_member_role_enum = sa.Enum("owner", "admin", "analyst", "viewer", name="companymemberrole")
subscription_plan_enum = sa.Enum("free", "pro", "enterprise", name="subscriptionplan")
concession_status_enum = sa.Enum("active", "expired", "pending", "suspended", name="concessionstatus")


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Extensiones requeridas
    bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis"))
    bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis_topology"))

    # Los enums se crean automáticamente junto con la primera tabla que los usa.
    # No llamar .create() explícitamente para evitar duplicados con op.create_table.

    if not _has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("hashed_password", sa.String(), nullable=False),
            sa.Column("full_name", sa.String(), nullable=True),
            sa.Column("phone", sa.String(), nullable=True),
            sa.Column("role", user_role_enum, nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    if not _has_table(inspector, "companies"):
        op.create_table(
            "companies",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ruc", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_companies_id"), "companies", ["id"], unique=False)
        op.create_index(op.f("ix_companies_ruc"), "companies", ["ruc"], unique=True)

    if not _has_table(inspector, "company_members"):
        op.create_table(
            "company_members",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("role", company_member_role_enum, nullable=True),
            sa.Column("is_owner", sa.Boolean(), nullable=True),
            sa.Column("joined_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_company_members_id"), "company_members", ["id"], unique=False)
    elif not _has_column(inspector, "company_members", "role"):
        with op.batch_alter_table("company_members") as batch_op:
            batch_op.add_column(sa.Column("role", company_member_role_enum, nullable=True))

    if not _has_table(inspector, "subscriptions"):
        op.create_table(
            "subscriptions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("plan", subscription_plan_enum, nullable=True),
            sa.Column("max_users", sa.Integer(), nullable=True),
            sa.Column("max_watchlist_items", sa.Integer(), nullable=True),
            sa.Column("max_maps", sa.Integer(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=True),
            sa.Column("current_period_start", sa.DateTime(), nullable=True),
            sa.Column("current_period_end", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_subscriptions_id"), "subscriptions", ["id"], unique=False)

    if not _has_table(inspector, "concessions"):
        op.create_table(
            "concessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("holder_name", sa.String(), nullable=True),
            sa.Column("holder_ruc", sa.String(), nullable=True),
            sa.Column("status", concession_status_enum, nullable=True),
            sa.Column("concession_type", sa.String(), nullable=True),
            sa.Column("region", sa.String(), nullable=True),
            sa.Column("province", sa.String(), nullable=True),
            sa.Column("district", sa.String(), nullable=True),
            sa.Column("area_hectares", sa.Float(), nullable=True),
            sa.Column("registration_date", sa.DateTime(), nullable=True),
            sa.Column("title_date", sa.DateTime(), nullable=True),
            sa.Column("expiration_date", sa.DateTime(), nullable=True),
            sa.Column("source", sa.String(), nullable=True),
            sa.Column("sidemcat_data", sa.JSON(), nullable=True),
            sa.Column("sidemcat_fetched_at", sa.DateTime(), nullable=True),
            sa.Column("expediente_data", sa.JSON(), nullable=True),
            sa.Column("expediente_fetched_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_concessions_id"), "concessions", ["id"], unique=False)
        op.create_index(op.f("ix_concessions_code"), "concessions", ["code"], unique=True)
        op.create_index(op.f("ix_concessions_holder_name"), "concessions", ["holder_name"], unique=False)
        op.create_index(op.f("ix_concessions_holder_ruc"), "concessions", ["holder_ruc"], unique=False)
        op.create_index(op.f("ix_concessions_region"), "concessions", ["region"], unique=False)

    if not _has_table(inspector, "concession_geometries"):
        op.create_table(
            "concession_geometries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("geom", Geometry("POLYGON", srid=4326), nullable=True),
            sa.Column("centroid", Geometry("POINT", srid=4326), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_concession_geometries_id"), "concession_geometries", ["id"], unique=False)
        op.create_index("idx_concession_geom", "concession_geometries", ["geom"], unique=False, postgresql_using="gist")

    if not _has_table(inspector, "concession_status_history"):
        op.create_table(
            "concession_status_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("previous_status", sa.String(), nullable=True),
            sa.Column("new_status", sa.String(), nullable=True),
            sa.Column("changed_at", sa.DateTime(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
        )
        op.create_index(op.f("ix_concession_status_history_id"), "concession_status_history", ["id"], unique=False)

    if not _has_table(inspector, "concession_events"):
        op.create_table(
            "concession_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("payload", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("source", sa.String(), nullable=True),
            sa.Column("detected_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_concession_events_id"), "concession_events", ["id"], unique=False)

    if not _has_table(inspector, "concession_payments"):
        op.create_table(
            "concession_payments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("payment_type", sa.String(), nullable=True),
            sa.Column("amount", sa.Float(), nullable=True),
            sa.Column("currency", sa.String(), nullable=True),
            sa.Column("paid", sa.Boolean(), nullable=True),
            sa.Column("due_date", sa.DateTime(), nullable=True),
            sa.Column("paid_date", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_concession_payments_id"), "concession_payments", ["id"], unique=False)

    if not _has_table(inspector, "concession_documents"):
        op.create_table(
            "concession_documents",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("document_type", sa.String(), nullable=True),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_concession_documents_id"), "concession_documents", ["id"], unique=False)

    if not _has_table(inspector, "stored_files"):
        op.create_table(
            "stored_files",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("bucket", sa.String(), nullable=True),
            sa.Column("provider", sa.String(), nullable=True),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("object_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_stored_files_id"), "stored_files", ["id"], unique=False)
        op.create_index(op.f("ix_stored_files_key"), "stored_files", ["key"], unique=True)

    if not _has_table(inspector, "watchlists"):
        op.create_table(
            "watchlists",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_watchlists_id"), "watchlists", ["id"], unique=False)
    elif not _has_column(inspector, "watchlists", "company_id"):
        with op.batch_alter_table("watchlists") as batch_op:
            batch_op.add_column(sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True))

    if not _has_table(inspector, "watchlist_items"):
        op.create_table(
            "watchlist_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id"), nullable=False),
            sa.Column("concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("added_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_watchlist_items_id"), "watchlist_items", ["id"], unique=False)

    if not _has_table(inspector, "alerts"):
        op.create_table(
            "alerts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("alert_type", sa.String(), nullable=True),
            sa.Column("title", sa.String(), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=True),
            sa.Column("related_concession_id", sa.Integer(), sa.ForeignKey("concessions.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_alerts_id"), "alerts", ["id"], unique=False)

    if not _has_table(inspector, "alert_rules"):
        op.create_table(
            "alert_rules",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("rule_type", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("filters", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("channels", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_alert_rules_id"), "alert_rules", ["id"], unique=False)

    if not _has_table(inspector, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("channel", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("subject", sa.String(), nullable=True),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)

    if not _has_table(inspector, "reports"):
        op.create_table(
            "reports",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("report_type", sa.String(), nullable=True),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("stored_file_id", sa.Integer(), sa.ForeignKey("stored_files.id"), nullable=True),
            sa.Column("filters", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("generated_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_reports_id"), "reports", ["id"], unique=False)
    else:
        if not _has_column(inspector, "reports", "company_id"):
            with op.batch_alter_table("reports") as batch_op:
                batch_op.add_column(sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True))
        if not _has_column(inspector, "reports", "stored_file_id"):
            with op.batch_alter_table("reports") as batch_op:
                batch_op.add_column(sa.Column("stored_file_id", sa.Integer(), sa.ForeignKey("stored_files.id"), nullable=True))

    if not _has_table(inspector, "data_import_logs"):
        op.create_table(
            "data_import_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True),
            sa.Column("source", sa.String(), nullable=True),
            sa.Column("import_type", sa.String(), nullable=True),
            sa.Column("records_processed", sa.Integer(), nullable=True),
            sa.Column("records_created", sa.Integer(), nullable=True),
            sa.Column("records_updated", sa.Integer(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
        )
        op.create_index(op.f("ix_data_import_logs_id"), "data_import_logs", ["id"], unique=False)
    else:
        if not _has_column(inspector, "data_import_logs", "company_id"):
            with op.batch_alter_table("data_import_logs") as batch_op:
                batch_op.add_column(sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=True))
        if not _has_column(inspector, "data_import_logs", "import_type"):
            with op.batch_alter_table("data_import_logs") as batch_op:
                batch_op.add_column(sa.Column("import_type", sa.String(), nullable=True))

    if not _has_table(inspector, "audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("table_name", sa.String(), nullable=True),
            sa.Column("record_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(), nullable=True),
            sa.Column("old_values", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("new_values", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("performed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table_name in [
        "audit_logs",
        "data_import_logs",
        "reports",
        "notifications",
        "alert_rules",
        "alerts",
        "watchlist_items",
        "watchlists",
        "stored_files",
        "concession_documents",
        "concession_payments",
        "concession_events",
        "concession_status_history",
        "concession_geometries",
        "concessions",
        "subscriptions",
        "company_members",
        "companies",
        "users",
    ]:
        if _has_table(inspector, table_name):
            op.drop_table(table_name)

    concession_status_enum.drop(bind, checkfirst=True)
    subscription_plan_enum.drop(bind, checkfirst=True)
    company_member_role_enum.drop(bind, checkfirst=True)
    user_role_enum.drop(bind, checkfirst=True)
