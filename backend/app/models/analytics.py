from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ZoneOccupancySample(SQLModel, table=True):
    """A low-rate snapshot of how many targets occupied a zone at a point in
    time. Written by the rule engine at most once per zone per sample interval,
    so it stays cheap while giving analytics a presence-over-time signal. Raw
    high-rate telemetry is deliberately NOT persisted."""

    id: int | None = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    zone_id: int = Field(foreign_key="zone.id", index=True)
    occupancy: int = Field(default=0)
    sampled_at: datetime = Field(default_factory=_utcnow, index=True)
