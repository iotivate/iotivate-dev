"""In-memory registry of live radar WebSocket connections.

Per device there is at most one **producer** (the ESP32) and any number of
**consumers** (browser dashboards). A telemetry frame from the producer is
fanned out to that device's consumers.

This is deliberately a thin abstraction over dicts so the fan-out can later be
backed by Redis pub/sub — needed once device connections or throughput outgrow
a single process (spec §2 "Redis-ready") — without changing call sites. The app
runs on a single asyncio event loop, so no locking is required.
"""

import asyncio
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)

# Close codes (RFC 6455). 1012 = service restart / connection superseded.
WS_SUPERSEDED = 1012

# Frame-rate is computed from recent frame arrivals within this window. A short
# window keeps the reading responsive to a device slowing down or stopping.
_RATE_WINDOW_SECONDS = 5.0
_RATE_SAMPLES = 30


@dataclass
class _DeviceStats:
    """Live, in-memory telemetry stats for one connected device. Ephemeral —
    discarded when the device disconnects; durable presence rides on the
    device's persisted `last_seen_at`."""

    target_count: int = 0
    last_frame_at: datetime | None = None
    # Monotonic tick per received frame, used only to derive the rate.
    ticks: deque = field(default_factory=lambda: deque(maxlen=_RATE_SAMPLES))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RadarConnectionManager:
    def __init__(self) -> None:
        self._devices: dict[int, WebSocket] = {}
        self._subscribers: dict[int, set[WebSocket]] = defaultdict(set)
        self._stats: dict[int, _DeviceStats] = {}
        # Server-side alarm state so it can be replayed to dashboards that join
        # after it fired, and auto-cleared when its duration elapses.
        self._alarms: dict[int, str] = {}  # device_id -> source ("rule"/"manual")
        self._alarm_epoch: dict[int, int] = {}  # guards stale auto-off timers

    async def register_device(self, device_id: int, ws: WebSocket) -> None:
        """Register the device's producer socket. A device holds one connection;
        a new one supersedes and closes any existing one."""
        existing = self._devices.get(device_id)
        if existing is not None and existing is not ws:
            try:
                await existing.close(code=WS_SUPERSEDED)
            except Exception:  # noqa: BLE001 - best-effort eviction
                pass
        self._devices[device_id] = ws

    def unregister_device(self, device_id: int, ws: WebSocket) -> bool:
        """Remove the device's socket. Returns True only if `ws` was the live
        connection — a superseded socket cleaning up returns False, so callers
        don't broadcast a spurious offline for a device that reconnected."""
        if self._devices.get(device_id) is ws:
            del self._devices[device_id]
            # Drop live stats so an offline device doesn't report a stale
            # target count or frame rate; its last_seen_at persists in the DB.
            self._stats.pop(device_id, None)
            return True
        return False

    def register_subscriber(self, device_id: int, ws: WebSocket) -> None:
        self._subscribers[device_id].add(ws)

    def unregister_subscriber(self, device_id: int, ws: WebSocket) -> None:
        subs = self._subscribers.get(device_id)
        if subs is not None:
            subs.discard(ws)
            if not subs:
                del self._subscribers[device_id]

    def is_device_online(self, device_id: int) -> bool:
        return device_id in self._devices

    def subscriber_count(self, device_id: int) -> int:
        return len(self._subscribers.get(device_id, ()))

    def record_frame(self, device_id: int, target_count: int) -> None:
        """Record a telemetry frame for live health stats (target count + rate)."""
        st = self._stats.get(device_id)
        if st is None:
            st = self._stats[device_id] = _DeviceStats()
        st.target_count = target_count
        st.last_frame_at = _utcnow()
        st.ticks.append(time.monotonic())

    def _frame_rate(self, st: _DeviceStats) -> float | None:
        """Frames per second over the recent window, or None with too few
        samples (freshly connected, or streaming slower than the window)."""
        now = time.monotonic()
        recent = [t for t in st.ticks if now - t <= _RATE_WINDOW_SECONDS]
        if len(recent) < 2:
            return None
        span = recent[-1] - recent[0]
        if span <= 0:
            return None
        return round((len(recent) - 1) / span, 1)

    def device_stats(self, device_id: int) -> dict:
        """Live health snapshot for a device. Values are None/0 when the device
        is not currently connected to this process."""
        st = self._stats.get(device_id)
        return {
            "online": self.is_device_online(device_id),
            "target_count": st.target_count if st else None,
            "last_frame_at": st.last_frame_at if st else None,
            "frame_rate": self._frame_rate(st) if st else None,
            "subscriber_count": self.subscriber_count(device_id),
        }

    async def send_to_device(self, device_id: int, message: dict) -> bool:
        """Send a command to a device's producer socket. Returns False if the
        device is offline or the socket errors (best-effort, fire-and-forget)."""
        ws = self._devices.get(device_id)
        if ws is None:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception:  # noqa: BLE001 - a dead socket means undelivered
            logger.warning("failed to send command to device %s", device_id)
            return False

    def alarm_source(self, device_id: int) -> str | None:
        """The source of a currently-active alarm, or None if not alarming."""
        return self._alarms.get(device_id)

    def set_alarm_on(self, device_id: int, source: str) -> int:
        """Mark a device's alarm active; returns an epoch that identifies this
        alarm episode (so a later auto-off can't clear a newer one)."""
        epoch = self._alarm_epoch.get(device_id, 0) + 1
        self._alarm_epoch[device_id] = epoch
        self._alarms[device_id] = source
        return epoch

    def set_alarm_off(self, device_id: int) -> None:
        self._alarm_epoch[device_id] = self._alarm_epoch.get(device_id, 0) + 1
        self._alarms.pop(device_id, None)

    def arm_auto_off(self, device_id: int, epoch: int, duration_ms: int | None) -> None:
        """Broadcast an alarm-off after duration_ms so dashboards clear in sync
        with the device's own auto-off. No-op without a positive duration."""
        if not duration_ms or duration_ms <= 0:
            return

        async def _auto_off() -> None:
            await asyncio.sleep(duration_ms / 1000)
            # Only clear if this is still the same alarm episode.
            if self._alarm_epoch.get(device_id) == epoch and device_id in self._alarms:
                self._alarms.pop(device_id, None)
                await self.broadcast(
                    device_id,
                    {"type": "alarm", "device_id": device_id, "state": "off", "source": "auto"},
                )

        asyncio.create_task(_auto_off())

    async def broadcast(self, device_id: int, message: dict) -> None:
        """Send a message to all of a device's subscribers, dropping any that
        error (already-closed sockets)."""
        dead: list[WebSocket] = []
        for ws in list(self._subscribers.get(device_id, ())):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - a dead subscriber shouldn't break fan-out
                dead.append(ws)
        for ws in dead:
            self.unregister_subscriber(device_id, ws)


# Process-wide singleton. Swap the internals for a Redis-backed implementation
# when scaling past one process; the interface stays the same.
manager = RadarConnectionManager()
