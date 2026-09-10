"""Zones, rules, and the event timeline for the radar rules engine.

Reads (list zones/rules/events) are open to any device member so a viewer's
dashboard can render the zone overlay and recent alerts. Mutations require a Pro
subscription (spec §9) *and* an admin/owner role on the device.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import delete as sql_delete, func
from sqlmodel import Session, select

from app.auth import get_current_user, require_pro
from app.database import get_session
from app.api.devices import _device_for_user  # shared membership+role gate
from app.models.analytics import ZoneOccupancySample
from app.models.device import ROLE_ADMIN, ROLE_VIEWER
from app.models.rule import Rule, RuleEvent
from app.models.user import User
from app.models.zone import Zone
from app.schemas.rule import (
    RuleCreate,
    RuleEventResponse,
    RuleResponse,
    RuleUpdate,
    validate_rule_config,
)
from app.schemas.zone import ZoneCreate, ZoneResponse, ZoneUpdate
from app.services.rule_engine import rule_engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["radar-zones"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_zone_for_user(session: Session, zone_id: int, user: User, min_role: str) -> Zone:
    zone = session.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    _device_for_user(session, zone.device_id, user, min_role)
    return zone


def _get_rule_for_user(session: Session, rule_id: int, user: User, min_role: str) -> Rule:
    rule = session.get(Rule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    _device_for_user(session, rule.device_id, user, min_role)
    return rule


# --------------------------------------------------------------------------- #
# Zones
# --------------------------------------------------------------------------- #
@router.get("/devices/{device_id}/zones")
def list_zones(
    device_id: int = Path(ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    total = session.exec(
        select(func.count()).select_from(
            select(Zone.id).where(Zone.device_id == device_id).subquery()
        )
    ).one()
    rows = session.exec(
        select(Zone).where(Zone.device_id == device_id).order_by(Zone.id).offset(skip).limit(limit)
    ).all()
    return {
        "items": [ZoneResponse.model_validate(z) for z in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post(
    "/devices/{device_id}/zones",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_zone(
    data: ZoneCreate,
    device_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    _device_for_user(session, device_id, user, ROLE_ADMIN)
    zone = Zone(
        device_id=device_id,
        name=data.name,
        points=[p.model_dump() for p in data.points],
    )
    session.add(zone)
    session.commit()
    session.refresh(zone)
    rule_engine.invalidate(device_id)
    return zone


@router.put("/zones/{zone_id}", response_model=ZoneResponse)
def update_zone(
    data: ZoneUpdate,
    zone_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    zone = _get_zone_for_user(session, zone_id, user, ROLE_ADMIN)
    if data.name is not None:
        zone.name = data.name
    if data.points is not None:
        zone.points = [p.model_dump() for p in data.points]
    zone.updated_at = _utcnow()
    session.add(zone)
    session.commit()
    session.refresh(zone)
    rule_engine.invalidate(zone.device_id)
    return zone


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(
    zone_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    zone = _get_zone_for_user(session, zone_id, user, ROLE_ADMIN)
    device_id = zone.device_id
    # Cascade child-first so FKs hold on Postgres: rule events, occupancy
    # samples, rules, then the zone itself.
    for rule in session.exec(select(Rule).where(Rule.zone_id == zone_id)).all():
        for ev in session.exec(select(RuleEvent).where(RuleEvent.rule_id == rule.id)).all():
            session.delete(ev)
        session.delete(rule)
    session.exec(sql_delete(ZoneOccupancySample).where(ZoneOccupancySample.zone_id == zone_id))
    session.delete(zone)
    session.commit()
    rule_engine.invalidate(device_id)


# --------------------------------------------------------------------------- #
# Rules
# --------------------------------------------------------------------------- #
@router.get("/devices/{device_id}/rules")
def list_rules(
    device_id: int = Path(ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    total = session.exec(
        select(func.count()).select_from(
            select(Rule.id).where(Rule.device_id == device_id).subquery()
        )
    ).one()
    rows = session.exec(
        select(Rule).where(Rule.device_id == device_id).order_by(Rule.id).offset(skip).limit(limit)
    ).all()
    return {
        "items": [RuleResponse.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post(
    "/devices/{device_id}/rules",
    response_model=RuleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rule(
    data: RuleCreate,
    device_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    _device_for_user(session, device_id, user, ROLE_ADMIN)
    zone = session.get(Zone, data.zone_id)
    if zone is None or zone.device_id != device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="zone_id does not belong to this device",
        )
    rule = Rule(
        zone_id=data.zone_id,
        device_id=device_id,
        name=data.name,
        trigger_type=data.trigger_type,
        dwell_seconds=data.dwell_seconds,
        occupancy_threshold=data.occupancy_threshold,
        cooldown_seconds=data.cooldown_seconds,
        action_dashboard=data.action_dashboard,
        action_email=data.action_email,
        notify_email=data.notify_email,
        action_alarm=data.action_alarm,
        alarm_duration_ms=data.alarm_duration_ms,
        enabled=data.enabled,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    rule_engine.invalidate(device_id)
    return rule


@router.put("/rules/{rule_id}", response_model=RuleResponse)
def update_rule(
    data: RuleUpdate,
    rule_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    rule = _get_rule_for_user(session, rule_id, user, ROLE_ADMIN)
    fields = data.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(rule, key, value)
    # Re-check cross-field consistency against the merged rule.
    try:
        validate_rule_config(
            rule.trigger_type,
            rule.dwell_seconds,
            rule.occupancy_threshold,
            rule.action_email,
            rule.notify_email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))  # Unprocessable Content
    rule.updated_at = _utcnow()
    session.add(rule)
    session.commit()
    session.refresh(rule)
    rule_engine.invalidate(rule.device_id)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: int = Path(ge=1),
    user: User = Depends(require_pro),
    session: Session = Depends(get_session),
):
    rule = _get_rule_for_user(session, rule_id, user, ROLE_ADMIN)
    device_id = rule.device_id
    for ev in session.exec(select(RuleEvent).where(RuleEvent.rule_id == rule_id)).all():
        session.delete(ev)
    session.delete(rule)
    session.commit()
    rule_engine.invalidate(device_id)


# --------------------------------------------------------------------------- #
# Event timeline
# --------------------------------------------------------------------------- #
@router.get("/devices/{device_id}/events")
def list_events(
    device_id: int = Path(ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    total = session.exec(
        select(func.count()).select_from(
            select(RuleEvent.id).where(RuleEvent.device_id == device_id).subquery()
        )
    ).one()
    rows = session.exec(
        select(RuleEvent)
        .where(RuleEvent.device_id == device_id)
        .order_by(RuleEvent.fired_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return {
        "items": [RuleEventResponse.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }
