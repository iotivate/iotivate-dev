import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import delete as sql_delete, func
from sqlmodel import Session, select

from app.auth import generate_device_token, get_current_device, get_current_user
from app.database import get_session
from app.models.device import (
    Device,
    DeviceUser,
    PAIRING_PAIRED,
    ROLE_ADMIN,
    ROLE_OWNER,
    ROLE_VIEWER,
)
from app.models.user import User
from app.models.zone import Zone
from app.models.rule import Rule, RuleEvent
from app.models.analytics import ZoneOccupancySample
from app.services.radar_manager import manager
from app.services.rule_engine import rule_engine
from app.schemas.alarm import AlarmTriggerRequest, build_alarm_command
from app.schemas.device import (
    DeviceCreatedResponse,
    DeviceCreateRequest,
    DevicePairRequest,
    DevicePairResponse,
    DeviceResponse,
    PairingCodeResponse,
)

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/devices", tags=["devices"])

# Pairing codes: 8 chars from an unambiguous alphabet (no I/L/O/U/0/1) so they
# are easy to read off a screen and type. ~30^8 ≈ 6.5e11 combinations, valid
# for a short window and rate-limited — brute force is infeasible.
PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"
PAIRING_CODE_LENGTH = 8
PAIRING_CODE_TTL_MINUTES = 15

# Role hierarchy for permission checks (higher = more privileged).
_ROLE_RANK = {ROLE_VIEWER: 0, ROLE_ADMIN: 1, ROLE_OWNER: 2}

# A device is considered online if its socket is live in this process, or it has
# checked in within this window (survives a restart / spans workers without
# Redis). Set larger than the WS heartbeat interval so a healthy streaming
# device never flickers offline between heartbeats.
ONLINE_THRESHOLD_SECONDS = 45


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_pairing_code(session: Session) -> str:
    """Generate a pairing code not currently in use by another device."""
    for _ in range(10):
        code = "".join(secrets.choice(PAIRING_CODE_ALPHABET) for _ in range(PAIRING_CODE_LENGTH))
        if session.exec(select(Device).where(Device.pairing_code == code)).first() is None:
            return code
    # Astronomically unlikely; fail loudly rather than reuse a live code.
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Could not allocate a pairing code, please retry",
    )


def _issue_pairing_code(session: Session, device: Device, request: Request) -> PairingCodeResponse:
    device.pairing_code = _generate_pairing_code(session)
    device.pairing_code_expires_at = _utcnow() + timedelta(minutes=PAIRING_CODE_TTL_MINUTES)
    session.add(device)
    session.commit()
    session.refresh(device)
    # QR payload carries the code plus the API base so a scanned device knows
    # where to complete pairing without separate configuration.
    qr_payload = json.dumps(
        {"code": device.pairing_code, "api": str(request.base_url).rstrip("/")},
        separators=(",", ":"),
    )
    return PairingCodeResponse(
        device_id=device.id,
        pairing_code=device.pairing_code,
        expires_at=device.pairing_code_expires_at,
        qr_payload=qr_payload,
    )


def _membership(session: Session, device_id: int, user_id: int) -> DeviceUser | None:
    return session.exec(
        select(DeviceUser).where(
            DeviceUser.device_id == device_id,
            DeviceUser.user_id == user_id,
        )
    ).first()


