import pytest

from app.services.print_quote import compute_quote, estimate_weight_g


def test_weight_shell_plus_infill():
    # 100 cm3, 200 cm2 surface, wall 1mm (=0.1cm) -> shell = 200*0.1 = 20 cm3
    # interior = 80 cm3; material = 20 + 0.2*80 = 36 cm3; * density 1.0 = 36 g
    assert estimate_weight_g(100, 200, 1.0, 1.0, 0.2) == pytest.approx(36.0)


def test_weight_shell_capped_at_solid_volume():
    # A huge surface can't make the shell exceed the solid volume.
    # shell = min(500*0.1, 10) = 10; interior = 0; material = 10 g
    assert estimate_weight_g(10, 500, 1.0, 1.0, 0.2) == pytest.approx(10.0)


def test_wall_dominated_part_is_heavier_than_flat_40pct():
    # Regression for the undercharging bug: a thin-walled part (high surface,
    # low solid fraction) must weigh far more than the old volume*density*0.4.
    flat_old = 106.8 * 1.24 * 0.4  # ~53 g (the under-estimate we're replacing)
    shell = estimate_weight_g(106.8, 600, 1.24, 1.2, 0.15)
    assert shell > flat_old * 1.5


def test_small_order_floored_to_minimum():
    q = compute_quote(
        volume_cm3=10, surface_cm2=20, density_g_cm3=1.0, rate_per_gram=50,
        wall_thickness_mm=1.0, infill_percent=20,
        quantity=1, setup_fee=500, min_order=3000,
    )
    # shell=min(2,10)=2; interior=8; material=3.6g; *50=180 +500 = 680 < 3000
    assert q.min_applied is True
    assert q.items_subtotal == 3000
    assert q.total == 3000  # no shipping


def test_large_order_priced_by_weight():
    q = compute_quote(
        volume_cm3=100, surface_cm2=200, density_g_cm3=1.0, rate_per_gram=50,
        wall_thickness_mm=1.0, infill_percent=20,
        quantity=2, setup_fee=500, min_order=3000, shipping_cost=4500,
    )
    # 36g*50 = 1800 *2 + 500 = 4100; + 4500 shipping = 8600
    assert q.min_applied is False
    assert q.items_subtotal == 4100.0
    assert q.total == 8600.0


def test_shipping_added_on_top_of_minimum():
    q = compute_quote(
        volume_cm3=10, surface_cm2=20, density_g_cm3=1.0, rate_per_gram=50,
        wall_thickness_mm=1.0, infill_percent=20,
        quantity=1, setup_fee=500, min_order=3000, shipping_cost=2500,
    )
    assert q.items_subtotal == 3000
    assert q.total == 5500


def test_quantity_multiplies_before_minimum():
    q = compute_quote(
        volume_cm3=100, surface_cm2=200, density_g_cm3=1.0, rate_per_gram=50,
        wall_thickness_mm=1.0, infill_percent=20,
        quantity=3, setup_fee=500, min_order=3000,
    )
    # 36g*50 = 1800 *3 + 500 = 5900 > 3000
    assert q.items_subtotal == 5900.0
    assert q.min_applied is False
