from datetime import datetime, timedelta, timezone
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.common.dependencies import get_current_active_user
from app.models import (
    Company,
    CompanyMember,
    CompanyMemberRole,
    Subscription,
    SubscriptionPlan,
    User,
    UserRole,
)
from app.schemas import RefreshRequest, Token, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


def _provision_company_for_user(db: Session, user: User, ruc: str, name: str) -> None:
    """Create Company + owner CompanyMember + free trial Subscription.

    Idempotent on the RUC: if a Company with that RUC already exists, just
    add the user as owner if not already a member.
    """
    company = db.query(Company).filter(Company.ruc == ruc).first()
    if company is None:
        company = Company(ruc=ruc, name=name)
        db.add(company)
        db.flush()  # need id for FKs below

    already_member = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == company.id,
            CompanyMember.user_id == user.id,
        )
        .first()
    )
    if not already_member:
        db.add(
            CompanyMember(
                user_id=user.id,
                company_id=company.id,
                role=CompanyMemberRole.owner,
                is_owner=True,
            )
        )

    # Create a free trial subscription only if the company has none.
    has_subscription = (
        db.query(Subscription).filter(Subscription.company_id == company.id).first()
    )
    if not has_subscription:
        now = datetime.now(timezone.utc)
        db.add(
            Subscription(
                company_id=company.id,
                plan=SubscriptionPlan.free,
                max_users=3,
                max_watchlist_items=20,
                max_maps=3,
                active=True,
                current_period_start=now,
                current_period_end=now + timedelta(days=14),
            )
        )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # XOR validation: if user provides one of {company_ruc, company_name}, must provide both.
    if bool(data.company_ruc) != bool(data.company_name):
        raise HTTPException(
            status_code=422,
            detail="Para registrar empresa debes enviar company_ruc y company_name juntos",
        )

    # First user in an empty instance becomes admin (platform bootstrapping).
    is_first_user = db.query(User).first() is None
    role = UserRole.admin if is_first_user else UserRole.user

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=role,
    )
    db.add(user)
    db.flush()  # need user.id for company member FK

    if data.company_ruc and data.company_name:
        _provision_company_for_user(db, user, data.company_ruc, data.company_name)

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
@limiter.limit("30/minute")
def refresh(request: Request, data: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a fresh pair (rotation)."""
    invalid = HTTPException(status_code=401, detail="Invalid refresh token")
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError:
        raise invalid

    if payload.get("type") != "refresh":
        raise invalid
    user_id = payload.get("sub")
    if user_id is None:
        raise invalid

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise invalid

    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_active_user)):
    return current_user


# ── Password reset ────────────────────────────────────────────────────────────

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

RESET_TOKEN_TTL_MINUTES = 30
_reset_tokens: dict[str, tuple[int, datetime]] = {}

@router.post("/password-reset/request")
@limiter.limit("3/minute")
def password_reset_request(request: Request, data: PasswordResetRequest, db: Session = Depends(get_db)):
    """Genera un token de reset. En producción enviaría un email; aquí devuelve el token directamente."""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        # No revelar si el email existe
        return {"message": "Si el email existe, recibirás un enlace de recuperación."}
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = (
        user.id,
        datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    )
    response = {"message": "Si el email existe, recibirás un enlace de recuperación."}
    # Until Resend delivery is wired, expose the token only in development.
    if not settings.is_production:
        response["dev_token"] = token
    return response

@router.post("/password-reset/confirm")
@limiter.limit("5/minute")
def password_reset_confirm(request: Request, data: PasswordResetConfirm, db: Session = Depends(get_db)):
    record = _reset_tokens.pop(data.token, None)
    if not record:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    user_id, expires_at = record
    if datetime.now(timezone.utc) >= expires_at:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if (
        len(data.new_password) < 8
        or not re.search(r"[A-Za-z]", data.new_password)
        or not re.search(r"\d", data.new_password)
    ):
        raise HTTPException(
            status_code=422,
            detail="La contraseña debe tener al menos 8 caracteres y contener una letra y un número",
        )
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}
