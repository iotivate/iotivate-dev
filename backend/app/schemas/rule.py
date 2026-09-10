from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.rule import (
    TRIGGER_DWELL,
    TRIGGER_OCCUPANCY,
    TRIGGER_TYPES,
)


def validate_rule_config(
    trigger_type: str,
    dwell_seconds: int | None,
    occupancy_threshold: int | None,
    action_email: bool,
    notify_email: str | None,
) -> None:
    """Cross-field validity for a rule. Raises ValueError so it doubles as a
    Pydantic validator and a reusable check for partial updates."""
    if trigger_type not in TRIGGER_TYPES:
        raise ValueError(f"trigger_type must be one of {', '.join(TRIGGER_TYPES)}")
    if trigger_type == TRIGGER_DWELL and (dwell_seconds is None or dwell_seconds <= 0):
        raise ValueError("dwell_seconds must be a positive integer for a dwell rule")
    if trigger_type == TRIGGER_OCCUPANCY and (occupancy_threshold is None or occupancy_threshold < 1):
        raise ValueError("occupancy_threshold must be >= 1 for an occupancy rule")
    if action_email and not notify_email:
        raise ValueError("notify_email is required when the email action is enabled")


class RuleCreate(BaseModel):
    zone_id: int
    name: str = Field(min_length=1, max_length=80)
    trigger_type: str
    dwell_seconds: int | None = Field(default=None, ge=1)
    occupancy_threshold: int | None = Field(default=None, ge=1)
    cooldown_seconds: int = Field(default=60, ge=0, le=86_400)
    action_dashboard: bool = True
    action_email: bool = False
    notify_email: EmailStr | None = None
    action_alarm: bool = False
    alarm_duration_ms: int | None = Field(default=None, ge=0, le=3_600_000)
    enabled: bool = True

    @model_validator(mode="after")
    def check_config(self) -> "RuleCreate":
        validate_rule_config(
            self.trigger_type,
            self.dwell_seconds,
            self.occupancy_threshold,
            self.action_email,
            self.notify_email,
        )
        return self


class RuleUpdate(BaseModel):
    """Partial update. Field-level bounds are enforced here; cross-field
    consistency is re-checked against the merged rule in the endpoint."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    trigger_type: str | None = None
    dwell_seconds: int | None = Field(default=None, ge=1)
    occupancy_threshold: int | None = Field(default=None, ge=1)
    cooldown_seconds: int | None = Field(default=None, ge=0, le=86_400)
    action_dashboard: bool | None = None
    action_email: bool | None = None
    notify_email: EmailStr | None = None
    action_alarm: bool | None = None
    alarm_duration_ms: int | None = Field(default=None, ge=0, le=3_600_000)
    enabled: bool | None = None


class RuleResponse(BaseModel):
    id: int
    zone_id: int
    device_id: int
    name: str
    trigger_type: str
    dwell_seconds: int | None = None
    occupancy_threshold: int | None = None
    cooldown_seconds: int
    action_dashboard: bool
    action_email: bool
    notify_email: str | None = None
    action_alarm: bool
    alarm_duration_ms: int | None = None
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RuleEventResponse(BaseModel):
    id: int
    rule_id: int
    device_id: int
    zone_id: int
    trigger_type: str
    fired_at: datetime
    detail: dict | None = None

    model_config = {"from_attributes": True}
