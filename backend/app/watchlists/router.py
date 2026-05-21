from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Watchlist, WatchlistItem, User, Concession
from app.schemas import WatchlistOut, WatchlistCreate, WatchlistItemCreate, WatchlistItemOut

router = APIRouter(prefix="/watchlists", tags=["watchlists"])

@router.get("", response_model=List[WatchlistOut])
def get_watchlists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()

@router.post("", response_model=WatchlistOut, status_code=201)
def create_watchlist(
    data: WatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wl = Watchlist(user_id=current_user.id, name=data.name)
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl

@router.post("/{watchlist_id}/items", response_model=WatchlistItemOut, status_code=201)
def add_item(
    watchlist_id: int,
    data: WatchlistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    concession = db.query(Concession).filter(Concession.id == data.concession_id).first()
    if not concession:
        raise HTTPException(status_code=404, detail="Concession not found")
    item = WatchlistItem(watchlist_id=watchlist_id, concession_id=data.concession_id, notes=data.notes)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{watchlist_id}", status_code=204)
def delete_watchlist(
    watchlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    db.delete(wl)
    db.commit()
    return


@router.delete("/{watchlist_id}/items/{item_id}", status_code=204)
def remove_item(
    watchlist_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    item = (
        db.query(WatchlistItem)
        .join(Watchlist)
        .filter(WatchlistItem.id == item_id, Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return
