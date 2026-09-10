import pytest
from starlette.websockets import WebSocketDisconnect

from app.auth import create_access_token, hash_password
from app.models.user import User
from app.services.radar_manager import RadarConnectionManager


def _paired_device(client, auth_headers, name="WS Radar"):
    """Create a device (owned by the auth_headers user) and pair it, returning
    (device_id, device_token)."""
    created = client.post("/api/devices/", json={"name": name}, headers=auth_headers).json()
    code = created["pairing"]["pairing_code"]
    device_id = created["device"]["id"]
    token = client.post("/api/devices/pair", json={"pairing_code": code}).json()["device_token"]
    return device_id, token


class TestDeviceSocket:
    def test_valid_token_connects_via_query(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        with client.websocket_connect(f"/ws/radar/device?token={token}") as ws:
            ws.send_json({"type": "telemetry", "targets": [{"x": 1.0, "y": 2.0}]})
            ws.send_json({"type": "telemetry", "targets": []})

    def test_valid_token_connects_via_header(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        with client.websocket_connect(
            "/ws/radar/device", headers={"Authorization": f"Bearer {token}"}
        ) as ws:
            ws.send_json({"type": "telemetry", "targets": []})

    def test_bad_token_rejected(self, client, auth_headers):
        device_id, _ = _paired_device(client, auth_headers)
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/radar/device?token=did_{device_id}.wrongsecret"):
                pass

    def test_missing_token_rejected(self, client):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/radar/device"):
                pass

    def test_invalid_frame_gets_error_without_dropping(self, client, auth_headers):
        _, token = _paired_device(client, auth_headers)
        with client.websocket_connect(f"/ws/radar/device?token={token}") as ws:
            # extra key on a target violates the strict schema
            ws.send_json({"type": "telemetry", "targets": [{"x": 1, "y": 2, "bogus": 3}]})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            # connection survives; a valid frame afterwards is accepted
            ws.send_json({"type": "telemetry", "targets": []})


class TestSubscriber:
    def test_member_receives_fanned_out_frame(self, client, auth_headers, test_user):
        device_id, dev_token = _paired_device(client, auth_headers)
        user_token = create_access_token({"sub": test_user.username})
        with client.websocket_connect(f"/ws/radar/subscribe/{device_id}?token={user_token}") as sub:
            hello = sub.receive_json()
            assert hello["type"] == "status"
            assert hello["device_id"] == device_id
            assert hello["online"] is False  # device not connected yet

            with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
                assert sub.receive_json()["online"] is True  # device-online status
                dev.send_json({"type": "telemetry", "seq": 7, "targets": [{"x": 1.5, "y": 2.5}]})
                frame = sub.receive_json()
                assert frame["device_id"] == device_id
                assert frame["seq"] == 7
                assert frame["targets"][0]["x"] == 1.5

    def test_subscriber_notified_of_device_online_and_offline(self, client, auth_headers, test_user):
        device_id, dev_token = _paired_device(client, auth_headers)
        user_token = create_access_token({"sub": test_user.username})
        with client.websocket_connect(f"/ws/radar/subscribe/{device_id}?token={user_token}") as sub:
            assert sub.receive_json()["online"] is False  # initial hello, device offline
            with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
                online = sub.receive_json()
                assert online["type"] == "status" and online["online"] is True
                dev.close()
                offline = sub.receive_json()
                assert offline["type"] == "status" and offline["online"] is False

    def test_non_member_rejected(self, client, auth_headers, session):
        device_id, _ = _paired_device(client, auth_headers)
        other = User(email="o@example.com", username="otheru", hashed_password=hash_password("Other1234!"))
        session.add(other)
        session.commit()
        session.refresh(other)
        other_token = create_access_token({"sub": other.username})
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/radar/subscribe/{device_id}?token={other_token}"):
                pass

    def test_bad_user_token_rejected(self, client, auth_headers):
        device_id, _ = _paired_device(client, auth_headers)
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/radar/subscribe/{device_id}?token=garbage.jwt"):
                pass


class TestManagerStats:
    """Unit tests for the in-memory live-health stats on the connection manager."""

    def test_record_frame_tracks_target_count(self):
        m = RadarConnectionManager()
        m.record_frame(1, 3)
        stats = m.device_stats(1)
        assert stats["target_count"] == 3
        assert stats["last_frame_at"] is not None

    def test_frame_rate_needs_two_samples(self):
        m = RadarConnectionManager()
        assert m.device_stats(1)["frame_rate"] is None  # no frames at all
        m.record_frame(1, 0)
        assert m.device_stats(1)["frame_rate"] is None  # single sample
        m.record_frame(1, 0)
        assert m.device_stats(1)["frame_rate"] is not None

    def test_unregister_purges_stats(self):
        m = RadarConnectionManager()
        sentinel = object()  # stand-in for the live WebSocket
        m._devices[1] = sentinel
        m.record_frame(1, 2)
        assert m.device_stats(1)["target_count"] == 2
        assert m.unregister_device(1, sentinel) is True
        stats = m.device_stats(1)
        assert stats["target_count"] is None
        assert stats["online"] is False

    def test_superseded_socket_does_not_purge_stats(self):
        m = RadarConnectionManager()
        live, stale = object(), object()
        m._devices[1] = live
        m.record_frame(1, 5)
        # A superseded socket cleaning up must not wipe the live device's stats.
        assert m.unregister_device(1, stale) is False
        assert m.device_stats(1)["target_count"] == 5


class TestHealthOverRest:
    def test_rest_reports_online_and_target_count_while_streaming(
        self, client, auth_headers, test_user
    ):
        device_id, dev_token = _paired_device(client, auth_headers)
        user_token = create_access_token({"sub": test_user.username})
        with client.websocket_connect(f"/ws/radar/subscribe/{device_id}?token={user_token}") as sub:
            assert sub.receive_json()["online"] is False
            with client.websocket_connect(f"/ws/radar/device?token={dev_token}") as dev:
                assert sub.receive_json()["online"] is True  # device-online status
                dev.send_json(
                    {"type": "telemetry", "seq": 1, "targets": [{"x": 1, "y": 2}, {"x": 0, "y": 3}]}
                )
                # Receiving the fanned-out frame proves the server ran record_frame.
                assert sub.receive_json()["seq"] == 1

                body = client.get(f"/api/devices/{device_id}", headers=auth_headers).json()
                assert body["online"] is True
                assert body["target_count"] == 2
                assert body["subscriber_count"] == 1

    def test_rest_reports_offline_when_never_connected(self, client, auth_headers):
        device_id, _ = _paired_device(client, auth_headers)
        body = client.get(f"/api/devices/{device_id}", headers=auth_headers).json()
        # Paired but no live socket and last_seen is stale enough → offline.
        assert body["target_count"] is None
        assert body["subscriber_count"] == 0
