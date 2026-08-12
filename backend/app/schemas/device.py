import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class DeviceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    device_type: str = Field(default="radar", max_length=30)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("device_type")
    @classmethod
    def validate_device_type(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9_-]+$", v):
            raise ValueError("device_type may only contain letters, numbers, hyphens, and underscores")
        return v


class DeviceResponse(BaseModel):
    """Dashboard-facing view of a device. Never exposes the token hash."""

    id: int
    name: str
    device_type: str
    pairing_state: str
    firmware_version: str | None = None
    last_seen_at: datetime | None = None
    created_at: datetime
    paired_at: datetime | None = None
    role: str | None = None  # the requesting user's role, filled per-request

    model_config = {"from_attributes": True}


class PairingCodeResponse(BaseModel):
    """Returned to the dashboard when a pairing code is minted. The QR payload
    is a compact JSON string the provisioning flow encodes into a QR image."""

    device_id: int
    pairing_code: str
    expires_at: datetime
    qr_payload: str


class DeviceCreatedResponse(BaseModel):
    device: DeviceResponse
    pairing: PairingCodeResponse


class DevicePairRequest(BaseModel):
    """Submitted by the ESP32 to claim itself using a dashboard-issued code."""

    pairing_code: str = Field(min_length=1, max_length=16)
    firmware_version: str | None = Field(default=None, max_length=40)

    @field_validator("pairing_code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        # Codes are issued uppercase from an unambiguous alphabet; accept any
        # case/whitespace the device might send and normalize.
        return v.strip().upper()


class DevicePairResponse(BaseModel):
    """The one and only time the device token is returned in full."""

    device_id: int
    name: str
    device_type: str
    device_token: str
