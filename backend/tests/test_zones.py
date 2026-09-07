import pytest
from sqlmodel import select

from app.auth import create_access_token, hash_password
from app.models.device import DeviceUser, ROLE_VIEWER
from app.models.rule import RuleEvent
from app.models.user import User
from app.services.rule_engine import rule_engine

# A rectangle covering the whole default dashboard field, stored as 4 points.
RECT = [{"x": -5, "y": 0}, {"x": 5, "y": 0}, {"x": 5, "y": 8}, {"x": -5, "y": 8}]


@pytest.fixture(autouse=True)
def _clean_engine():
    # The engine is a process-wide singleton; device ids repeat across the
    # per-test in-memory DB, so reset its cache/version between tests.
    rule_engine._cache.clear()
    rule_engine._version.clear()
    yield
    rule_engine._cache.clear()
    rule_engine._version.clear()


def _make_pro(session, user):
    user.subscription_status = "active"
    session.add(user)
    session.commit()
    session.refresh(user)


def _create_device(client, headers, name="Radar"):
    res = client.post("/api/devices/", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _create_zone(client, headers, device_id, name="Zone"):
    res = client.post(
        f"/api/devices/{device_id}/zones",
        json={"name": name, "points": RECT},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


class TestZoneCrud:
    def test_create_requires_pro(self, client, auth_headers):
        dev = _create_device(client, auth_headers)["device"]
        r = client.post(
            f"/api/devices/{dev['id']}/zones",
            json={"name": "Z", "points": RECT},
            headers=auth_headers,
        )
        assert r.status_code == 403

    def test_pro_owner_can_create_and_list(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        zone = _create_zone(client, auth_headers, dev["id"])
        assert len(zone["points"]) == 4
        listing = client.get(f"/api/devices/{dev['id']}/zones", headers=auth_headers)
        assert listing.status_code == 200
        assert len(listing.json()) == 1

    def test_list_is_open_to_free_member(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        _create_zone(client, auth_headers, dev["id"])
        # Drop pro; reads must still work for a member.
        test_user.subscription_status = None
        session.add(test_user)
        session.commit()
        listing = client.get(f"/api/devices/{dev['id']}/zones", headers=auth_headers)
        assert listing.status_code == 200 and len(listing.json()) == 1

    def test_too_few_points_rejected(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        r = client.post(
            f"/api/devices/{dev['id']}/zones",
            json={"name": "Z", "points": RECT[:2]},
            headers=auth_headers,
        )
        assert r.status_code == 422

    def test_non_member_gets_404(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        other = User(
            email="o2@example.com", username="o2",
            hashed_password=hash_password("Other1234!"), subscription_status="active",
        )
        session.add(other)
        session.commit()
        oh = {"Authorization": f"Bearer {create_access_token({'sub': 'o2'})}"}
        r = client.post(
            f"/api/devices/{dev['id']}/zones",
            json={"name": "Z", "points": RECT}, headers=oh,
        )
        assert r.status_code == 404

    def test_viewer_cannot_create_zone(self, client, auth_headers, session, test_user):
        dev = _create_device(client, auth_headers)["device"]
        viewer = User(
            email="v@example.com", username="viewer",
            hashed_password=hash_password("View1234!"), subscription_status="active",
        )
        session.add(viewer)
        session.commit()
        session.refresh(viewer)
        session.add(DeviceUser(device_id=dev["id"], user_id=viewer.id, role=ROLE_VIEWER))
        session.commit()
        vh = {"Authorization": f"Bearer {create_access_token({'sub': 'viewer'})}"}
        r = client.post(
            f"/api/devices/{dev['id']}/zones",
            json={"name": "Z", "points": RECT}, headers=vh,
        )
        assert r.status_code == 403

    def test_delete_zone_cascades_rules(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        did = dev["id"]
        zone = _create_zone(client, auth_headers, did)
        rule = client.post(
            f"/api/devices/{did}/rules",
            json={"zone_id": zone["id"], "name": "R", "trigger_type": "enter"},
            headers=auth_headers,
        )
        assert rule.status_code == 201, rule.text
        d = client.delete(f"/api/zones/{zone['id']}", headers=auth_headers)
        assert d.status_code == 204
        assert client.get(f"/api/devices/{did}/rules", headers=auth_headers).json() == []


class TestRuleValidation:
    @pytest.fixture(autouse=True)
    def _pro_device(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        self.dev = _create_device(client, auth_headers)["device"]
        self.zone = _create_zone(client, auth_headers, self.dev["id"])
        self.headers = auth_headers
        self.client = client

    def _post_rule(self, **body):
        body.setdefault("zone_id", self.zone["id"])
        body.setdefault("name", "R")
        return self.client.post(
            f"/api/devices/{self.dev['id']}/rules", json=body, headers=self.headers
        )

    def test_dwell_requires_seconds(self):
        assert self._post_rule(trigger_type="dwell").status_code == 422

    def test_occupancy_requires_threshold(self):
        assert self._post_rule(trigger_type="occupancy").status_code == 422

    def test_email_action_requires_notify_email(self):
        assert self._post_rule(trigger_type="enter", action_email=True).status_code == 422

    def test_bad_email_rejected(self):
        r = self._post_rule(trigger_type="enter", action_email=True, notify_email="not-an-email")
        assert r.status_code == 422

    def test_valid_dwell_rule(self):
        r = self._post_rule(trigger_type="dwell", dwell_seconds=10)
        assert r.status_code == 201, r.text
        assert r.json()["dwell_seconds"] == 10

    def test_update_rule_rechecks_config(self):
        created = self._post_rule(trigger_type="enter").json()
        # Switching to dwell without dwell_seconds must be rejected on update too.
        bad = self.client.put(
            f"/api/rules/{created['id']}", json={"trigger_type": "dwell"}, headers=self.headers
        )
        assert bad.status_code == 422
        ok = self.client.put(
            f"/api/rules/{created['id']}",
            json={"trigger_type": "dwell", "dwell_seconds": 3}, headers=self.headers,
        )
        assert ok.status_code == 200 and ok.json()["trigger_type"] == "dwell"


class TestEventTimeline:
    def test_events_endpoint_shape(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        r = client.get(f"/api/devices/{dev['id']}/events", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert {"items", "total", "skip", "limit"} <= body.keys()
        assert body["total"] == 0


class TestRuleFires:
    def test_enter_rule_fires_dashboard_alert_and_logs_event(
        self, client, auth_headers, session, test_user
    ):
        _make_pro(session, test_user)
        created = _create_device(client, auth_headers)
        did = created["device"]["id"]
        code = created["pairing"]["pairing_code"]
        dev_token = client.post("/api/devices/pair", json={"pairing_code": code}).json()["device_token"]

        zone = _create_zone(client, auth_headers, did)
        client.post(
            f"/api/devices/{did}/rules",
            json={
                "zone_id": zone["id"], "name": "Enter",
                "trigger_type": "enter", "cooldown_seconds": 0,
            },
            headers=auth_headers,
        )

        user_token = create_access_token({"sub": test_user.username})
        with client.websocket_connect(f"/ws/radar/subscribe/{did}?token={user_token}") as sub:
            assert sub.receive_json()["online"] is False
            with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
                assert sub.receive_json()["online"] is True  # device-online status
                dev.send_json({"type": "telemetry", "seq": 1, "targets": [{"x": 0, "y": 3}]})
                fired = None
                for _ in range(5):
                    msg = sub.receive_json()
                    if msg.get("type") == "rule_fired":
                        fired = msg
                        break
                assert fired is not None
                assert fired["trigger_type"] == "enter"
                assert fired["zone_id"] == zone["id"]

        events = session.exec(select(RuleEvent).where(RuleEvent.device_id == did)).all()
        assert len(events) == 1
