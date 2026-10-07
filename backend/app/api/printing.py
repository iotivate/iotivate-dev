"""Public 3D-printing service API: catalog/config, authoritative quote, STL
upload, and order submission. Delivery-only. Upload happens only on submit (the
live estimate is computed client-side), so R2 doesn't fill with tire-kicker files.
"""

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.api.upload import get_r2_client
from app.config import settings
from app.database import get_session
from app.models.printing import (
    ORDER_NEW,
    SOURCE_UPLOAD,
    PrintColor,
    PrintFilament,
    PrintOrder,
    PrintSettings,
    ShippingZone,
)
from app.schemas.printing import (
    ColorOut,
    ConfigOut,
    FilamentOut,
    OrderCreate,
    OrderCreatedOut,
    QuoteIn,
    QuoteOut,
    ShippingZoneOut,
    StlUploadOut,
)
from app.services.email import send_email
from app.services.print_quote import compute_quote

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/print", tags=["3d-printing"])

ALLOWED_STL_EXT = {".stl", ".obj", ".3mf"}
# Absolute ceiling regardless of the admin setting — protects the single-worker
# backend's memory and stays under a possible Cloudflare 100MB proxy limit.
HARD_MAX_UPLOAD_MB = 100


def _get_settings(session: Session) -> PrintSettings:
    s = session.get(PrintSettings, 1)
    if s is None:  # not seeded yet — fall back to defaults
        s = PrintSettings(id=1)
    return s


def _effective_upload_mb(s: PrintSettings) -> int:
    return max(1, min(s.max_upload_mb, HARD_MAX_UPLOAD_MB))


def _fits_build_volume(dims: tuple[float | None, float | None, float | None], s: PrintSettings) -> bool:
    """True if unknown dims or the bounding box fits the bed in some axis-aligned
    orientation (compare sorted dims to sorted bed)."""
    if any(d is None for d in dims):
        return True
    model = sorted(float(d) for d in dims)  # type: ignore[arg-type]
    bed = sorted([s.max_x_mm, s.max_y_mm, s.max_z_mm])
    return all(m <= b for m, b in zip(model, bed))


@router.get("/config", response_model=ConfigOut)
def get_config(session: Session = Depends(get_session)):
    s = _get_settings(session)
    filaments = session.exec(
        select(PrintFilament).where(PrintFilament.enabled == True).order_by(PrintFilament.sort_order)  # noqa: E712
    ).all()
    out_filaments: list[FilamentOut] = []
    for f in filaments:
        colors = session.exec(
            select(PrintColor).where(PrintColor.filament_id == f.id, PrintColor.enabled == True)  # noqa: E712
        ).all()
        out_filaments.append(
            FilamentOut(
                id=f.id, type=f.type, name=f.name,
                density_g_cm3=f.density_g_cm3, rate_per_gram=f.rate_per_gram,
                colors=[ColorOut.model_validate(c) for c in colors],
            )
        )
    zones = session.exec(
        select(ShippingZone).where(ShippingZone.enabled == True).order_by(ShippingZone.sort_order)  # noqa: E712
    ).all()
    return ConfigOut(
        service_open=s.service_open,
        design_enabled=s.design_enabled,
        currency=s.currency,
        setup_fee=s.setup_fee,
        min_order=s.min_order,
        wall_thickness_mm=s.wall_thickness_mm,
        infill_percent=s.infill_percent,
        max_upload_mb=_effective_upload_mb(s),
        max_x_mm=s.max_x_mm, max_y_mm=s.max_y_mm, max_z_mm=s.max_z_mm,
        lead_time_text=s.lead_time_text,
        estimate_disclaimer=s.estimate_disclaimer,
        filaments=out_filaments,
        shipping_zones=[ShippingZoneOut.model_validate(z) for z in zones],
    )


@router.post("/quote", response_model=QuoteOut)
def quote(data: QuoteIn, session: Session = Depends(get_session)):
    s = _get_settings(session)
    filament = session.get(PrintFilament, data.filament_id)
    if filament is None or not filament.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown filament")

    shipping_cost = 0.0
    if data.shipping_zone_id is not None:
        zone = session.get(ShippingZone, data.shipping_zone_id)
        if zone is not None and zone.enabled:
            shipping_cost = zone.flat_rate

    q = compute_quote(
        volume_cm3=data.volume_cm3,
        surface_cm2=data.surface_cm2,
        density_g_cm3=filament.density_g_cm3,
        rate_per_gram=filament.rate_per_gram,
        wall_thickness_mm=s.wall_thickness_mm,
        infill_percent=s.infill_percent,
        quantity=data.quantity,
        setup_fee=s.setup_fee,
        min_order=s.min_order,
        shipping_cost=shipping_cost,
    )
    return QuoteOut(
        weight_g=q.weight_g, unit_price=q.unit_price, items_subtotal=q.items_subtotal,
        shipping_cost=q.shipping_cost, total=q.total, min_applied=q.min_applied,
        exceeds_build_volume=not _fits_build_volume((data.dim_x_mm, data.dim_y_mm, data.dim_z_mm), s),
        currency=s.currency,
    )


