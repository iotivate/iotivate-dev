from unittest.mock import patch

from app.auth import create_refresh_token, create_reset_token


class TestRegister:
    def test_register_success(self, client):
        response = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "Strong1234!",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new@example.com"
        assert data["username"] == "newuser"
        assert data["is_active"] is True
        assert "hashed_password" not in data

    def test_register_duplicate_email(self, client, test_user):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "different",
            "password": "Strong1234!",
        })
        assert response.status_code == 409

    def test_register_duplicate_username(self, client, test_user):
        response = client.post("/api/auth/register", json={
            "email": "different@example.com",
            "username": "testuser",
            "password": "Strong1234!",
        })
        assert response.status_code == 409

    def test_register_weak_password(self, client):
        response = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "weakpass",
        })
        assert response.status_code == 422

    def test_register_invalid_email(self, client):
        response = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "username": "newuser",
            "password": "Strong1234!",
        })
        assert response.status_code == 422


class TestLogin:
    def test_login_success(self, client, test_user):
        response = client.post("/api/auth/login", data={
            "username": "testuser",
            "password": "Test1234!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Check refresh cookie is set
        assert "refresh_token" in response.cookies

    def test_login_wrong_password(self, client, test_user):
        response = client.post("/api/auth/login", data={
            "username": "testuser",
            "password": "WrongPass1!",
        })
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post("/api/auth/login", data={
            "username": "ghost",
            "password": "Ghost1234!",
        })
        assert response.status_code == 401


class TestRefresh:
    def test_refresh_success(self, client, test_user):
        token = create_refresh_token(test_user)
        client.cookies.set("refresh_token", token)
        response = client.post("/api/auth/refresh")
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_refresh_missing_cookie(self, client):
        response = client.post("/api/auth/refresh")
        assert response.status_code == 401


class TestLogout:
    def test_logout_clears_cookie(self, client):
        response = client.post("/api/auth/logout")
        assert response.status_code == 200
        assert response.json() == {"message": "Logged out"}


class TestRefreshCookieDomain:
    """Cross-subdomain SSO: one login on iotivate.dev must work on
    radar.iotivate.dev. That hinges entirely on the refresh cookie's Domain
    attribute. See docs/RADAR_PRODUCT_SPEC.md section 4."""

    def _login_set_cookie(self, client):
        response = client.post("/api/auth/login", data={
            "username": "testuser",
            "password": "Test1234!",
        })
        assert response.status_code == 200
        return response.headers["set-cookie"]

    def test_no_domain_attribute_by_default(self, client, test_user):
        # Empty cookie_domain must stay host-only, so local/single-domain
        # dev is unaffected by the SSO change.
        assert "domain=" not in self._login_set_cookie(client).lower()

    def test_domain_set_when_configured(self, client, test_user):
        with patch("app.api.auth.settings.cookie_domain", ".iotivate.dev"):
            header = self._login_set_cookie(client)
        assert "domain=.iotivate.dev" in header.lower()

    def test_logout_clears_cookie_with_matching_domain(self, client, test_user):
        # A cookie is only cleared when key, path and domain all match how it
        # was set. A mismatch here silently strands the cookie on the parent
        # domain and logout stops working across subdomains.
        with patch("app.api.auth.settings.cookie_domain", ".iotivate.dev"):
            response = client.post("/api/auth/logout")
        assert response.status_code == 200
        header = response.headers["set-cookie"].lower()
        assert "domain=.iotivate.dev" in header
        assert "path=/api/auth" in header


class TestMe:
    def test_me_requires_auth(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_me_returns_user(self, client, test_user, auth_headers):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"


class TestForgotPassword:
    @patch("app.api.auth.send_password_reset_email")
    def test_forgot_password_always_200(self, mock_email, client):
        """Should return 200 even for non-existent email (no enumeration)."""
        response = client.post("/api/auth/forgot-password", json={
            "email": "nonexistent@example.com",
        })
        assert response.status_code == 200
        mock_email.assert_not_called()

    @patch("app.api.auth.send_password_reset_email")
    def test_forgot_password_sends_email(self, mock_email, client, test_user):
        response = client.post("/api/auth/forgot-password", json={
            "email": "test@example.com",
        })
        assert response.status_code == 200
        mock_email.assert_called_once()


class TestResetPassword:
    def test_reset_password_success(self, client, test_user):
        token = create_reset_token(test_user)
        response = client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "NewStrong1234!",
        })
        assert response.status_code == 200

    def test_reset_password_invalid_token(self, client):
        response = client.post("/api/auth/reset-password", json={
            "token": "invalid.token.here",
            "password": "NewStrong1234!",
        })
        assert response.status_code == 400

    def test_reset_password_reuse_rejected(self, client, test_user):
        """Token should be single-use (phash changes after reset)."""
        token = create_reset_token(test_user)
        # First reset succeeds
        client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "NewStrong1234!",
        })
        # Second reset with same token should fail
        response = client.post("/api/auth/reset-password", json={
            "token": token,
            "password": "AnotherStrong1!",
        })
        assert response.status_code == 400
