from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash
from app.common.dependencies import get_current_active_user
from app.models import User, TrackedRuc
from app.schemas import UserOut, UserProfileUpdate, TrackedRucCreate, TrackedRucOut, PasswordChange

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.patch("/me", response_model=UserOut)
def update_me(data: UserProfileUpdate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.phone is not None:
        current_user.phone = data.phone
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/password", status_code=204)
def change_password(data: PasswordChange, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return

@router.get("/me/tracked-rucs", response_model=List[TrackedRucOut])
def list_tracked_rucs(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return (
        db.query(TrackedRuc)
        .filter(TrackedRuc.user_id == current_user.id)
        .order_by(TrackedRuc.created_at.desc())
        .all()
    )

@router.post("/me/tracked-rucs", response_model=TrackedRucOut, status_code=201)
def add_tracked_ruc(data: TrackedRucCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    ruc         = data.ruc.strip() if data.ruc else None
    holder_name = data.holder_name.strip() if data.holder_name else None

    if not ruc and not holder_name:
        raise HTTPException(status_code=400, detail="Debes proveer un RUC o un nombre de titular")

    if ruc and (not ruc.isdigit() or len(ruc) != 11):
        raise HTTPException(status_code=400, detail="El RUC debe tener 11 dígitos")

    # El label por defecto es el holder_name si no se provee
    label = data.label or holder_name or ruc

    item = TrackedRuc(
        user_id=current_user.id,
        ruc=ruc,
        holder_name=holder_name,
        label=label,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este titular ya está siendo seguido")
    db.refresh(item)
    return item

@router.delete("/me/tracked-rucs/{ruc_id}", status_code=204)
def remove_tracked_ruc(ruc_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    item = db.query(TrackedRuc).filter(TrackedRuc.id == ruc_id, TrackedRuc.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="RUC no encontrado")
    db.delete(item)
    db.commit()
    return
