from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BikeTelemetry(SQLModel, table=True):
    """A single GPS/telemetry point streamed by an iotiBike tracker.

    Unlike radar (which keeps telemetry ephemeral), bike location history IS the
    product — trips, live position, geofencing all read from these points.
    Written in batches by the device over cellular; kept lean and retention-
    managed later. `recorded_at` is the device's own timestamp (naive UTC, to
    match the other datetime columns); `created_at` is server receive time."""

    id: int | None = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    lat: float
    lng: float
    speed: float | None = Field(default=None)      # km/h
    heading: float | None = Field(default=None)    # degrees, 0-359
    battery: int | None = Field(default=None)       # percent
    recorded_at: datetime = Field(default_factory=_utcnow, index=True)
    created_at: datetime = Field(default_factory=_utcnow)
