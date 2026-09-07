from typing import Literal

from pydantic import BaseModel, Field

# Upper bound on a device-side auto-off timer (1 hour). Keeps a stuck/hostile
# request from asking the device to hold an alarm indefinitely.
MAX_ALARM_DURATION_MS = 3_600_000


class AlarmTriggerRequest(BaseModel):
    """Manual alarm control from the dashboard."""

    state: Literal["on", "off"]
    # Optional device-side auto-off. The device turns the alarm off after this
    # many ms even if it misses an explicit "off" command.
    duration_ms: int | None = Field(default=None, ge=0, le=MAX_ALARM_DURATION_MS)

    model_config = {"extra": "forbid"}


def build_alarm_command(state: str, duration_ms: int | None = None) -> dict:
    """The command frame sent down a device's WebSocket. The ESP32 firmware acts
    on this (drives a buzzer/relay); the backend only guarantees delivery."""
    cmd: dict = {"type": "command", "command": "alarm", "state": state}
    if duration_ms is not None:
        cmd["duration_ms"] = duration_ms
    return cmd
