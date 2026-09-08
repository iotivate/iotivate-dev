"""Zones & rules evaluation for radar telemetry.

Runs synchronously in the device WebSocket's frame loop (radar_ws.py), so it is
built to be cheap and never to disrupt the telemetry stream:

- Rules for a device are **cached in memory per connection** and reloaded only
  when a REST mutation bumps the device's version — never queried per frame.
- Point-in-polygon over <=64 targets x a few zones is trivial arithmetic.
- Rule firing is **debounced** by a per-rule cooldown.
- Email is dispatched **off the event loop** so SMTP latency can't stall frames.

The caller wraps evaluate() in try/except; a rule bug must not kill fan-out.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.models.rule import (
    Rule,
    RuleEvent,
    TRIGGER_DWELL,
    TRIGGER_ENTER,
    TRIGGER_EXIT,
    TRIGGER_OCCUPANCY,
)
from app.models.analytics import ZoneOccupancySample
from app.models.zone import Zone
from app.schemas.alarm import build_alarm_command
from app.services.email import send_email
from app.services.radar_manager import manager

logger = logging.getLogger(__name__)

# How often each zone's occupancy is persisted for analytics. Low rate keeps
# write volume trivial while still charting presence over time.
SAMPLE_INTERVAL_SECONDS = 60.0


def point_in_polygon(x: float, y: float, points: list[dict]) -> bool:
    """Ray-casting test. `points` is an ordered list of {"x":..,"y":..}."""
    n = len(points)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = points[i]["x"], points[i]["y"]
        xj, yj = points[j]["x"], points[j]["y"]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


@dataclass
class _RuleRuntime:
    """Per-rule state carried between frames within a device session."""

    occupied: bool = False          # zone occupied on the previous frame (enter/exit)
    last_count: int = 0             # previous occupancy count (occupancy threshold crossing)
    occupied_since: float | None = None  # monotonic time the zone became occupied (dwell)
    dwell_fired: bool = False       # dwell already fired for the current occupancy episode
    last_fired: float = -1e9        # monotonic time of last fire (cooldown)


@dataclass
class _DeviceRules:
    version: int
    zones: dict[int, list]  # zone_id -> points
    rules: list[Rule]
    runtime: dict[int, _RuleRuntime] = field(default_factory=dict)
    # zone_id -> monotonic time of the last persisted occupancy sample.
    sample_ticks: dict[int, float] = field(default_factory=dict)


class RuleEngine:
    def __init__(self) -> None:
        self._cache: dict[int, _DeviceRules] = {}
        # Bumped by REST mutations; evaluate() reloads when its cache lags.
        self._version: dict[int, int] = {}

    def invalidate(self, device_id: int) -> None:
        """Signal that a device's zones/rules changed; the next evaluate reloads."""
        self._version[device_id] = self._version.get(device_id, 0) + 1

    def reset(self, device_id: int) -> None:
        """Drop cached rules and runtime state (called when a device disconnects,
        so a new session starts with clean enter/exit/dwell state)."""
        self._cache.pop(device_id, None)

    def _load(self, device_id: int, session: Session) -> _DeviceRules:
        zones = session.exec(select(Zone).where(Zone.device_id == device_id)).all()
        zmap = {z.id: (z.points or []) for z in zones}
        rules = session.exec(
            select(Rule).where(Rule.device_id == device_id, Rule.enabled == True)  # noqa: E712
        ).all()
        # Preserve runtime for rules that still exist across a reload.
        old = self._cache.get(device_id)
        runtime: dict[int, _RuleRuntime] = {}
        for r in rules:
            runtime[r.id] = (old.runtime.get(r.id) if old else None) or _RuleRuntime()
        dr = _DeviceRules(
            version=self._version.get(device_id, 0),
            zones=zmap,
            rules=rules,
            runtime=runtime,
        )
        self._cache[device_id] = dr
        return dr

    def warm(self, device_id: int, session: Session) -> None:
        """Preload a device's rules when its socket connects."""
        self._load(device_id, session)

    async def evaluate(self, device_id: int, frame, session: Session) -> None:
        dr = self._cache.get(device_id)
        if dr is None or dr.version != self._version.get(device_id, 0):
            dr = self._load(device_id, session)
        if not dr.zones:
            return

        now = time.monotonic()
        # Occupancy per zone for this frame — used for both rules and sampling.
        counts: dict[int, int] = {}
        for zid, pts in dr.zones.items():
            counts[zid] = sum(1 for t in frame.targets if point_in_polygon(t.x, t.y, pts))

        # Persist a low-rate occupancy sample for analytics (skipped in unit
        # tests that pass no session).
        if session is not None:
            self._sample_occupancy(dr, device_id, counts, now, session)

        for rule in dr.rules:
            rt = dr.runtime[rule.id]
            count = counts.get(rule.zone_id, 0)
            occupied = count > 0
            fired = False

            if rule.trigger_type == TRIGGER_ENTER:
                fired = occupied and not rt.occupied
            elif rule.trigger_type == TRIGGER_EXIT:
                fired = (not occupied) and rt.occupied
            elif rule.trigger_type == TRIGGER_OCCUPANCY:
                thr = rule.occupancy_threshold or 1
                fired = count >= thr and rt.last_count < thr
            elif rule.trigger_type == TRIGGER_DWELL:
                if occupied:
                    if rt.occupied_since is None:
                        rt.occupied_since = now
                    if not rt.dwell_fired and (now - rt.occupied_since) >= (rule.dwell_seconds or 0):
                        fired = True
                        rt.dwell_fired = True
                else:
                    rt.occupied_since = None
                    rt.dwell_fired = False

            if fired and (now - rt.last_fired) >= rule.cooldown_seconds:
                rt.last_fired = now
                await self._fire(rule, device_id, {"occupancy": count}, session)

            rt.occupied = occupied
            rt.last_count = count

    def _sample_occupancy(
        self, dr: _DeviceRules, device_id: int, counts: dict[int, int], now: float, session: Session
    ) -> None:
        wrote = False
        for zid, cnt in counts.items():
            if now - dr.sample_ticks.get(zid, -1e9) >= SAMPLE_INTERVAL_SECONDS:
                dr.sample_ticks[zid] = now
                session.add(ZoneOccupancySample(device_id=device_id, zone_id=zid, occupancy=cnt))
                wrote = True
        if wrote:
            session.commit()

    async def _fire(self, rule: Rule, device_id: int, detail: dict, session: Session) -> None:
        event = RuleEvent(
            rule_id=rule.id,
            device_id=device_id,
            zone_id=rule.zone_id,
            trigger_type=rule.trigger_type,
            detail=detail,
        )
        session.add(event)
        session.commit()
        session.refresh(event)
        logger.info("rule %s fired for device %s (%s)", rule.id, device_id, rule.trigger_type)

        if rule.action_dashboard:
            await manager.broadcast(
                device_id,
                {
                    "type": "rule_fired",
                    "device_id": device_id,
                    "rule_id": rule.id,
                    "zone_id": rule.zone_id,
                    "rule_name": rule.name,
                    "trigger_type": rule.trigger_type,
                    "detail": detail,
                    "fired_at": event.fired_at.isoformat(),
                },
            )

        if rule.action_email and rule.notify_email:
            self._dispatch_email(rule, detail)

        if rule.action_alarm:
            delivered = await manager.send_to_device(
                device_id, build_alarm_command("on", rule.alarm_duration_ms)
            )
            epoch = manager.set_alarm_on(device_id, "rule")
            await manager.broadcast(
                device_id,
                {
                    "type": "alarm",
                    "device_id": device_id,
                    "state": "on",
                    "source": "rule",
                    "rule_id": rule.id,
                    "delivered": delivered,
                },
            )
            # Clear the dashboard alarm when the device's own auto-off elapses.
            manager.arm_auto_off(device_id, epoch, rule.alarm_duration_ms)

    def _dispatch_email(self, rule: Rule, detail: dict) -> None:
        """Send the alert email without blocking the frame loop. send_email uses
        smtplib (blocking) and degrades gracefully if SMTP is unconfigured."""
        subject = f"Radar alert: {rule.name}"
        body = (
            f"Rule '{rule.name}' ({rule.trigger_type}) fired.\n"
            f"Zone occupancy: {detail.get('occupancy')}\n"
        )
        to_email = rule.notify_email
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, send_email, subject, body, to_email)


# Process-wide singleton, mirroring radar_manager.
rule_engine = RuleEngine()
