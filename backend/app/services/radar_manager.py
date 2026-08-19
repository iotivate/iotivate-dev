"""In-memory registry of live radar WebSocket connections.

Per device there is at most one **producer** (the ESP32) and any number of
**consumers** (browser dashboards). A telemetry frame from the producer is
fanned out to that device's consumers.

This is deliberately a thin abstraction over dicts so the fan-out can later be
backed by Redis pub/sub — needed once device connections or throughput outgrow
a single process (spec §2 "Redis-ready") — without changing call sites. The app
runs on a single asyncio event loop, so no locking is required.
"""

import logging
from collections import defaultdict

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)

# Close codes (RFC 6455). 1012 = service restart / connection superseded.
WS_SUPERSEDED = 1012


class RadarConnectionManager:
    def __init__(self) -> None:
        self._devices: dict[int, WebSocket] = {}
        self._subscribers: dict[int, set[WebSocket]] = defaultdict(set)

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

    def unregister_device(self, device_id: int, ws: WebSocket) -> None:
        # Guard against a superseded socket unregistering the live one.
        if self._devices.get(device_id) is ws:
            del self._devices[device_id]

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
