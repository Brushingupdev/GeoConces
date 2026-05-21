from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.common.dependencies import get_current_active_user
from app.models import Alert, AlertRule, User
from app.schemas import AlertOut, AlertRuleOut, AlertRuleCreate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Fast count of unread alerts — polled by the sidebar badge every 60 s."""
    count = (
        db.query(Alert)
        .filter(Alert.user_id == current_user.id, Alert.is_read == False)
        .count()
    )
    return {"count": count}


@router.get("", response_model=List[AlertOut])
def list_alerts(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(Alert).filter(Alert.user_id == current_user.id)
    if unread_only:
        q = q.filter(Alert.is_read == False)
    return q.order_by(Alert.created_at.desc()).limit(100).all()


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lightweight endpoint for sidebar badge. Returns {count: int}."""
    count = (
        db.query(Alert)
        .filter(Alert.user_id == current_user.id, Alert.is_read == False)
        .count()
    )
    return {"count": count}

@router.post("/{alert_id}/read", response_model=AlertOut)
def mark_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if alert:
        alert.is_read = True
        db.commit()
        db.refresh(alert)
    return alert

@router.get("/rules", response_model=List[AlertRuleOut])
def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return (
        db.query(AlertRule)
        .filter(AlertRule.user_id == current_user.id)
        .order_by(AlertRule.created_at.desc())
        .all()
    )

@router.post("/rules", response_model=AlertRuleOut, status_code=201)
def create_rule(
    data: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rule = AlertRule(
        user_id=current_user.id,
        rule_type=data.rule_type,
        name=data.name,
        filters=data.filters,
        channels=data.channels,
        is_active=data.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
def update_rule(
    rule_id: int,
    data: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id, AlertRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    rule.rule_type = data.rule_type
    rule.name = data.name
    rule.filters = data.filters
    rule.channels = data.channels
    rule.is_active = data.is_active
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id, AlertRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    db.delete(rule)
    db.commit()
    return
