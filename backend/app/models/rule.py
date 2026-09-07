from datetime import datetime, timezone

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Trigger types evaluable from zone occupancy alone (no per-target tracking).
TRIGGER_ENTER = "enter"        # zone occupancy went 0 -> >=1
TRIGGER_EXIT = "exit"          # zone occupancy went >=1 -> 0
TRIGGER_DWELL = "dwell"        # zone continuously occupied for >= dwell_seconds
TRIGGER_OCCUPANCY = "occupancy"  # occupancy crossed up to >= occupancy_threshold
TRIGGER_TYPES = (TRIGGER_ENTER, TRIGGER_EXIT, TRIGGER_DWELL, TRIGGER_OCCUPANCY)


class Rule(SQLModel, table=True):
    """A trigger evaluated against a zone, firing one or more actions. `device_id`
    is denormalized from the zone so the rule engine can load every rule for a
    connection in a single query (evaluation happens in the hot telemetry path)."""

    id: int | None = Field(default=None, primary_key=True)
    zone_id: int = Field(foreign_key="zone.id", index=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    name: str = Field(max_length=80)
    trigger_type: str = Field(max_length=20)

    # Trigger params (only the one relevant to trigger_type is used).
    dwell_seconds: int | None = Field(default=None)
    occupancy_threshold: int | None = Field(default=None)

    # Debounce: a fired rule won't fire again until this many seconds elapse.
    cooldown_seconds: int = Field(default=60)

    # Actions.
    action_dashboard: bool = Field(default=True)
    action_email: bool = Field(default=False)
    notify_email: str | None = Field(default=None, max_length=255)

    enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class RuleEvent(SQLModel, table=True):
    """A record of a rule firing, powering the event timeline."""

    id: int | None = Field(default=None, primary_key=True)
    rule_id: int = Field(foreign_key="rule.id", index=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    zone_id: int = Field(foreign_key="zone.id")
    trigger_type: str = Field(max_length=20)
    fired_at: datetime = Field(default_factory=_utcnow, index=True)
    detail: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
