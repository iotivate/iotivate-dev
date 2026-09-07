import asyncio

import pytest

from app.auth import create_access_token, hash_password
from app.models.device import DeviceUser, ROLE_VIEWER
from app.models.user import User
from app.services.radar_manager import RadarConnectionManager, manager
from app.services.rule_engine import rule_engine

RECT = [{"x": -5, "y": 0}, {"x": 5, "y": 0}, {"x": 5, "y": 8}, {"x": -5, "y": 8}]


@pytest.fixture(autouse=True)
def _clean_engine():
    rule_engine._cache.clear()
    rule_engine._version.clear()
    yield
    rule_engine._cache.clear()
    rule_engine._version.clear()


class _FakeWS:
    def __init__(self):
        self.sent = []

    async def send_json(self, message):
        self.sent.append(message)


class TestSendToDevice:
    def test_online_device_receives(self):
        m = RadarConnectionManager()
        fake = _FakeWS()
        m._devices[1] = fake
        ok = asyncio.run(m.send_to_device(1, {"type": "command"}))
        assert ok is True
        assert fake.sent == [{"type": "command"}]

    def test_offline_device_returns_false(self):
        m = RadarConnectionManager()
        assert asyncio.run(m.send_to_device(99, {"x": 1})) is False


def _make_pro(session, user):
    user.subscription_status = "active"
    session.add(user)
    session.commit()
    session.refresh(user)


def _paired_device(client, auth_headers, name="Alarm Radar"):
    created = client.post("/api/devices/", json={"name": name}, headers=auth_headers).json()
    code = created["pairing"]["pairing_code"]
    device_id = created["device"]["id"]
    token = client.post("/api/devices/pair", json={"pairing_code": code}).json()["device_token"]
    return device_id, token


class TestManualAlarm:
    def test_admin_triggers_and_device_receives(self, client, auth_headers):
        device_id, dev_token = _paired_device(client, auth_headers)
        with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
            r = client.post(
                f"/api/devices/{device_id}/alarm",
                json={"state": "on", "duration_ms": 3000},
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
            assert r.json()["delivered"] is True
            cmd = dev.receive_json()
            assert cmd["type"] == "command"
            assert cmd["command"] == "alarm"
            assert cmd["state"] == "on"
            assert cmd["duration_ms"] == 3000

    def test_offline_device_returns_409(self, client, auth_headers):
        device_id, _ = _paired_device(client, auth_headers)
        r = client.post(
            f"/api/devices/{device_id}/alarm", json={"state": "on"}, headers=auth_headers
        )
        assert r.status_code == 409

    def test_viewer_cannot_trigger(self, client, auth_headers, session):
        device_id, dev_token = _paired_device(client, auth_headers)
        viewer = User(
            email="v@example.com", username="viewer",
            hashed_password=hash_password("View1234!"),
        )
        session.add(viewer)
        session.commit()
        session.refresh(viewer)
        session.add(DeviceUser(device_id=device_id, user_id=viewer.id, role=ROLE_VIEWER))
        session.commit()
        vh = {"Authorization": f"Bearer {create_access_token({'sub': 'viewer'})}"}
        with client.websocket_connect(f"/ws/radar/device?token={dev_token}"):
            r = client.post(f"/api/devices/{device_id}/alarm", json={"state": "on"}, headers=vh)
            assert r.status_code == 403

    def test_bad_state_rejected(self, client, auth_headers):
        device_id, dev_token = _paired_device(client, auth_headers)
        with client.websocket_connect(f"/ws/radar/device?token={dev_token}"):
            r = client.post(
                f"/api/devices/{device_id}/alarm", json={"state": "loud"}, headers=auth_headers
            )
            assert r.status_code == 422


class TestRuleAlarm:
    def test_rule_alarm_sends_command_to_device(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        device_id, dev_token = _paired_device(client, auth_headers)
        zone = client.post(
            f"/api/devices/{device_id}/zones",
            json={"name": "Z", "points": RECT}, headers=auth_headers,
        ).json()
        client.post(
            f"/api/devices/{device_id}/rules",
            json={
                "zone_id": zone["id"], "name": "Intruder", "trigger_type": "enter",
                "cooldown_seconds": 0, "action_dashboard": False,
                "action_alarm": True, "alarm_duration_ms": 2000,
            },
            headers=auth_headers,
        )
        with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
            dev.send_json({"type": "telemetry", "seq": 1, "targets": [{"x": 0, "y": 3}]})
            cmd = dev.receive_json()
            assert cmd["command"] == "alarm"
            assert cmd["state"] == "on"
            assert cmd["duration_ms"] == 2000

    def teardown_method(self):
        # The integration tests use the global manager singleton; make sure no
        # sockets linger between tests.
        manager._devices.clear()
        manager._subscribers.clear()
        manager._stats.clear()
