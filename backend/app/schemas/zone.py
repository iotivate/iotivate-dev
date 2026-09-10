from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ZonePoint(BaseModel):
    """A vertex in the device coordinate space (metres)."""

    x: float
    y: float

    model_config = {"extra": "forbid"}


def _validate_points(points: list[ZonePoint]) -> list[ZonePoint]:
    if len(points) < 3:
        raise ValueError("A zone needs at least 3 points")
    if len(points) > 64:
        raise ValueError("A zone may have at most 64 points")
    return points


class ZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    points: list[ZonePoint]

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("points")
    @classmethod
    def check_points(cls, v: list[ZonePoint]) -> list[ZonePoint]:
        return _validate_points(v)


class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    points: list[ZonePoint] | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("points")
    @classmethod
    def check_points(cls, v: list[ZonePoint] | None) -> list[ZonePoint] | None:
        return None if v is None else _validate_points(v)


class ZoneResponse(BaseModel):
    id: int
    device_id: int
    name: str
    points: list[ZonePoint]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
