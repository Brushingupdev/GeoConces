from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime
import re
from app.models import UserRole, CompanyMemberRole, SubscriptionPlan, ConcessionStatus

# Auth
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[int] = None
    type: Optional[str] = None

class RefreshRequest(BaseModel):
    refresh_token: str


def _validate_password_strength(password: str) -> str:
    """Min 8 chars, at least 1 letter and 1 digit."""
    if not isinstance(password, str) or len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("La contraseña debe contener al menos una letra")
    if not re.search(r"\d", password):
        raise ValueError("La contraseña debe contener al menos un número")
    return password


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    # Optional: if both provided, registration also creates Company + Subscription (trial).
    company_ruc: Optional[str] = None
    company_name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("company_ruc")
    @classmethod
    def _validate_ruc(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip()
        if not re.fullmatch(r"\d{11}", v):
            raise ValueError("RUC debe tener exactamente 11 dígitos numéricos")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Users
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.user
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

# Companies
class CompanyBase(BaseModel):
    ruc: str
    name: str
    address: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyOut(CompanyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CompanyMemberOut(BaseModel):
    id: int
    user_id: int
    company_id: int
    role: CompanyMemberRole
    is_owner: bool
    joined_at: datetime

    class Config:
        from_attributes = True

# Subscriptions
class SubscriptionBase(BaseModel):
    plan: SubscriptionPlan = SubscriptionPlan.free
    active: bool = True

class SubscriptionOut(SubscriptionBase):
    id: int
    company_id: int
    max_users: int
    max_watchlist_items: int
    max_maps: int
    created_at: datetime

    class Config:
        from_attributes = True

# Concessions
class ConcessionBase(BaseModel):
    code: str
    name: str
    holder_name: Optional[str] = None
    holder_ruc: Optional[str] = None
    status: ConcessionStatus = ConcessionStatus.active
    concession_type: Optional[str] = None
    region: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    area_hectares: Optional[float] = None
    registration_date: Optional[datetime] = None
    title_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    source: Optional[str] = "INGEMMET"

class ConcessionCreate(ConcessionBase):
    pass

class ConcessionOut(ConcessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConcessionSearchResult(BaseModel):
    id: int
    code: str
    name: str
    holder_name: Optional[str] = None
    status: ConcessionStatus
    region: Optional[str] = None
    area_hectares: Optional[float] = None

    class Config:
        from_attributes = True

class ConcessionDetail(ConcessionOut):
    geometry: Optional[dict] = None
    history: List[dict] = []
    payments: List[dict] = []

class ConcessionEventOut(BaseModel):
    id: int
    concession_id: int
    event_type: str
    title: str
    payload: Optional[dict] = None
    source: str
    detected_at: datetime

    class Config:
        from_attributes = True

# Watchlists
class WatchlistItemCreate(BaseModel):
    concession_id: int
    notes: Optional[str] = None

class WatchlistItemOut(BaseModel):
    id: int
    concession_id: int
    notes: Optional[str] = None
    added_at: datetime
    concession: ConcessionSearchResult

    class Config:
        from_attributes = True

class WatchlistBase(BaseModel):
    name: str = "Mi Watchlist"

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistOut(WatchlistBase):
    id: int
    user_id: int
    created_at: datetime
    items: List[WatchlistItemOut] = []

    class Config:
        from_attributes = True

# Alerts
class AlertBase(BaseModel):
    alert_type: str
    title: str
    message: str
    related_concession_id: Optional[int] = None

class AlertOut(AlertBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AlertRuleBase(BaseModel):
    rule_type: str
    name: str
    filters: Optional[dict] = None
    channels: Optional[List[str]] = None
    is_active: bool = True

class AlertRuleCreate(AlertRuleBase):
    pass

class AlertRuleOut(AlertRuleBase):
    id: int
    user_id: int
    company_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Maps / Geometry
class MapBoundsQuery(BaseModel):
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float

class ConcessionMapFeature(BaseModel):
    id: int
    code: str
    name: str
    status: str
    holder_name: Optional[str] = None
    centroid: Optional[List[float]] = None

class ConcessionGeometryOut(BaseModel):
    id: int
    concession_id: int
    geojson: Optional[dict] = None

    class Config:
        from_attributes = True

# Reports
class ReportRequest(BaseModel):
    report_type: str  # "concessions"
    format: str = "xlsx"  # xlsx | pdf
    scope: str = "all"  # all | mine | opportunities
    q: Optional[str] = None
    region: Optional[str] = None
    status: Optional[ConcessionStatus] = None
    concession_ids: Optional[List[int]] = None

class ReportOut(BaseModel):
    id: int
    report_type: str
    file_path: Optional[str] = None
    filters: Optional[dict] = None
    generated_at: datetime

    class Config:
        from_attributes = True

class StoredFileOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    key: str
    bucket: Optional[str] = None
    provider: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Tracked RUCs
class TrackedRucCreate(BaseModel):
    ruc:         Optional[str] = None
    holder_name: Optional[str] = None
    label:       Optional[str] = None

class TrackedRucOut(BaseModel):
    id:          int
    ruc:         Optional[str] = None
    holder_name: Optional[str] = None
    label:       Optional[str] = None
    created_at:  datetime

    class Config:
        from_attributes = True

# Opportunities scoring
class OpportunityOut(BaseModel):
    id: int
    code: str
    name: str
    holder_name: Optional[str] = None
    holder_ruc: Optional[str] = None
    status: ConcessionStatus
    region: Optional[str] = None
    area_hectares: Optional[float] = None
    expiration_date: Optional[datetime] = None
    score: int
    factors: List[str]

    class Config:
        from_attributes = True

# Password change
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return _validate_password_strength(v)

# Ingestion
class IngestionConcessionRow(BaseModel):
    code: str
    name: str
    holder_name: Optional[str] = None
    holder_ruc: Optional[str] = None
    status: Optional[str] = None
    concession_type: Optional[str] = None
    region: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    area_hectares: Optional[float] = None
    registration_date: Optional[datetime] = None
    title_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    source: Optional[str] = None
    geometry_wkt: Optional[str] = None
    geometry_geojson: Optional[dict[str, Any]] = None
    raw: Optional[dict[str, Any]] = None

class IngestionConcessionRequest(BaseModel):
    source: str = "manual"
    import_type: str = "manual"
    rows: List[IngestionConcessionRow]

class IngestionConcessionResult(BaseModel):
    processed: int
    created: int
    updated: int
    events_created: int
    import_log_id: int
