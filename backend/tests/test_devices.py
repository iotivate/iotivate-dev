from datetime import datetime, timezone, timedelta

import pytest

from app.auth import create_access_token, hash_password
from app.models.device import Device, DeviceUser, PAIRING_PAIRED, ROLE_ADMIN, ROLE_VIEWER
from app.models.user import User


@pytest.fixture(name="other_headers")
def other_headers_fixture(session):
    """A second, unrelated user — used to prove access isolation."""
    user = User(email="other@example.com", username="otheruser", hashed_password=hash_password("Other1234!"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def _create_device(client, auth_headers, name="Living Room Radar"):
    res = client.post("/api/devices/", json={"name": name}, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()


class TestCreateDevice:
    def test_requires_auth(self, client):
        assert client.post("/api/devices/", json={"name": "X"}).status_code == 401

    def test_create_returns_device_and_pairing_code(self, client, auth_headers):
        body = _create_device(client, auth_headers)
        device, pairing = body["device"], body["pairing"]
        assert device["pairing_state"] == "unpaired"
        assert device["role"] == "owner"
        assert device["device_type"] == "radar"
        assert len(pairing["pairing_code"]) == 8
        assert pairing["device_id"] == device["id"]
        assert '"code"' in pairing["qr_payload"]

    def test_blank_name_rejected(self, client, auth_headers):
        assert client.post("/api/devices/", json={"name": "   "}, headers=auth_headers).status_code == 422

    def test_response_never_leaks_token_hash(self, client, auth_headers):
        body = _create_device(client, auth_headers)
        assert "device_token_hash" not in body["device"]


class TestListAndGet:
    def test_list_shows_owned_device(self, client, auth_headers):
        created = _create_device(client, auth_headers)["device"]
        res = client.get("/api/devices/", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert {"items", "total", "skip", "limit"} <= data.keys()
        assert data["items"][0]["id"] == created["id"]
        assert data["items"][0]["role"] == "owner"

    def test_get_detail_as_member(self, client, auth_headers):
        created = _create_device(client, auth_headers)["device"]
        res = client.get(f"/api/devices/{created['id']}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["id"] == created["id"]

    def test_non_member_gets_404(self, client, auth_headers, other_headers):
        created = _create_device(client, auth_headers)["device"]
        # 404, not 403 — don't leak that the device exists.
        assert client.get(f"/api/devices/{created['id']}", headers=other_headers).status_code == 404

    def test_other_user_list_is_empty(self, client, auth_headers, other_headers):
        _create_device(client, auth_headers)
        assert client.get("/api/devices/", headers=other_headers).json()["total"] == 0


class TestPairing:
    def test_pair_mints_token_and_marks_paired(self, client, auth_headers):
        pairing = _create_device(client, auth_headers)["pairing"]
        res = client.post("/api/devices/pair", json={"pairing_code": pairing["pairing_code"]})
        assert res.status_code == 200, res.text
        token = res.json()["device_token"]
        assert token.startswith(f"did_{pairing['device_id']}.")

        detail = client.get(f"/api/devices/{pairing['device_id']}", headers=auth_headers).json()
        assert detail["pairing_state"] == "paired"
        assert detail["paired_at"] is not None

    def test_code_is_single_use(self, client, auth_headers):
        pairing = _create_device(client, auth_headers)["pairing"]
        code = pairing["pairing_code"]
        assert client.post("/api/devices/pair", json={"pairing_code": code}).status_code == 200
        # Code cleared on success → second attempt fails.
        assert client.post("/api/devices/pair", json={"pairing_code": code}).status_code == 400

    def test_wrong_code_rejected(self, client, auth_headers):
        _create_device(client, auth_headers)
        assert client.post("/api/devices/pair", json={"pairing_code": "WRONGCOD"}).status_code == 400

    def test_expired_code_rejected(self, client, auth_headers, session):
        pairing = _create_device(client, auth_headers)["pairing"]
        device = session.get(Device, pairing["device_id"])
        device.pairing_code_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        session.add(device)
        session.commit()
        assert client.post("/api/devices/pair", json={"pairing_code": pairing["pairing_code"]}).status_code == 400

    def test_pair_accepts_lowercase_and_whitespace(self, client, auth_headers):
        pairing = _create_device(client, auth_headers)["pairing"]
        messy = f"  {pairing['pairing_code'].lower()} "
        assert client.post("/api/devices/pair", json={"pairing_code": messy}).status_code == 200


class TestDeviceTokenAuth:
    def _pair(self, client, auth_headers):
        pairing = _create_device(client, auth_headers)["pairing"]
        token = client.post("/api/devices/pair", json={"pairing_code": pairing["pairing_code"]}).json()[
            "device_token"
        ]
        return pairing["device_id"], token

    def test_token_authenticates_me(self, client, auth_headers):
        device_id, token = self._pair(client, auth_headers)
        res = client.get("/api/devices/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["id"] == device_id

    def test_bad_token_rejected(self, client, auth_headers):
        device_id, token = self._pair(client, auth_headers)
        assert client.get("/api/devices/me", headers={"Authorization": f"Bearer did_{device_id}.garbage"}).status_code == 401

    def test_missing_token_rejected(self, client):
        assert client.get("/api/devices/me").status_code == 401


class TestPermissions:
    def _add_member(self, session, device_id, role):
        user = User(email=f"{role}@example.com", username=f"{role}user", hashed_password=hash_password("Member1234!"))
        session.add(user)
        session.commit()
        session.refresh(user)
        session.add(DeviceUser(device_id=device_id, user_id=user.id, role=role))
        session.commit()
        return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}

    def test_viewer_cannot_regenerate_code(self, client, auth_headers, session):
        device_id = _create_device(client, auth_headers)["device"]["id"]
        viewer_headers = self._add_member(session, device_id, ROLE_VIEWER)
        assert client.post(f"/api/devices/{device_id}/pairing-code", headers=viewer_headers).status_code == 403

    def test_admin_can_regenerate_code(self, client, auth_headers, session):
        device_id = _create_device(client, auth_headers)["device"]["id"]
        admin_headers = self._add_member(session, device_id, ROLE_ADMIN)
        res = client.post(f"/api/devices/{device_id}/pairing-code", headers=admin_headers)
        assert res.status_code == 200
        assert len(res.json()["pairing_code"]) == 8

    def test_admin_cannot_delete_only_owner_can(self, client, auth_headers, session):
        device_id = _create_device(client, auth_headers)["device"]["id"]
        admin_headers = self._add_member(session, device_id, ROLE_ADMIN)
        assert client.delete(f"/api/devices/{device_id}", headers=admin_headers).status_code == 403

    def test_owner_delete_revokes_token(self, client, auth_headers):
        pairing = _create_device(client, auth_headers)["pairing"]
        token = client.post("/api/devices/pair", json={"pairing_code": pairing["pairing_code"]}).json()[
            "device_token"
        ]
        assert client.delete(f"/api/devices/{pairing['device_id']}", headers=auth_headers).status_code == 204
        # Device gone → token no longer authenticates.
        assert client.get("/api/devices/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
        assert client.get(f"/api/devices/{pairing['device_id']}", headers=auth_headers).status_code == 404
