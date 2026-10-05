"""Admin management for the 3D-printing service: filaments, colors, shipping
zones, global settings, and order review. All endpoints require an admin."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.auth import get_admin_user
from app.database import get_session
from app.models.printing import (
    ORDER_NEW, ORDER_QUOTED, ORDER_PAID, ORDER_PRINTING, ORDER_SHIPPED,
    ORDER_COMPLETED, ORDER_CANCELLED,
    PrintColor, PrintFilament, PrintOrder, PrintSettings, ShippingZone,
)
from app.models.user import User
from app.schemas.printing import (
    ColorIn, FilamentIn, FilamentUpdate, OrderStatusUpdate, PrintSettingsUpdate, ZoneIn,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/print", tags=["admin-3d-printing"])

VALID_STATUSES = {
    ORDER_NEW, ORDER_QUOTED, ORDER_PAID, ORDER_PRINTING,
    ORDER_SHIPPED, ORDER_COMPLETED, ORDER_CANCELLED,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- settings ---
@router.get("/settings")
def get_settings(_: User = Depends(get_admin_user), session: Session = Depends(get_session)) -> dict:
    s = session.get(PrintSettings, 1)
    if s is None:
        s = PrintSettings(id=1)
        session.add(s)
        session.commit()
        session.refresh(s)
    return s.model_dump()


@router.put("/settings")
def update_settings(
    data: PrintSettingsUpdate,
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    s = session.get(PrintSettings, 1)
    if s is None:
        s = PrintSettings(id=1)
        session.add(s)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    s.updated_at = _utcnow()
    session.add(s)
    session.commit()
    session.refresh(s)
    return s.model_dump()


# --- filaments + colors ---
@router.get("/filaments")
def list_filaments(_: User = Depends(get_admin_user), session: Session = Depends(get_session)) -> list[dict]:
    filaments = session.exec(select(PrintFilament).order_by(PrintFilament.sort_order)).all()
    out = []
    for f in filaments:
        colors = session.exec(select(PrintColor).where(PrintColor.filament_id == f.id)).all()
        d = f.model_dump()
        d["colors"] = [c.model_dump() for c in colors]
        out.append(d)
    return out


@router.post("/filaments", status_code=status.HTTP_201_CREATED)
def create_filament(data: FilamentIn, _: User = Depends(get_admin_user), session: Session = Depends(get_session)) -> dict:
    f = PrintFilament(**data.model_dump())
    session.add(f)
    session.commit()
    session.refresh(f)
    return f.model_dump()


@router.put("/filaments/{filament_id}")
def update_filament(
    data: FilamentUpdate,
    filament_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    f = session.get(PrintFilament, filament_id)
    if f is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filament not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(f, k, v)
    session.add(f)
    session.commit()
    session.refresh(f)
    return f.model_dump()


@router.post("/filaments/{filament_id}/colors", status_code=status.HTTP_201_CREATED)
def add_color(
    data: ColorIn,
    filament_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    if session.get(PrintFilament, filament_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filament not found")
    c = PrintColor(filament_id=filament_id, **data.model_dump())
    session.add(c)
    session.commit()
    session.refresh(c)
    return c.model_dump()


@router.put("/colors/{color_id}")
def update_color(
    data: ColorIn,
    color_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    c = session.get(PrintColor, color_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c.model_dump()


@router.delete("/colors/{color_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_color(
    color_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    c = session.get(PrintColor, color_id)
    if c is None:
        return
    # Don't orphan an order's color reference — disable instead of deleting.
    referenced = session.exec(select(PrintOrder.id).where(PrintOrder.color_id == color_id)).first()
    if referenced is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This color is used by an order — disable it instead of deleting.",
        )
    session.delete(c)
    session.commit()


# --- shipping zones ---
@router.get("/zones")
def list_zones(_: User = Depends(get_admin_user), session: Session = Depends(get_session)) -> list[dict]:
    zones = session.exec(select(ShippingZone).order_by(ShippingZone.sort_order)).all()
    return [z.model_dump() for z in zones]


@router.post("/zones", status_code=status.HTTP_201_CREATED)
def create_zone(data: ZoneIn, _: User = Depends(get_admin_user), session: Session = Depends(get_session)) -> dict:
    z = ShippingZone(**data.model_dump())
    session.add(z)
    session.commit()
    session.refresh(z)
    return z.model_dump()


@router.put("/zones/{zone_id}")
def update_zone(
    data: ZoneIn,
    zone_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    z = session.get(ShippingZone, zone_id)
    if z is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    for k, v in data.model_dump().items():
        setattr(z, k, v)
    session.add(z)
    session.commit()
    session.refresh(z)
    return z.model_dump()


# --- orders ---
@router.get("/orders")
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    base = select(PrintOrder)
    count_q = select(func.count()).select_from(PrintOrder)
    if status_filter:
        base = base.where(PrintOrder.status == status_filter)
        count_q = count_q.where(PrintOrder.status == status_filter)
    total = session.exec(count_q).one()
    rows = session.exec(
        base.order_by(PrintOrder.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return {
        "items": [o.model_dump() for o in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.put("/orders/{order_id}")
def update_order_status(
    data: OrderStatusUpdate,
    order_id: int = Path(ge=1),
    _: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
) -> dict:
    o = session.get(PrintOrder, order_id)
    if o is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if data.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,  # Unprocessable Content
            detail=f"Invalid status. One of: {', '.join(sorted(VALID_STATUSES))}",
        )
    o.status = data.status
    session.add(o)
    session.commit()
    session.refresh(o)
    return o.model_dump()
