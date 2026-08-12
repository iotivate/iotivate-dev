from datetime import datetime, timezone

from sqlmodel import SQLModel, Field, UniqueConstraint


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Pairing lifecycle states for a device.
PAIRING_UNPAIRED = "unpaired"
PAIRING_PAIRED = "paired"

# DeviceUser roles, most→least privileged. `owner` may delete/transfer;
# `admin` may manage pairing and shared users; `viewer` is read-only.
ROLE_OWNER = "owner"
ROLE_ADMIN = "admin"
ROLE_VIEWER = "viewer"
ROLES = (ROLE_OWNER, ROLE_ADMIN, ROLE_VIEWER)


class Device(SQLModel, table=True):
    """A physical device (radar now, extensible via device_type) registered to
    an IoTivate account. Lives in the shared platform layer so future products
    can reuse it. Ownership/access is governed by DeviceUser rows; owner_id is
    a denormalized pointer to the claiming user for cheap common-case queries.
    """

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=80)
    device_type: str = Field(default="radar", max_length=30)
    owner_id: int = Field(foreign_key="user.id", index=True)

    pairing_state: str = Field(default=PAIRING_UNPAIRED, max_length=20)

    # Short-lived claim code shown in the dashboard; the device submits it to
    # POST /devices/pair to claim itself. Cleared once paired.
    pairing_code: str | None = Field(default=None, index=True, max_length=16)
    pairing_code_expires_at: datetime | None = Field(default=None)

    # SHA-256 hex of the device-token secret (never the token itself). The
    # token is only ever returned once, at pairing time.
    device_token_hash: str | None = Field(default=None, max_length=64)

    # Health fields — populated later over the device WebSocket (Phase 3+).
    firmware_version: str | None = Field(default=None, max_length=40)
    last_seen_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=_utcnow)
    paired_at: datetime | None = Field(default=None)


class DeviceUser(SQLModel, table=True):
    """Many-to-many join between users and devices, carrying a role. Source of
    truth for who may see or manage a device. An org_id can slot in here later
    without touching Device."""

    __table_args__ = (UniqueConstraint("device_id", "user_id", name="uq_deviceuser_device_user"),)

    id: int | None = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: str = Field(default=ROLE_VIEWER, max_length=20)
    created_at: datetime = Field(default_factory=_utcnow)
