from app.models.printing import PrintColor, PrintFilament, PrintOrder, PrintSettings, ShippingZone


def _seed(session, *, service_open=True):
    session.add(PrintSettings(id=1, setup_fee=500, min_order=3000,
                              wall_thickness_mm=1.0, infill_percent=20,
                              max_x_mm=220, max_y_mm=220, max_z_mm=250, service_open=service_open))
    pla = PrintFilament(type="PLA", name="PLA", density_g_cm3=1.0, rate_per_gram=50.0, enabled=True)
    session.add(pla)
    session.commit()
    session.refresh(pla)
    session.add(PrintColor(filament_id=pla.id, name="Black", hex="#111"))
    zone = ShippingZone(name="Abuja", flat_rate=2500.0)
    session.add(zone)
    session.commit()
    session.refresh(zone)
    return pla, zone


class TestConfig:
    def test_config_lists_enabled_filaments_and_zones(self, client, session):
        _seed(session)
        body = client.get("/api/print/config").json()
        assert body["service_open"] is True
        assert body["min_order"] == 3000
        assert len(body["filaments"]) == 1
        assert body["filaments"][0]["colors"][0]["name"] == "Black"
        assert len(body["shipping_zones"]) == 1


class TestQuote:
    def test_small_quote_floored(self, client, session):
        pla, zone = _seed(session)
        r = client.post("/api/print/quote", json={
            "volume_cm3": 20, "surface_cm2": 40, "filament_id": pla.id, "quantity": 1,
            "shipping_zone_id": zone.id,
        })
        assert r.status_code == 200
        q = r.json()
        # shell=min(4,20)=4; interior=16; material=7.2g *50 = 360 +500 = 860 < 3000
        assert q["items_subtotal"] == 3000
        assert q["min_applied"] is True
        assert q["total"] == 5500  # 3000 + 2500 shipping

    def test_oversized_flagged(self, client, session):
        pla, _ = _seed(session)
        r = client.post("/api/print/quote", json={
            "volume_cm3": 50, "filament_id": pla.id, "quantity": 1,
            "dim_x_mm": 300, "dim_y_mm": 50, "dim_z_mm": 50,  # 300 > 250 max
        })
        assert r.json()["exceeds_build_volume"] is True

    def test_unknown_filament_rejected(self, client, session):
        _seed(session)
        r = client.post("/api/print/quote", json={"volume_cm3": 10, "filament_id": 999, "quantity": 1})
        assert r.status_code == 400


class TestOrders:
    def test_upload_order_created_with_estimate(self, client, session):
        pla, zone = _seed(session)
        r = client.post("/api/print/orders", json={
            "source": "upload",
            "customer_name": "Ada", "customer_email": "ada@example.com", "customer_phone": "08011112222",
            "stl_url": "https://files.iotivate.dev/print-uploads/x.stl",
            "filament_id": pla.id, "quantity": 2, "volume_cm3": 500, "surface_cm2": 400,
            "shipping_zone_id": zone.id, "shipping_address": "12 Test St, Abuja",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["source"] == "upload"
        # shell=min(40,500)=40; interior=460; material=40+0.2*460=132g
        # 132g*50 = 6600 *2 + 500 setup = 13700; + 2500 (Abuja) shipping = 16200
        assert body["total_estimate"] == 16200.0
        assert session.get(PrintOrder, body["id"]) is not None

    def test_design_order_created_without_quote(self, client, session):
        _seed(session)
        r = client.post("/api/print/orders", json={
            "source": "design",
            "customer_name": "Bola", "customer_email": "bola@example.com", "customer_phone": "08033334444",
            "design_brief": "A phone stand, ~12cm tall, sturdy for a desk.",
            "shipping_address": "5 Design Rd, Abuja",
        })
        assert r.status_code == 201, r.text
        assert r.json()["total_estimate"] is None  # design is quoted manually

    def test_upload_order_requires_stl(self, client, session):
        pla, _ = _seed(session)
        r = client.post("/api/print/orders", json={
            "source": "upload", "customer_name": "No File", "customer_email": "n@example.com", "customer_phone": "08055556666",
            "filament_id": pla.id, "volume_cm3": 100, "shipping_address": "x",
        })
        assert r.status_code == 422  # missing stl_url

    def test_closed_service_rejects_orders(self, client, session):
        pla, zone = _seed(session, service_open=False)
        r = client.post("/api/print/orders", json={
            "source": "upload", "customer_name": "Late", "customer_email": "l@example.com", "customer_phone": "08077778888",
            "stl_url": "https://files.iotivate.dev/print-uploads/y.stl",
            "filament_id": pla.id, "volume_cm3": 100, "shipping_address": "x",
        })
        assert r.status_code == 409
