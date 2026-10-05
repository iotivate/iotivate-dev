from app.models.printing import PrintColor, PrintFilament, PrintOrder, ShippingZone


class TestAuth:
    def test_requires_admin(self, client, auth_headers):
        # non-admin user
        assert client.get("/api/admin/print/settings", headers=auth_headers).status_code == 403

    def test_anonymous_rejected(self, client):
        assert client.get("/api/admin/print/settings").status_code == 401


class TestSettings:
    def test_get_creates_and_returns(self, client, admin_headers):
        r = client.get("/api/admin/print/settings", headers=admin_headers)
        assert r.status_code == 200
        assert "min_order" in r.json()

    def test_update(self, client, admin_headers):
        client.get("/api/admin/print/settings", headers=admin_headers)
        r = client.put("/api/admin/print/settings",
                       json={"setup_fee": 750, "min_order": 3500, "service_open": False},
                       headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["setup_fee"] == 750
        assert body["min_order"] == 3500
        assert body["service_open"] is False


class TestFilaments:
    def test_create_update_and_add_color(self, client, admin_headers):
        r = client.post("/api/admin/print/filaments",
                        json={"type": "PLA", "name": "PLA Basic", "density_g_cm3": 1.24, "rate_per_gram": 55},
                        headers=admin_headers)
        assert r.status_code == 201, r.text
        fid = r.json()["id"]

        u = client.put(f"/api/admin/print/filaments/{fid}", json={"rate_per_gram": 60, "enabled": False},
                       headers=admin_headers)
        assert u.json()["rate_per_gram"] == 60 and u.json()["enabled"] is False

        c = client.post(f"/api/admin/print/filaments/{fid}/colors",
                        json={"name": "Black", "hex": "#111111"}, headers=admin_headers)
        assert c.status_code == 201

        listing = client.get("/api/admin/print/filaments", headers=admin_headers).json()
        assert any(f["id"] == fid and len(f["colors"]) == 1 for f in listing)

    def test_delete_color_blocked_when_referenced(self, client, admin_headers, session):
        fil = PrintFilament(type="PLA", name="PLA", density_g_cm3=1.24, rate_per_gram=50)
        session.add(fil)
        session.commit()
        session.refresh(fil)
        color = PrintColor(filament_id=fil.id, name="Red", hex="#f00")
        session.add(color)
        session.commit()
        session.refresh(color)
        session.add(PrintOrder(source="upload", customer_name="x", customer_email="x@e.com",
                               shipping_address="a", color_id=color.id, filament_id=fil.id))
        session.commit()
        r = client.delete(f"/api/admin/print/colors/{color.id}", headers=admin_headers)
        assert r.status_code == 409  # referenced -> disable instead

    def test_delete_unused_color(self, client, admin_headers, session):
        fil = PrintFilament(type="PLA", name="PLA", density_g_cm3=1.24, rate_per_gram=50)
        session.add(fil)
        session.commit()
        session.refresh(fil)
        color = PrintColor(filament_id=fil.id, name="Blue", hex="#00f")
        session.add(color)
        session.commit()
        session.refresh(color)
        assert client.delete(f"/api/admin/print/colors/{color.id}", headers=admin_headers).status_code == 204


class TestZones:
    def test_create_and_update(self, client, admin_headers):
        r = client.post("/api/admin/print/zones", json={"name": "Lagos", "flat_rate": 3000},
                        headers=admin_headers)
        assert r.status_code == 201
        zid = r.json()["id"]
        u = client.put(f"/api/admin/print/zones/{zid}", json={"name": "Lagos", "flat_rate": 3500, "enabled": True, "sort_order": 1},
                       headers=admin_headers)
        assert u.json()["flat_rate"] == 3500


class TestOrders:
    def test_list_and_update_status(self, client, admin_headers, session):
        session.add(PrintOrder(source="design", customer_name="Ada", customer_email="a@e.com",
                               shipping_address="addr", design_brief="a cup"))
        session.commit()
        listing = client.get("/api/admin/print/orders", headers=admin_headers).json()
        assert {"items", "total", "skip", "limit"} <= listing.keys()
        assert listing["total"] == 1
        oid = listing["items"][0]["id"]

        ok = client.put(f"/api/admin/print/orders/{oid}", json={"status": "quoted"}, headers=admin_headers)
        assert ok.status_code == 200 and ok.json()["status"] == "quoted"

        bad = client.put(f"/api/admin/print/orders/{oid}", json={"status": "bogus"}, headers=admin_headers)
        assert bad.status_code == 422

    def test_filter_by_status(self, client, admin_headers, session):
        session.add(PrintOrder(source="design", customer_name="A", customer_email="a@e.com",
                               shipping_address="x", status="new", design_brief="b"))
        session.add(PrintOrder(source="design", customer_name="B", customer_email="b@e.com",
                               shipping_address="x", status="paid", design_brief="b"))
        session.commit()
        paid = client.get("/api/admin/print/orders?status=paid", headers=admin_headers).json()
        assert paid["total"] == 1 and paid["items"][0]["status"] == "paid"
