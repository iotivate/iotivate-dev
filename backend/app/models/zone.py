from datetime import datetime, timezone

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Zone(SQLModel, table=True):
    """A polygon drawn on a device's coordinate space (metres). A rectangle is
    stored as its four corner points, so the schema needs no change to support
    freeform polygons later. Rules reference a zone to evaluate telemetry."""

    id: int | None = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    name: str = Field(max_length=80)
    # Ordered vertices, each {"x": float, "y": float} in metres.
    points: list[dict] = Field(sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
