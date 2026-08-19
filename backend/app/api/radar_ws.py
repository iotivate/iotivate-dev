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
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlmodel import Session, select

from app.auth import verify_access_token, verify_device_token
from app.database import get_session
from app.models.device import DeviceUser
from app.schemas.radar import RadarFrame
from app.services.radar_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["radar-ws"])


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
    logger.info("radar device %s connected", device_id)
    try:
        while True:
            raw = await websocket.receive_json()
            try:
                frame = RadarFrame.model_validate(raw)
            except ValidationError:
                await websocket.send_json({"type": "error", "detail": "invalid frame"})
                continue
            await manager.broadcast(device_id, {"device_id": device_id, **frame.model_dump()})
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister_device(device_id, websocket)
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
