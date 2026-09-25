"""iotiBike telemetry ingest + track read.

Devices (ESP32 + cellular) POST batched GPS points to
`device.iotivate.dev/api/bike/telemetry`, authenticated by their device token
(Authorization: Bearer <did_...>). Store-and-forward friendly: batches, bounded
size, device-supplied timestamps. The app reads a device's recent track for the
dashboard/map.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Path, Query, status
from sqlmodel import Session, select

from app.auth import get_current_device, get_current_user
from app.database import get_session
from app.api.devices import _device_for_user
from app.models.bike import BikeTelemetry
from app.models.device import Device, ROLE_VIEWER
from app.models.user import User
from app.schemas.bike import BikeTelemetryBatch, BikeTrackPoint

logger = logging.getLogger(__name__)

router = APIRouter(tags=["iotibike"])


def _to_naive_utc(dt: datetime) -> datetime:
    """Store timestamps as naive UTC to match the other datetime columns."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.post("/bike/telemetry", status_code=status.HTTP_201_CREATED)
def ingest_telemetry(
    data: BikeTelemetryBatch,
    device: Device = Depends(get_current_device),
    session: Session = Depends(get_session),
) -> dict:
    """Accept a batch of telemetry points from an authenticated device."""
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    rows = [
        BikeTelemetry(
            device_id=device.id,
            lat=p.lat,
            lng=p.lng,
            speed=p.speed,
            heading=p.heading,
            battery=p.battery,
            recorded_at=_to_naive_utc(p.ts) if p.ts else now_naive,
        )
        for p in data.points
    ]
    session.add_all(rows)
    device.last_seen_at = datetime.now(timezone.utc)
    session.add(device)
    session.commit()
    return {"accepted": len(rows)}


@router.get("/devices/{device_id}/track")
def get_track(
    device_id: int = Path(ge=1),
    limit: int = Query(200, ge=1, le=1000),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Recent track for a device (most-recent-`limit`, returned chronologically).
    Open to any device member."""
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    rows = session.exec(
        select(BikeTelemetry)
        .where(BikeTelemetry.device_id == device_id)
        .order_by(BikeTelemetry.recorded_at.desc())
        .limit(limit)
    ).all()
    rows = list(reversed(rows))  # chronological for map/route drawing
    return {
        "device_id": device_id,
        "count": len(rows),
        "items": [BikeTrackPoint.model_validate(r) for r in rows],
    }
