"""Radar analytics & history.

Aggregates the persisted rule-event log and low-rate zone-occupancy samples into
summaries the dashboard charts. Reads are open to any device member (data only
exists on devices where a Pro user created zones/rules). Raw telemetry is not
stored, so nothing here reconstructs exact tracks — it reports events and
presence-over-time.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import func
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.api.devices import _device_for_user
from app.models.analytics import ZoneOccupancySample
from app.models.device import ROLE_VIEWER
from app.models.rule import RuleEvent
from app.models.user import User
from app.models.zone import Zone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["radar-analytics"])

# Cap fetched rows so a long window can't pull an unbounded set into memory.
_MAX_ROWS = 20_000


def _naive_cutoff(hours: int) -> datetime:
    """UTC cutoff as a naive datetime, matching how timestamps are stored
    (columns are naive DateTime); avoids aware/naive comparison pitfalls."""
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours)


def _zone_names(session: Session, device_id: int) -> dict[int, str]:
    return {z.id: z.name for z in session.exec(select(Zone).where(Zone.device_id == device_id)).all()}


@router.get("/devices/{device_id}/analytics/summary")
def analytics_summary(
    device_id: int = Path(ge=1),
    window_hours: int = Query(168, ge=1, le=8760),  # default 7 days, max 1 year
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    cutoff = _naive_cutoff(window_hours)
    # True total via COUNT so the headline number is accurate even when the
    # aggregated breakdowns below are computed from a capped fetch.
    total_events = session.exec(
        select(func.count()).select_from(
            select(RuleEvent.id)
            .where(RuleEvent.device_id == device_id, RuleEvent.fired_at >= cutoff)
            .subquery()
        )
    ).one()
    events = session.exec(
        select(RuleEvent)
        .where(RuleEvent.device_id == device_id, RuleEvent.fired_at >= cutoff)
        .order_by(RuleEvent.fired_at.desc())
        .limit(_MAX_ROWS)
    ).all()

    by_trigger: dict[str, int] = {}
    by_zone: dict[int, int] = {}
    daily: dict[str, int] = {}
    for e in events:
        by_trigger[e.trigger_type] = by_trigger.get(e.trigger_type, 0) + 1
        by_zone[e.zone_id] = by_zone.get(e.zone_id, 0) + 1
        day = e.fired_at.date().isoformat()
        daily[day] = daily.get(day, 0) + 1

    names = _zone_names(session, device_id)
    return {
        "window_hours": window_hours,
        "total_events": total_events,
        # True if the breakdowns below are computed from a capped subset.
        "breakdown_truncated": total_events > len(events),
        "by_trigger": by_trigger,
        "by_zone": [
            {"zone_id": zid, "name": names.get(zid, f"Zone {zid}"), "count": c}
            for zid, c in sorted(by_zone.items(), key=lambda kv: -kv[1])
        ],
        "daily": [{"date": d, "count": daily[d]} for d in sorted(daily)],
    }


@router.get("/devices/{device_id}/analytics/occupancy")
def analytics_occupancy(
    device_id: int = Path(ge=1),
    window_hours: int = Query(24, ge=1, le=720),  # default 1 day, max 30 days
    zone_id: int | None = Query(None, ge=1),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _device_for_user(session, device_id, user, ROLE_VIEWER)
    cutoff = _naive_cutoff(window_hours)
    query = select(ZoneOccupancySample).where(
        ZoneOccupancySample.device_id == device_id,
        ZoneOccupancySample.sampled_at >= cutoff,
    )
    if zone_id is not None:
        query = query.where(ZoneOccupancySample.zone_id == zone_id)
    samples = session.exec(
        query.order_by(ZoneOccupancySample.sampled_at).limit(_MAX_ROWS)
    ).all()

    # Bucket to the hour per zone: average and peak occupancy.
    buckets: dict[tuple[int, str], dict] = {}
    for s in samples:
        hour = s.sampled_at.replace(minute=0, second=0, microsecond=0).isoformat()
        b = buckets.setdefault((s.zone_id, hour), {"sum": 0, "n": 0, "max": 0})
        b["sum"] += s.occupancy
        b["n"] += 1
        b["max"] = max(b["max"], s.occupancy)

    series: dict[int, list] = {}
    for (zid, hour), b in buckets.items():
        series.setdefault(zid, []).append(
            {"hour": hour, "avg": round(b["sum"] / b["n"], 2), "max": b["max"]}
        )
    for zid in series:
        series[zid].sort(key=lambda p: p["hour"])

    names = _zone_names(session, device_id)
    return {
        "window_hours": window_hours,
        "zones": [
            {"zone_id": zid, "name": names.get(zid, f"Zone {zid}"), "points": pts}
            for zid, pts in series.items()
        ],
    }
