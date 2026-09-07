"""Radar WebSocket endpoints.

Two socket types, both authenticated before the handshake is accepted:

- `/ws/radar/device` — the ESP32 producer, authenticated by its device token.
- `/ws/radar/subscribe/{device_id}` — a browser dashboard consumer,
  authenticated by the user's access token + device membership.

Telemetry frames from the device are validated and fanned out to that device's
subscribers. Persistence and the dashboard UI are Phase 4; this phase is the
secure transport, auth, and connection manager.
"""

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlmodel import Session, select

from app.auth import verify_access_token, verify_device_token
from app.database import get_session
from app.models.device import DeviceUser
from app.schemas.radar import RadarFrame
from app.services.radar_manager import manager
from app.services.rule_engine import rule_engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["radar-ws"])

# How often a streaming device's last_seen_at is flushed to the DB. Throttled so
# high-rate telemetry (10-20 Hz) doesn't turn into a per-frame write storm; the
# REST online-threshold is set comfortably larger than this (see devices.py).
HEARTBEAT_INTERVAL_SECONDS = 30.0


def _extract_token(websocket: WebSocket) -> str | None:
    """Read a bearer token from the Authorization header (devices can set it) or
    a `token` query param (browsers' WebSocket API cannot set headers)."""
    auth = websocket.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return websocket.query_params.get("token")


@router.websocket("/ws/radar/device")
async def device_ws(websocket: WebSocket, session: Session = Depends(get_session)):
    token = _extract_token(websocket)
    device = None
    if token:
        try:
            device = verify_device_token(token, session)
        except HTTPException:
            device = None
    if device is None:
        # Reject before accepting the handshake (sends HTTP 403).
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    device_id = device.id
    device.last_seen_at = datetime.now(timezone.utc)
    session.add(device)
    session.commit()

    await websocket.accept()
    await manager.register_device(device_id, websocket)
    # Tell dashboards the device just came online.
    await manager.broadcast(device_id, {"type": "status", "device_id": device_id, "online": True})
    # Preload this device's zones/rules so the frame loop never hits the DB to
    # discover them; start with fresh enter/exit/dwell state for the session.
    rule_engine.reset(device_id)
    rule_engine.warm(device_id, session)
    logger.info("radar device %s connected", device_id)
    last_heartbeat = time.monotonic()
    try:
        while True:
            raw = await websocket.receive_json()
            try:
                frame = RadarFrame.model_validate(raw)
            except ValidationError:
                await websocket.send_json({"type": "error", "detail": "invalid frame"})
                continue
            manager.record_frame(device_id, len(frame.targets))
            await manager.broadcast(device_id, {"device_id": device_id, **frame.model_dump()})
            # Evaluate zones/rules against this frame. Isolated so a rule bug can
            # never break the telemetry stream.
            try:
                await rule_engine.evaluate(device_id, frame, session)
            except Exception:  # noqa: BLE001 - never let rule eval kill fan-out
                logger.exception("rule evaluation failed for device %s", device_id)
            # Throttled heartbeat so last_seen_at stays fresh across a long
            # session without a DB write per frame.
            now = time.monotonic()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL_SECONDS:
                device.last_seen_at = datetime.now(timezone.utc)
                session.add(device)
                session.commit()
                last_heartbeat = now
    except WebSocketDisconnect:
        pass
    finally:
        # Only announce offline if this was the live socket (not a superseded one).
        if manager.unregister_device(device_id, websocket):
            await manager.broadcast(device_id, {"type": "status", "device_id": device_id, "online": False})
            rule_engine.reset(device_id)
        logger.info("radar device %s disconnected", device_id)


@router.websocket("/ws/radar/subscribe/{device_id}")
async def subscribe_ws(
    websocket: WebSocket,
    device_id: int,
    session: Session = Depends(get_session),
):
    token = _extract_token(websocket)
    user = None
    if token:
        try:
            user = verify_access_token(token, session)
        except HTTPException:
            user = None
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    membership = session.exec(
        select(DeviceUser).where(
            DeviceUser.device_id == device_id,
            DeviceUser.user_id == user.id,
        )
    ).first()
    if membership is None:
        # 404-equivalent, but WebSocket handshakes only carry a close code.
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    manager.register_subscriber(device_id, websocket)
    await websocket.send_json(
        {"type": "status", "device_id": device_id, "online": manager.is_device_online(device_id)}
    )
    try:
        # Consumers don't send commands yet; drain to detect disconnect.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister_subscriber(device_id, websocket)
