from io import BytesIO
from unittest.mock import patch


class TestUploadAuth:
    def test_requires_admin(self, client, auth_headers):
        response = client.post(
            "/api/upload",
            headers=auth_headers,
            files={"file": ("test.png", b"fake", "image/png")},
            data={"folder": "general"},
        )
        assert response.status_code == 403

    def test_unauthenticated(self, client):
        response = client.post(
            "/api/upload",
            files={"file": ("test.png", b"fake", "image/png")},
            data={"folder": "general"},
        )
        assert response.status_code == 401


class TestUploadValidation:
    def test_invalid_extension(self, client, admin_headers):
        response = client.post(
            "/api/upload",
            headers=admin_headers,
            files={"file": ("test.exe", b"fake", "application/octet-stream")},
            data={"folder": "general"},
        )
        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"]

    def test_path_traversal_rejected(self, client, admin_headers):
        response = client.post(
            "/api/upload",
            headers=admin_headers,
            files={"file": ("test.png", b"fake", "image/png")},
            data={"folder": "../etc"},
        )
        assert response.status_code == 400

    def test_invalid_folder_prefix(self, client, admin_headers):
        response = client.post(
            "/api/upload",
            headers=admin_headers,
            files={"file": ("test.png", b"fake", "image/png")},
            data={"folder": "badprefix"},
        )
        assert response.status_code == 400
        assert "must start with" in response.json()["detail"]