@router.post("/stl", response_model=StlUploadOut)
@limiter.limit("20/hour")
async def upload_stl(
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Public STL upload (on order submit). Rate-limited + size-capped to curb
    abuse; files land under print-uploads/ so an R2 lifecycle rule can expire them."""
    if not settings.r2_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Uploads unavailable")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_STL_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Use: {', '.join(sorted(ALLOWED_STL_EXT))}",
        )
    max_mb = _effective_upload_mb(_get_settings(session))
    content = await file.read()
    if len(content) > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {max_mb} MB)",
        )
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    safe = os.path.basename(file.filename or "model").replace(" ", "_")
    name, _ = os.path.splitext(safe)
    object_key = f"print-uploads/{name}-{uuid.uuid4().hex[:8]}{ext}"
    try:
        client = get_r2_client()
        client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=object_key,
            Body=content,
            ContentType=file.content_type or "application/octet-stream",
        )
    except Exception:  # noqa: BLE001
        logger.exception("STL upload to R2 failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Upload failed, please retry")

    if settings.r2_public_url:
        url = f"{settings.r2_public_url.rstrip('/')}/{object_key}"
    else:
        url = f"https://{settings.r2_bucket_name}.{settings.r2_account_id}.r2.dev/{object_key}"
    return StlUploadOut(url=url, filename=os.path.basename(object_key), size=len(content))


@router.post("/orders", response_model=OrderCreatedOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def create_order(request: Request, data: OrderCreate, session: Session = Depends(get_session)):
    s = _get_settings(session)
    if not s.service_open:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="We're not taking new orders right now — please check back soon.",
        )

    order = PrintOrder(
        status=ORDER_NEW,
        source=data.source,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        stl_url=data.stl_url,
        filament_id=data.filament_id,
        color_id=data.color_id,
        quantity=data.quantity,
        volume_cm3=data.volume_cm3,
        surface_cm2=data.surface_cm2,
        dim_x_mm=data.dim_x_mm, dim_y_mm=data.dim_y_mm, dim_z_mm=data.dim_z_mm,
        design_brief=data.design_brief,
        reference_url=data.reference_url,
        shipping_zone_id=data.shipping_zone_id,
        shipping_address=data.shipping_address,
        notes=data.notes,
    )

    # Shipping (flat by zone).
    if data.shipping_zone_id is not None:
        zone = session.get(ShippingZone, data.shipping_zone_id)
        order.shipping_cost = zone.flat_rate if (zone and zone.enabled) else None

    # Authoritative quote for upload orders (design is quoted manually).
    if data.source == SOURCE_UPLOAD and data.volume_cm3 and data.filament_id:
        filament = session.get(PrintFilament, data.filament_id)
        if filament is None or not filament.enabled:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown filament")
        q = compute_quote(
            volume_cm3=data.volume_cm3,
            surface_cm2=data.surface_cm2 or 0.0,
            density_g_cm3=filament.density_g_cm3,
            rate_per_gram=filament.rate_per_gram,
            wall_thickness_mm=s.wall_thickness_mm,
            infill_percent=s.infill_percent,
            quantity=data.quantity,
            setup_fee=s.setup_fee,
            min_order=s.min_order,
            shipping_cost=order.shipping_cost or 0.0,
        )
        order.est_weight_g = q.weight_g
        order.items_subtotal = q.items_subtotal
        order.total_estimate = q.total

    session.add(order)
    session.commit()
    session.refresh(order)

    _notify_admin(order)
    return order


def _notify_admin(order: PrintOrder) -> None:
    lines = [
        f"New 3D-print {order.source} order #{order.id}",
        f"Customer: {order.customer_name} <{order.customer_email}> {order.customer_phone or ''}",
        f"Delivery: {order.shipping_address}",
    ]
    if order.source == SOURCE_UPLOAD:
        lines += [
            f"STL: {order.stl_url}",
            f"Qty: {order.quantity}  Est. weight: {order.est_weight_g} g",
            f"Est. total: {order.total_estimate}",
        ]
    else:
        lines += [f"Design brief: {order.design_brief}", f"Reference: {order.reference_url or '-'}"]
    if order.notes:
        lines.append(f"Notes: {order.notes}")
    try:
        send_email(f"New 3D-print order #{order.id} ({order.source})", "\n".join(lines))
    except Exception:  # noqa: BLE001 - never fail the order on email trouble
        logger.exception("order notification email failed for #%s", order.id)
