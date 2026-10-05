import pytest

from app.services.print_quote import compute_quote, estimate_weight_g


def test_weight_from_volume():
    # 20 cm3 PLA at 0.4 fill ~= 20 * 1.24 * 0.4 = 9.92 g
    assert estimate_weight_g(20, 1.24, 0.4) == pytest.approx(9.92)


def test_small_order_floored_to_minimum():
    q = compute_quote(
        volume_cm3=20, density_g_cm3=1.24, rate_per_gram=50, fill_factor=0.4,
        quantity=1, setup_fee=500, min_order=3000,
    )
    assert q.min_applied is True
    assert q.items_subtotal == 3000
    assert q.total == 3000  # no shipping


def test_large_order_priced_by_weight():
    q = compute_quote(
        volume_cm3=500, density_g_cm3=1.24, rate_per_gram=50, fill_factor=0.4,
        quantity=2, setup_fee=500, min_order=3000, shipping_cost=4500,
    )
    # weight 248g * 50 = 12400 * 2 + 500 = 25300; + 4500 shipping = 29800
    assert q.min_applied is False
    assert q.items_subtotal == 25300.0
    assert q.total == 29800.0


def test_shipping_added_on_top_of_minimum():
    q = compute_quote(
        volume_cm3=5, density_g_cm3=1.24, rate_per_gram=50, fill_factor=0.4,
        quantity=1, setup_fee=500, min_order=3000, shipping_cost=2500,
    )
    assert q.items_subtotal == 3000
    assert q.total == 5500


def test_quantity_multiplies_before_minimum():
    q = compute_quote(
        volume_cm3=100, density_g_cm3=1.24, rate_per_gram=50, fill_factor=0.4,
        quantity=3, setup_fee=500, min_order=3000,
    )
    # 49.6g * 50 = 2480 * 3 + 500 = 7940 > 3000
    assert q.items_subtotal == 7940.0
    assert q.min_applied is False
