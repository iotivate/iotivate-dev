from typing import Literal

from pydantic import BaseModel, Field


class RadarTarget(BaseModel):
    """A single tracked target in the device's coordinate space (metres)."""

    x: float
    y: float
    velocity: float | None = None
    strength: float | None = None

    model_config = {"extra": "forbid"}


class RadarFrame(BaseModel):
    """One telemetry frame streamed by the ESP32 over its WebSocket.

    Kept minimal for Phase 3 (secure transport + fan-out); the richer radar
    payload and persistence land in Phase 4. `targets` is bounded so a
    malformed or hostile device can't push an unbounded payload."""

    type: Literal["telemetry"] = "telemetry"
    seq: int | None = Field(default=None, ge=0)
    targets: list[RadarTarget] = Field(default_factory=list, max_length=64)

    model_config = {"extra": "forbid"}
