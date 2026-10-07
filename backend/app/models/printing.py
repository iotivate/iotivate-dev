from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Order lifecycle.
ORDER_NEW = "new"
ORDER_QUOTED = "quoted"
ORDER_PAID = "paid"
ORDER_PRINTING = "printing"
ORDER_SHIPPED = "shipped"
ORDER_COMPLETED = "completed"
ORDER_CANCELLED = "cancelled"

# How the customer supplied the model.
SOURCE_UPLOAD = "upload"   # customer provided an STL -> instant quote
SOURCE_DESIGN = "design"   # we design it -> manual quote


class PrintFilament(SQLModel, table=True):
    """A material the shop offers (admin-managed). Rate + density are per-material
    since ABS/TPU cost more and weigh differently than PLA."""

    id: int | None = Field(default=None, primary_key=True)
    type: str = Field(max_length=20)              # PLA / ABS / TPU / PETG ...
    name: str = Field(max_length=60)              # display name
    density_g_cm3: float = Field(default=1.24)    # for weight estimate
    rate_per_gram: float = Field(default=0.0)     # NGN per gram
    enabled: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)


class PrintColor(SQLModel, table=True):
    """A color available for a given filament (stock is per material+color)."""

    id: int | None = Field(default=None, primary_key=True)
    filament_id: int = Field(foreign_key="printfilament.id", index=True)
    name: str = Field(max_length=40)
    hex: str = Field(default="#808080", max_length=9)   # swatch
    enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


class PrintSettings(SQLModel, table=True):
    """Global shop settings — a single row (id=1), admin-editable."""

    id: int | None = Field(default=None, primary_key=True)
    setup_fee: float = Field(default=500.0)        # NGN, added per order
    min_order: float = Field(default=3000.0)       # NGN, order total floored to this
    fill_factor: float = Field(default=0.4)        # legacy flat model (unused; kept for compat)
    # Shell + infill weight model (see services/print_quote.py).
    wall_thickness_mm: float = Field(default=1.2)  # effective solid skin: perimeters + top/bottom
    infill_percent: float = Field(default=15.0)    # interior infill density
    max_upload_mb: int = Field(default=100)        # STL upload size cap (hard-ceilinged in the API)
    max_x_mm: float = Field(default=220.0)         # printer bed limits
    max_y_mm: float = Field(default=220.0)
    max_z_mm: float = Field(default=250.0)
    currency: str = Field(default="NGN", max_length=8)
    lead_time_text: str = Field(default="3-5 business days", max_length=60)
    service_open: bool = Field(default=True)        # pause intake when backlogged
    design_enabled: bool = Field(default=True)      # offer the "design it for me" path
    estimate_disclaimer: str = Field(
        default="Weight and price are estimates, confirmed before printing.",
        max_length=200,
    )
    updated_at: datetime = Field(default_factory=_utcnow)


class ShippingZone(SQLModel, table=True):
    """A flat-rate delivery zone (admin-managed). Delivery-only — no pickup."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=80)
    flat_rate: float = Field(default=0.0)          # NGN
    enabled: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)


class PrintOrder(SQLModel, table=True):
    """A print request/order. Covers both the upload (instant-quote) and design
    (manual-quote) paths; path-specific fields are nullable."""

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    status: str = Field(default=ORDER_NEW, max_length=20, index=True)
    source: str = Field(max_length=20)             # upload | design

    # Customer
    customer_name: str = Field(max_length=100)
    customer_email: str = Field(max_length=255, index=True)
    customer_phone: str | None = Field(default=None, max_length=40)

    # Upload path
    stl_url: str | None = Field(default=None, max_length=500)
    filament_id: int | None = Field(default=None, foreign_key="printfilament.id")
    color_id: int | None = Field(default=None, foreign_key="printcolor.id")
    quantity: int = Field(default=1)
    volume_cm3: float | None = Field(default=None)
    surface_cm2: float | None = Field(default=None)
    est_weight_g: float | None = Field(default=None)
    dim_x_mm: float | None = Field(default=None)
    dim_y_mm: float | None = Field(default=None)
    dim_z_mm: float | None = Field(default=None)

    # Design path
    design_brief: str | None = Field(default=None, max_length=4000)
    reference_url: str | None = Field(default=None, max_length=500)

    # Delivery + money (NGN). Estimates captured at request time.
    shipping_zone_id: int | None = Field(default=None, foreign_key="shippingzone.id")
    shipping_address: str | None = Field(default=None, max_length=500)
    items_subtotal: float | None = Field(default=None)
    shipping_cost: float | None = Field(default=None)
    total_estimate: float | None = Field(default=None)
    notes: str | None = Field(default=None, max_length=2000)
