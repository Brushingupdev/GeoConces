import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, JSON, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.core.database import Base

try:
    from pgvector.sqlalchemy import Vector as PGVector
    _PGVECTOR_AVAILABLE = True
except ImportError:
    PGVector = None
    _PGVECTOR_AVAILABLE = False

class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"

class CompanyMemberRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"

class SubscriptionPlan(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"

class ConcessionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    pending = "pending"
    suspended = "suspended"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    phone = Column(String)
    role = Column(SQLEnum(UserRole), default=UserRole.user)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    companies = relationship("CompanyMember", back_populates="user")
    watchlists = relationship("Watchlist", back_populates="user")
    alerts = relationship("Alert", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    tracked_rucs = relationship("TrackedRuc", back_populates="user", cascade="all, delete-orphan")

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    ruc = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    members = relationship("CompanyMember", back_populates="company")
    subscriptions = relationship("Subscription", back_populates="company")

class CompanyMember(Base):
    __tablename__ = "company_members"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    role = Column(SQLEnum(CompanyMemberRole), default=CompanyMemberRole.viewer)
    is_owner = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="companies")
    company = relationship("Company", back_populates="members")

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    plan = Column(SQLEnum(SubscriptionPlan), default=SubscriptionPlan.free)
    max_users = Column(Integer, default=1)
    max_watchlist_items = Column(Integer, default=10)
    max_maps = Column(Integer, default=3)
    active = Column(Boolean, default=True)
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="subscriptions")

class Concession(Base):
    __tablename__ = "concessions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    holder_name = Column(String, index=True)
    holder_ruc = Column(String, index=True)
    status = Column(SQLEnum(ConcessionStatus), default=ConcessionStatus.active)
    concession_type = Column(String)
    region = Column(String, index=True)
    province = Column(String)
    district = Column(String)
    area_hectares = Column(Float)
    registration_date = Column(DateTime)
    title_date = Column(DateTime)
    expiration_date = Column(DateTime)
    source = Column(String, default="INGEMMET")
    sidemcat_data        = Column(JSON, nullable=True)       # cached SIDEMCAT response
    sidemcat_fetched_at  = Column(DateTime, nullable=True)   # when it was last fetched
    expediente_data      = Column(JSON, nullable=True)       # datos extraídos del PDF
    expediente_fetched_at = Column(DateTime, nullable=True)  # última extracción OCR
    # pgvector embedding for semantic search (paraphrase-multilingual-MiniLM-L12-v2, 384 dims)
    embedding            = Column(PGVector(768) if _PGVECTOR_AVAILABLE else JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    geometries = relationship("ConcessionGeometry", back_populates="concession")
    history = relationship("ConcessionStatusHistory", back_populates="concession")
    events = relationship("ConcessionEvent", back_populates="concession")
    payments = relationship("ConcessionPayment", back_populates="concession")
    watchlist_items = relationship("WatchlistItem", back_populates="concession")
    documents = relationship("ConcessionDocument", back_populates="concession")

class ConcessionGeometry(Base):
    __tablename__ = "concession_geometries"
    id = Column(Integer, primary_key=True, index=True)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    geom = Column(Geometry("POLYGON", srid=4326))
    centroid = Column(Geometry("POINT", srid=4326))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    concession = relationship("Concession", back_populates="geometries")

Index("idx_concession_geom", ConcessionGeometry.geom, postgresql_using="GIST")

class ConcessionStatusHistory(Base):
    __tablename__ = "concession_status_history"
    id = Column(Integer, primary_key=True, index=True)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    previous_status = Column(String)
    new_status = Column(String)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(Text)

    concession = relationship("Concession", back_populates="history")

class ConcessionEvent(Base):
    __tablename__ = "concession_events"
    id = Column(Integer, primary_key=True, index=True)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    event_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    payload = Column(JSON)
    source = Column(String, default="system")
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    concession = relationship("Concession", back_populates="events")

class ConcessionPayment(Base):
    __tablename__ = "concession_payments"
    id = Column(Integer, primary_key=True, index=True)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    payment_type = Column(String)  # vigencia, penalidad
    amount = Column(Float)
    currency = Column(String, default="PEN")
    paid = Column(Boolean, default=False)
    due_date = Column(DateTime)
    paid_date = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    concession = relationship("Concession", back_populates="payments")

class ConcessionDocument(Base):
    __tablename__ = "concession_documents"
    id = Column(Integer, primary_key=True, index=True)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    document_type = Column(String)
    file_path = Column(String)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    concession = relationship("Concession", back_populates="documents")

class StoredFile(Base):
    __tablename__ = "stored_files"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    key = Column(String, unique=True, nullable=False)
    bucket = Column(String)
    provider = Column(String, default="s3")
    content_type = Column(String)
    size_bytes = Column(Integer)
    object_metadata = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, default="Mi Watchlist")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False)
    concession_id = Column(Integer, ForeignKey("concessions.id"), nullable=False)
    notes = Column(Text)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    watchlist = relationship("Watchlist", back_populates="items")
    concession = relationship("Concession", back_populates="watchlist_items")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type = Column(String)  # expiration, payment, status_change
    title = Column(String)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    related_concession_id = Column(Integer, ForeignKey("concessions.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="alerts")

class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rule_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    filters = Column(JSON)
    channels = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel = Column(String)  # email, whatsapp, in_app
    status = Column(String, default="pending")  # pending, sent, failed
    subject = Column(String)
    body = Column(Text)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_type = Column(String)
    file_path = Column(String)
    stored_file_id = Column(Integer, ForeignKey("stored_files.id"))
    filters = Column(JSON)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DataImportLog(Base):
    __tablename__ = "data_import_logs"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    source = Column(String)
    import_type = Column(String, default="sync")
    records_processed = Column(Integer)
    records_created = Column(Integer)
    records_updated = Column(Integer)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    error_message = Column(Text)

class TrackedRuc(Base):
    __tablename__ = "tracked_rucs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ruc = Column(String, nullable=True, index=True)       # nullable — puede seguirse solo por nombre
    holder_name = Column(String, nullable=True)            # para titulares sin RUC
    label = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="tracked_rucs")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String)
    record_id = Column(Integer)
    action = Column(String)  # create, update, delete
    old_values = Column(JSON)
    new_values = Column(JSON)
    performed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
