from datetime import datetime, timedelta

import pytest
from sqlmodel import select

from app.auth import create_access_token, hash_password
from app.models.analytics import ZoneOccupancySample
from app.models.device import DeviceUser, ROLE_VIEWER
from app.models.rule import RuleEvent
from app.models.user import User
from app.models.zone import Zone
from app.services.rule_engine import rule_engine

RECT = [{"x": -5, "y": 0}, {"x": 5, "y": 0}, {"x": 5, "y": 8}, {"x": -5, "y": 8}]


@pytest.fixture(autouse=True)
def _clean_engine():
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
    return client.post("/api/devices/", json={"name": name}, headers=headers).json()


def _create_zone(client, headers, device_id, name="Zone"):
    return client.post(
        f"/api/devices/{device_id}/zones", json={"name": name, "points": RECT}, headers=headers
    ).json()


def _paired_device(client, auth_headers, name="A Radar"):
    created = client.post("/api/devices/", json={"name": name}, headers=auth_headers).json()
    code = created["pairing"]["pairing_code"]
    device_id = created["device"]["id"]
    token = client.post("/api/devices/pair", json={"pairing_code": code}).json()["device_token"]
    return device_id, token


class TestSummary:
    def test_aggregates_events(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        zone = _create_zone(client, auth_headers, dev["id"])
        did, zid = dev["id"], zone["id"]
        # Seed a few events directly.
        now = datetime.utcnow()
        for i, trig in enumerate(["enter", "enter", "exit"]):
            session.add(RuleEvent(
                rule_id=1, device_id=did, zone_id=zid, trigger_type=trig,
                fired_at=now - timedelta(hours=i),
            ))
        session.commit()

        body = client.get(f"/api/devices/{did}/analytics/summary", headers=auth_headers).json()
        assert body["total_events"] == 3
        assert body["by_trigger"] == {"enter": 2, "exit": 1}
        assert body["by_zone"][0] == {"zone_id": zid, "name": "Zone", "count": 3}
        assert sum(d["count"] for d in body["daily"]) == 3

    def test_window_excludes_old_events(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        did = dev["id"]
        session.add(RuleEvent(
            rule_id=1, device_id=did, zone_id=1, trigger_type="enter",
            fired_at=datetime.utcnow() - timedelta(days=40),
        ))
        session.commit()
        body = client.get(
            f"/api/devices/{did}/analytics/summary?window_hours=168", headers=auth_headers
        ).json()
        assert body["total_events"] == 0

    def test_non_member_gets_404(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        other = User(email="o@example.com", username="o", hashed_password=hash_password("Other1234!"))
        session.add(other)
        session.commit()
        oh = {"Authorization": f"Bearer {create_access_token({'sub': 'o'})}"}
        assert client.get(f"/api/devices/{dev['id']}/analytics/summary", headers=oh).status_code == 404


class TestOccupancy:
    def test_buckets_samples_by_hour(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        zone = _create_zone(client, auth_headers, dev["id"])
        did, zid = dev["id"], zone["id"]
        base = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        for occ, mins in [(1, 5), (3, 10), (2, 70)]:  # two in hour 0, one in hour 1
            session.add(ZoneOccupancySample(
                device_id=did, zone_id=zid, occupancy=occ,
                sampled_at=base - timedelta(minutes=mins),
            ))
        session.commit()

        body = client.get(
            f"/api/devices/{did}/analytics/occupancy?window_hours=24", headers=auth_headers
        ).json()
        assert len(body["zones"]) == 1
        pts = body["zones"][0]["points"]
        assert len(pts) == 2  # two hourly buckets
        peaks = {p["max"] for p in pts}
        assert peaks == {3, 2}

    def test_member_read_open_to_viewer(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        dev = _create_device(client, auth_headers)["device"]
        viewer = User(email="v@example.com", username="viewer", hashed_password=hash_password("View1234!"))
        session.add(viewer)
        session.commit()
        session.refresh(viewer)
        session.add(DeviceUser(device_id=dev["id"], user_id=viewer.id, role=ROLE_VIEWER))
        session.commit()
        vh = {"Authorization": f"Bearer {create_access_token({'sub': 'viewer'})}"}
        assert client.get(f"/api/devices/{dev['id']}/analytics/occupancy", headers=vh).status_code == 200


class TestSamplingWritesRows:
    def test_frame_in_zone_persists_a_sample(self, client, auth_headers, session, test_user):
        _make_pro(session, test_user)
        device_id, dev_token = _paired_device(client, auth_headers)
        _create_zone(client, auth_headers, device_id)
        with client.websocket_connect(f"/ws/radar/subscribe/{device_id}"
                                      f"?token={create_access_token({'sub': test_user.username})}") as sub:
            assert sub.receive_json()["online"] is False
            with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
                assert sub.receive_json()["online"] is True
                dev.send_json({"type": "telemetry", "seq": 1, "targets": [{"x": 0, "y": 3}]})
                # Ensure the frame was processed by the server before asserting.
                assert sub.receive_json()["seq"] == 1

        samples = session.exec(
            select(ZoneOccupancySample).where(ZoneOccupancySample.device_id == device_id)
        ).all()
        assert len(samples) == 1
        assert samples[0].occupancy == 1
