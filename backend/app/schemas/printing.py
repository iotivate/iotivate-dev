from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.printing import SOURCE_DESIGN, SOURCE_UPLOAD


# --- config (public catalog + settings for the page) ---
class ColorOut(BaseModel):
    id: int
    name: str
    hex: str

    model_config = {"from_attributes": True}


class FilamentOut(BaseModel):
    id: int
    type: str
    name: str
    density_g_cm3: float
    rate_per_gram: float
    colors: list[ColorOut] = []


class ShippingZoneOut(BaseModel):
    id: int
    name: str
    flat_rate: float

    model_config = {"from_attributes": True}


class ConfigOut(BaseModel):
    service_open: bool
    design_enabled: bool
    currency: str
    setup_fee: float
    min_order: float
    fill_factor: float
    max_x_mm: float
    max_y_mm: float
    max_z_mm: float
    lead_time_text: str
    estimate_disclaimer: str
    filaments: list[FilamentOut]
    shipping_zones: list[ShippingZoneOut]


# --- quote (authoritative price) ---
class QuoteIn(BaseModel):
    volume_cm3: float = Field(gt=0, le=1_000_000)
    filament_id: int
    quantity: int = Field(default=1, ge=1, le=100)
    dim_x_mm: float | None = Field(default=None, ge=0)
    dim_y_mm: float | None = Field(default=None, ge=0)
    dim_z_mm: float | None = Field(default=None, ge=0)
    shipping_zone_id: int | None = None


class QuoteOut(BaseModel):
    weight_g: float
    unit_price: float
    items_subtotal: float
    shipping_cost: float
    total: float
    min_applied: bool
    exceeds_build_volume: bool
    currency: str


# --- stl upload ---
class StlUploadOut(BaseModel):
    url: str
    filename: str
    size: int


# --- order ---
class OrderCreate(BaseModel):
    source: str
    customer_name: str = Field(min_length=1, max_length=100)
    customer_email: EmailStr
    customer_phone: str | None = Field(default=None, max_length=40)

    # upload path
    stl_url: str | None = Field(default=None, max_length=500)
    filament_id: int | None = None
    color_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=100)
    volume_cm3: float | None = Field(default=None, gt=0, le=1_000_000)
    dim_x_mm: float | None = Field(default=None, ge=0)
    dim_y_mm: float | None = Field(default=None, ge=0)
    dim_z_mm: float | None = Field(default=None, ge=0)

    # design path
    design_brief: str | None = Field(default=None, max_length=4000)
    reference_url: str | None = Field(default=None, max_length=500)

    # delivery (delivery-only; no pickup)
    shipping_zone_id: int | None = None
    shipping_address: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def check_source(self) -> "OrderCreate":
        if self.source == SOURCE_UPLOAD:
            if not self.stl_url or not self.filament_id or not self.volume_cm3:
                raise ValueError("upload orders require stl_url, filament_id and volume_cm3")
        elif self.source == SOURCE_DESIGN:
            if not self.design_brief:
                raise ValueError("design orders require a design_brief")
        else:
            raise ValueError(f"source must be '{SOURCE_UPLOAD}' or '{SOURCE_DESIGN}'")
        return self


# --- admin ---
class PrintSettingsUpdate(BaseModel):
    setup_fee: float | None = Field(default=None, ge=0)
    min_order: float | None = Field(default=None, ge=0)
    fill_factor: float | None = Field(default=None, gt=0, le=1)
    max_x_mm: float | None = Field(default=None, gt=0)
    max_y_mm: float | None = Field(default=None, gt=0)
    max_z_mm: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, max_length=8)
    lead_time_text: str | None = Field(default=None, max_length=60)
    service_open: bool | None = None
    design_enabled: bool | None = None
    estimate_disclaimer: str | None = Field(default=None, max_length=200)


class FilamentIn(BaseModel):
    type: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=60)
    density_g_cm3: float = Field(gt=0, le=5)
    rate_per_gram: float = Field(ge=0)
    enabled: bool = True
    sort_order: int = 0


class FilamentUpdate(BaseModel):
    type: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=60)
    density_g_cm3: float | None = Field(default=None, gt=0, le=5)
    rate_per_gram: float | None = Field(default=None, ge=0)
    enabled: bool | None = None
    sort_order: int | None = None


class ColorIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    hex: str = Field(default="#808080", max_length=9)
    enabled: bool = True


class ZoneIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    flat_rate: float = Field(ge=0)
    enabled: bool = True
    sort_order: int = 0


class OrderStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=20)


class OrderCreatedOut(BaseModel):
    id: int
    status: str
    source: str
    items_subtotal: float | None = None
    shipping_cost: float | None = None
    total_estimate: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
