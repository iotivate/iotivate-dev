import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func
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


def _to_response(device: Device, role: str | None = None) -> DeviceResponse:
    resp = DeviceResponse.model_validate(device)
    resp.role = role
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
    for du in session.exec(select(DeviceUser).where(DeviceUser.device_id == device_id)).all():
        session.delete(du)
    session.delete(device)
    session.commit()


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
