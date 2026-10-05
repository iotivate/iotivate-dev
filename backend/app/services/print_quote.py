"""Authoritative 3D-print quote math. Kept pure + separate so it's testable and
the server (not the client) is the source of truth for price."""

from dataclasses import dataclass


@dataclass
class Quote:
    weight_g: float
    unit_price: float      # per single item (incl. setup fee once, see note)
    items_subtotal: float  # after quantity + setup fee + minimum floor
    shipping_cost: float
    total: float
    min_applied: bool


def estimate_weight_g(volume_cm3: float, density_g_cm3: float, fill_factor: float) -> float:
    """Approximate printed weight. An STL only gives solid volume; real weight
    depends on infill/walls/supports, so fill_factor (admin-tuned, ~0.4) scales
    it. Intended to slightly over-estimate to protect margin."""
    return max(0.0, volume_cm3) * density_g_cm3 * fill_factor


def compute_quote(
    *,
    volume_cm3: float,
    density_g_cm3: float,
    rate_per_gram: float,
    fill_factor: float,
    quantity: int,
    setup_fee: float,
    min_order: float,
    shipping_cost: float = 0.0,
) -> Quote:
    qty = max(1, quantity)
    weight_g = estimate_weight_g(volume_cm3, density_g_cm3, fill_factor)
    per_item_material = weight_g * rate_per_gram
    raw_subtotal = per_item_material * qty + setup_fee
    items_subtotal = max(raw_subtotal, min_order)
    return Quote(
        weight_g=round(weight_g, 1),
        unit_price=round(per_item_material, 2),
        items_subtotal=round(items_subtotal, 2),
        shipping_cost=round(shipping_cost, 2),
        total=round(items_subtotal + shipping_cost, 2),
        min_applied=raw_subtotal < min_order,
    )
