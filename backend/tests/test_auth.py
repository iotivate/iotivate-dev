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


from app.config import settings  # noqa: E402
from app.models.user import User  # noqa: E402
from sqlmodel import select  # noqa: E402


def _google_claims(email="ada@example.com", sub="google-sub-123", name="Ada Lovelace", verified=True):
    return {
        "sub": sub, "email": email, "email_verified": verified,
        "name": name, "iss": "https://accounts.google.com",
    }


class TestGoogleAuth:
    def test_google_not_configured_returns_503(self, client):
        # settings.google_client_id defaults to "" in tests
        r = client.post("/api/auth/google", json={"credential": "x.y.z"})
        assert r.status_code == 503

    def test_google_new_user_created(self, client, session):
        with patch.object(settings, "google_client_id", "test-client"), \
             patch("app.api.auth.verify_google_token", return_value=_google_claims()):
            r = client.post("/api/auth/google", json={"credential": "tok"})
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()
        user = session.exec(select(User).where(User.email == "ada@example.com")).first()
        assert user is not None
        assert user.google_id == "google-sub-123"
        assert user.hashed_password is None  # passwordless social account

    def test_google_links_existing_email_account(self, client, session, test_user):
        claims = _google_claims(email="test@example.com", sub="sub-999")
        with patch.object(settings, "google_client_id", "test-client"), \
             patch("app.api.auth.verify_google_token", return_value=claims):
            r = client.post("/api/auth/google", json={"credential": "tok"})
        assert r.status_code == 200, r.text
        user = session.exec(select(User).where(User.email == "test@example.com")).first()
        assert user.google_id == "sub-999"  # linked to the existing account
        assert user.hashed_password is not None  # password preserved

    def test_google_invalid_token_returns_401(self, client):
        with patch.object(settings, "google_client_id", "test-client"), \
             patch("app.api.auth.verify_google_token", side_effect=ValueError("bad")):
            r = client.post("/api/auth/google", json={"credential": "bad"})
        assert r.status_code == 401

    def test_google_only_user_cannot_password_login(self, client, session):
        with patch.object(settings, "google_client_id", "test-client"), \
             patch("app.api.auth.verify_google_token", return_value=_google_claims(email="x@example.com", sub="s1")):
            client.post("/api/auth/google", json={"credential": "tok"})
        user = session.exec(select(User).where(User.email == "x@example.com")).first()
        # Passwordless account must not be loggable via the password endpoint
        r = client.post("/api/auth/login", data={"username": user.username, "password": "Whatever1!"})
        assert r.status_code == 401
