"""Authoritative 3D-print quote math. Kept pure + separate so it's testable and
the server (not the client) stays the source of truth for price.

Weight uses a shell + infill model (much closer to a slicer than a flat factor):
  shell    ≈ surface_area × wall_thickness   (perimeters + top/bottom), capped at volume
  interior  = solid_volume − shell
  material  = shell + infill% × interior
A single flat fill-factor can't work: wall-dominated parts print near solid mass
while chunky parts at low infill are far lighter — only this split captures both.
"""

from dataclasses import dataclass


@dataclass
class Quote:
    weight_g: float
    unit_price: float      # material cost per single item
    items_subtotal: float  # after quantity + setup fee + minimum floor
    shipping_cost: float
    total: float
    min_applied: bool


def estimate_weight_g(
    volume_cm3: float,
    surface_cm2: float,
    density_g_cm3: float,
    wall_thickness_mm: float,
    infill_fraction: float,
) -> float:
    """Approximate printed weight via shell + infill. ``wall_thickness_mm`` bundles
    the effective solid skin (perimeters + top/bottom layers) and is the main
    calibration knob against the slicer. Falls back to infill-only when surface
    area is unknown (conservative, errs high only with a sane wall)."""
    v = max(0.0, volume_cm3)
    wall_cm = max(0.0, wall_thickness_mm) / 10.0
    shell = min(max(0.0, surface_cm2) * wall_cm, v)  # a shell can't exceed the solid
    interior = max(0.0, v - shell)
    fill = max(0.0, min(1.0, infill_fraction))
    material = shell + fill * interior
    return material * density_g_cm3


def compute_quote(
    *,
    volume_cm3: float,
    surface_cm2: float,
    density_g_cm3: float,
    rate_per_gram: float,
    wall_thickness_mm: float,
    infill_percent: float,
    quantity: int,
    setup_fee: float,
    min_order: float,
    shipping_cost: float = 0.0,
) -> Quote:
    qty = max(1, int(quantity))
    weight_g = estimate_weight_g(
        volume_cm3,
        surface_cm2,
        density_g_cm3,
        wall_thickness_mm,
        infill_percent / 100.0,
    )
    per_item_material = weight_g * max(0.0, rate_per_gram)
    raw_subtotal = per_item_material * qty + max(0.0, setup_fee)
    items_subtotal = max(raw_subtotal, max(0.0, min_order))
    total = items_subtotal + max(0.0, shipping_cost)
    return Quote(
        weight_g=round(weight_g, 1),
        unit_price=round(per_item_material, 2),
        items_subtotal=round(items_subtotal, 2),
        shipping_cost=round(shipping_cost, 2),
        total=round(total, 2),
        min_applied=raw_subtotal < min_order,
    )