def _device_for_user(session: Session, device_id: int, user: User, min_role: str) -> tuple[Device, DeviceUser]:
    """Fetch a device the user can access at >= min_role, else 404/403.

    A non-member gets 404 (not 403) so device existence isn't leaked."""
    membership = _membership(session, device_id, user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    device = session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if _ROLE_RANK[membership.role] < _ROLE_RANK[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {min_role} role on this device",
        )
    return device, membership


def _is_online(device: Device, live: bool) -> bool:
    """Live socket in this process, else a recent heartbeat as a durable fallback."""
    if live:
        return True
    last = device.last_seen_at
    if last is None:
        return False
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return (_utcnow() - last).total_seconds() <= ONLINE_THRESHOLD_SECONDS


def _to_response(device: Device, role: str | None = None) -> DeviceResponse:
    resp = DeviceResponse.model_validate(device)
    resp.role = role
    stats = manager.device_stats(device.id)
    resp.online = _is_online(device, stats["online"])
    resp.last_frame_at = stats["last_frame_at"]
    resp.frame_rate = stats["frame_rate"]
    resp.target_count = stats["target_count"]
    resp.subscriber_count = stats["subscriber_count"]
    return resp


@router.post("/", response_model=DeviceCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    request: Request,
    data: DeviceCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    device = Device(name=data.name, device_type=data.device_type, owner_id=user.id)
    session.add(device)
    session.commit()
    session.refresh(device)

    session.add(DeviceUser(device_id=device.id, user_id=user.id, role=ROLE_OWNER))
    session.commit()

    pairing = _issue_pairing_code(session, device, request)
    return DeviceCreatedResponse(device=_to_response(device, role=ROLE_OWNER), pairing=pairing)


@router.get("/")
def list_devices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    base = (
        select(Device, DeviceUser.role)
        .join(DeviceUser, DeviceUser.device_id == Device.id)
        .where(DeviceUser.user_id == user.id)
    )
    total = session.exec(
        select(func.count()).select_from(
            select(Device.id).join(DeviceUser, DeviceUser.device_id == Device.id)
            .where(DeviceUser.user_id == user.id).subquery()
        )
    ).one()
    rows = session.exec(base.order_by(Device.created_at.desc()).offset(skip).limit(limit)).all()
    return {
        "items": [_to_response(device, role=role) for device, role in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/me", response_model=DeviceResponse)
def get_authenticated_device(device: Device = Depends(get_current_device)) -> DeviceResponse:
    """A device's view of itself, authenticated by its device token. Proves the
    token works ahead of the Phase 3 WebSocket, which authenticates the same way."""
    return _to_response(device)


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    device, membership = _device_for_user(session, device_id, user, ROLE_VIEWER)
    return _to_response(device, role=membership.role)


@router.post("/{device_id}/pairing-code", response_model=PairingCodeResponse)
def regenerate_pairing_code(
    request: Request,
    device_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Issue a fresh pairing code so a device can be (re-)provisioned. Owner or
    admin only. The existing device token stays valid until a new pair completes."""
    device, _ = _device_for_user(session, device_id, user, ROLE_ADMIN)
    return _issue_pairing_code(session, device, request)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete a device and revoke its token. Owner only."""
    device, _ = _device_for_user(session, device_id, user, ROLE_OWNER)
    # Remove dependents child-first so foreign keys hold on Postgres (SQLite in
    # tests doesn't enforce FKs, so this must be explicit, not relied-upon cascade).
    session.exec(sql_delete(RuleEvent).where(RuleEvent.device_id == device_id))
    session.exec(sql_delete(ZoneOccupancySample).where(ZoneOccupancySample.device_id == device_id))
    session.exec(sql_delete(Rule).where(Rule.device_id == device_id))
    session.exec(sql_delete(Zone).where(Zone.device_id == device_id))
    session.exec(sql_delete(DeviceUser).where(DeviceUser.device_id == device_id))
    session.delete(device)
    session.commit()
    # Drop any cached rules/runtime for a device that no longer exists.
    rule_engine.reset(device_id)


@router.post("/{device_id}/alarm")
@limiter.limit("30/minute")
async def trigger_alarm(
    request: Request,
    data: AlarmTriggerRequest,
    device_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Manually turn a device's alarm on/off. Owner/admin only (a control
    action), any subscription tier. Rule-triggered alarms go through the engine."""
    _device_for_user(session, device_id, user, ROLE_ADMIN)
    if not manager.is_device_online(device_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device is offline")
    delivered = await manager.send_to_device(
        device_id, build_alarm_command(data.state, data.duration_ms)
    )
    epoch = None
    if data.state == "on":
        epoch = manager.set_alarm_on(device_id, "manual")
    else:
        manager.set_alarm_off(device_id)
    # Reflect intent to every dashboard so the alarm banner stays in sync.
    await manager.broadcast(
        device_id,
        {"type": "alarm", "device_id": device_id, "state": data.state, "source": "manual", "delivered": delivered},
    )
    if epoch is not None:
        manager.arm_auto_off(device_id, epoch, data.duration_ms)
    return {"delivered": delivered, "state": data.state}


@router.post("/pair", response_model=DevicePairResponse)
@limiter.limit("10/minute")
def pair_device(
    request: Request,
    data: DevicePairRequest,
    session: Session = Depends(get_session),
):
    """Called by the ESP32 to claim itself with a dashboard-issued code and
    receive its device token (returned in full exactly once)."""
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired pairing code",
    )
    device = session.exec(select(Device).where(Device.pairing_code == data.pairing_code)).first()
    if device is None or device.pairing_code_expires_at is None:
        raise invalid
    expires_at = device.pairing_code_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _utcnow():
        raise invalid

    token, token_hash = generate_device_token(device.id)
    device.device_token_hash = token_hash
    device.pairing_state = PAIRING_PAIRED
    device.paired_at = _utcnow()
    device.pairing_code = None
    device.pairing_code_expires_at = None
    if data.firmware_version:
        device.firmware_version = data.firmware_version
    device.last_seen_at = _utcnow()
    session.add(device)
    session.commit()
    session.refresh(device)

    return DevicePairResponse(
        device_id=device.id,
        name=device.name,
        device_type=device.device_type,
        device_token=token,
    )
