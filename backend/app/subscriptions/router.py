from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import CompanyMember, Subscription, User


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/company/{company_id}")
def get_company_subscription(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    membership = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Company not found")
    return (
        db.query(Subscription)
        .filter(Subscription.company_id == company_id, Subscription.active.is_(True))
        .order_by(Subscription.created_at.desc())
        .first()
    )
