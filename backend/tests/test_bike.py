import pytest
from sqlmodel import select

from app.auth import create_access_token, hash_password
from app.models.bike import BikeTelemetry
from app.models.device import DeviceUser, ROLE_VIEWER
from app.models.user import User


def _paired_device(client, auth_headers, name="Tracker"):
    """Create + pair a device owned by auth_headers' user -> (device_id, token)."""
    created = client.post("/api/devices/", json={"name": name}, headers=auth_headers).json()
    code = created["pairing"]["pairing_code"]
    device_id = created["device"]["id"]
    token = client.post("/api/devices/pair", json={"pairing_code": code}).json()["device_token"]
    return device_id, token


def _batch(*points):
    return {"points": [dict(lat=la, lng=ln, **rest) for (la, ln, rest) in points]}


class TestIngest:
    def test_device_uploads_batch(self, client, auth_headers, session):
        device_id, token = _paired_device(client, auth_headers)
        body = {
            "seq": 1,
            "points": [
                {"lat": 9.05785, "lng": 7.49508, "speed": 24.0, "battery": 78},
                {"lat": 9.05812, "lng": 7.49560, "speed": 26.5, "heading": 45},
            ],
        }
        r = client.post("/api/bike/telemetry", json=body, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201, r.text
        assert r.json()["accepted"] == 2
        rows = session.exec(select(BikeTelemetry).where(BikeTelemetry.device_id == device_id)).all()
        assert len(rows) == 2
        assert rows[0].lat == pytest.approx(9.05785)

    def test_missing_token_rejected(self, client):
        r = client.post("/api/bike/telemetry", json={"points": [{"lat": 1, "lng": 2}]})
        assert r.status_code == 401

    def test_bad_token_rejected(self, client):
        r = client.post(
            "/api/bike/telemetry",
            json={"points": [{"lat": 1, "lng": 2}]},
            headers={"Authorization": "Bearer did_1.wrongsecret"},
        )
        assert r.status_code == 401

    def test_out_of_range_coords_rejected(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        r = client.post(
            "/api/bike/telemetry",
            json={"points": [{"lat": 999, "lng": 7.4}]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422

    def test_empty_batch_rejected(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        r = client.post(
            "/api/bike/telemetry", json={"points": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422

    def test_oversized_batch_rejected(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        points = [{"lat": 9.0, "lng": 7.4} for _ in range(501)]
        r = client.post(
            "/api/bike/telemetry", json={"points": points},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422

    def test_extra_field_rejected(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        r = client.post(
            "/api/bike/telemetry",
            json={"points": [{"lat": 9.0, "lng": 7.4, "bogus": 1}]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 422

    def test_upload_updates_last_seen(self, client, auth_headers, session):
        from app.models.device import Device
        device_id, token = _paired_device(client, auth_headers)
        before = session.get(Device, device_id).last_seen_at
        client.post(
            "/api/bike/telemetry",
            json={"points": [{"lat": 9.0, "lng": 7.4}]},
            headers={"Authorization": f"Bearer {token}"},
        )
        session.expire_all()
        after = session.get(Device, device_id).last_seen_at
        assert after is not None and (before is None or after >= before)


class TestTrackRead:
    def test_member_reads_track_chronologically(self, client, auth_headers, test_user):
        device_id, token = _paired_device(client, auth_headers)
        for i in range(3):
            client.post(
                "/api/bike/telemetry",
                json={"points": [{"lat": 9.0 + i * 0.001, "lng": 7.4}]},
                headers={"Authorization": f"Bearer {token}"},
            )
        user_headers = {"Authorization": f"Bearer {create_access_token({'sub': test_user.username})}"}
        r = client.get(f"/api/devices/{device_id}/track", headers=user_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 3
        lats = [p["lat"] for p in body["items"]]
        assert lats == sorted(lats)  # chronological order

    def test_non_member_gets_404(self, client, auth_headers, session):
        device_id, _ = _paired_device(client, auth_headers)
        other = User(email="o@example.com", username="otheru", hashed_password=hash_password("Other1234!"))
        session.add(other)
        session.commit()
        oh = {"Authorization": f"Bearer {create_access_token({'sub': 'otheru'})}"}
        assert client.get(f"/api/devices/{device_id}/track", headers=oh).status_code == 404
