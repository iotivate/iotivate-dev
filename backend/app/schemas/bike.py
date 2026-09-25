from datetime import datetime

from pydantic import BaseModel, Field


class BikePoint(BaseModel):
    """One telemetry sample from a tracker. `ts` is the device's timestamp; the
    server falls back to receive time if omitted."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    speed: float | None = Field(default=None, ge=0, le=400)   # km/h
    heading: float | None = Field(default=None, ge=0, lt=360)  # degrees
    battery: int | None = Field(default=None, ge=0, le=100)    # percent
    ts: datetime | None = None

    model_config = {"extra": "forbid"}


class BikeTelemetryBatch(BaseModel):
    """A batch of points uploaded by a device over cellular (store-and-forward).
    Bounded so a malformed or hostile device can't push an unbounded payload."""

    seq: int | None = Field(default=None, ge=0)
    points: list[BikePoint] = Field(min_length=1, max_length=500)

    model_config = {"extra": "forbid"}


class BikeTrackPoint(BaseModel):
    lat: float
    lng: float
    speed: float | None = None
    heading: float | None = None
    battery: int | None = None
    recorded_at: datetime

    model_config = {"from_attributes": True}
