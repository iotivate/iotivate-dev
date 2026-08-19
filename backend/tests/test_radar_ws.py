import pytest
from starlette.websockets import WebSocketDisconnect

from app.auth import create_access_token, hash_password
from app.models.user import User


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
                dev.send_json({"type": "telemetry", "seq": 7, "targets": [{"x": 1.5, "y": 2.5}]})
                frame = sub.receive_json()
                assert frame["device_id"] == device_id
                assert frame["seq"] == 7
                assert frame["targets"][0]["x"] == 1.5

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
