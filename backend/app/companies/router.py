from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Company, CompanyMember, User


router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    memberships = (
        db.query(CompanyMember)
        .filter(CompanyMember.user_id == current_user.id)
        .all()
    )
    company_ids = [membership.company_id for membership in memberships]
    if not company_ids:
        return []
    return db.query(Company).filter(Company.id.in_(company_ids)).all()
