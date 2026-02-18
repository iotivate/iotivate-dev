import hashlib
import hmac
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from sqlmodel import select

from app.models.user import User
from app.models.webhook_event import WebhookEvent


def _sign(body: bytes, secret: str = "test-webhook-secret") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class TestIsProProperty:
    def test_active_subscription_is_pro(self, session):
        user = User(
            email="a@b.com", username="u1", hashed_password="x",
            subscription_status="active",
        )
        assert user.is_pro is True

    def test_on_trial_is_pro(self, session):
        user = User(
            email="a@b.com", username="u2", hashed_password="x",
            subscription_status="on_trial",
        )
        assert user.is_pro is True

    def test_cancelled_with_future_end_date_is_pro(self, session):
        user = User(
            email="a@b.com", username="u3", hashed_password="x",
            subscription_status="cancelled",
            subscription_ends_at=datetime.now(timezone.utc) + timedelta(days=10),
        )
        assert user.is_pro is True

    def test_cancelled_with_past_end_date_is_not_pro(self, session):
        user = User(
            email="a@b.com", username="u4", hashed_password="x",
            subscription_status="cancelled",
            subscription_ends_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        assert user.is_pro is False

    def test_expired_is_not_pro(self, session):
        user = User(
            email="a@b.com", username="u5", hashed_password="x",
            subscription_status="expired",
        )
        assert user.is_pro is False

    def test_no_subscription_is_not_pro(self, session):
        user = User(
            email="a@b.com", username="u6", hashed_password="x",
        )
        assert user.is_pro is False

    def test_past_due_is_not_pro(self, session):
        user = User(
            email="a@b.com", username="u7", hashed_password="x",
            subscription_status="past_due",
        )
        assert user.is_pro is False

    def test_paused_is_not_pro(self, session):
        user = User(
            email="a@b.com", username="u8", hashed_password="x",
            subscription_status="paused",
        )
        assert user.is_pro is False


class TestSubscribeEndpoint:
    @patch("app.api.checkout.settings")
    def test_subscribe_requires_auth(self, mock_settings, client):
        response = client.post("/api/subscribe", json={"plan": "monthly"})
        assert response.status_code == 401

    @patch("app.api.checkout.settings")
    def test_subscribe_invalid_plan(self, mock_settings, client, auth_headers):
        mock_settings.pro_subscription_configured = True
        response = client.post(
            "/api/subscribe", json={"plan": "weekly"}, headers=auth_headers
        )
        assert response.status_code == 422

    @patch("app.api.checkout.settings")
    def test_subscribe_not_configured(self, mock_settings, client, auth_headers):
        mock_settings.pro_subscription_configured = False
        response = client.post(
            "/api/subscribe", json={"plan": "monthly"}, headers=auth_headers
        )
        assert response.status_code == 503

    @patch("app.api.checkout.settings")
    def test_subscribe_already_pro(self, mock_settings, client, pro_headers):
        mock_settings.pro_subscription_configured = True
        response = client.post(
            "/api/subscribe", json={"plan": "monthly"}, headers=pro_headers
        )
        assert response.status_code == 409

    @patch("app.api.checkout.httpx.Client")
    @patch("app.api.checkout.settings")
    def test_subscribe_success_monthly(self, mock_settings, mock_httpx_client, client, auth_headers):
        mock_settings.pro_subscription_configured = True
        mock_settings.lemonsqueezy_api_key = "test-key"
        mock_settings.lemonsqueezy_store_id = "test-store"
        mock_settings.lemonsqueezy_pro_monthly_variant_id = "variant-monthly"
        mock_settings.lemonsqueezy_pro_yearly_variant_id = "variant-yearly"
        mock_settings.cors_origin_list = ["https://iotivate.dev"]

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "data": {"attributes": {"url": "https://checkout.lemonsqueezy.com/test"}}
        }
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.post.return_value = mock_response
        mock_httpx_client.return_value = mock_ctx

        response = client.post(
            "/api/subscribe", json={"plan": "monthly"}, headers=auth_headers
        )
        assert response.status_code == 200
        assert "checkout.lemonsqueezy.com" in response.json()["url"]

        # Verify variant ID used
        call_args = mock_ctx.post.call_args
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        variant_id = payload["data"]["relationships"]["variant"]["data"]["id"]
        assert variant_id == "variant-monthly"

    @patch("app.api.checkout.httpx.Client")
    @patch("app.api.checkout.settings")
    def test_subscribe_success_yearly(self, mock_settings, mock_httpx_client, client, auth_headers):
        mock_settings.pro_subscription_configured = True
        mock_settings.lemonsqueezy_api_key = "test-key"
        mock_settings.lemonsqueezy_store_id = "test-store"
        mock_settings.lemonsqueezy_pro_monthly_variant_id = "variant-monthly"
        mock_settings.lemonsqueezy_pro_yearly_variant_id = "variant-yearly"
        mock_settings.cors_origin_list = ["https://iotivate.dev"]

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "data": {"attributes": {"url": "https://checkout.lemonsqueezy.com/yearly"}}
        }
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.post.return_value = mock_response
        mock_httpx_client.return_value = mock_ctx

        response = client.post(
            "/api/subscribe", json={"plan": "yearly"}, headers=auth_headers
        )
        assert response.status_code == 200

        call_args = mock_ctx.post.call_args
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        variant_id = payload["data"]["relationships"]["variant"]["data"]["id"]
        assert variant_id == "variant-yearly"


class TestSubscriptionStatus:
    def test_status_requires_auth(self, client):
        response = client.get("/api/subscription")
        assert response.status_code == 401

    def test_status_no_subscription(self, client, auth_headers):
        response = client.get("/api/subscription", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_pro"] is False
        assert data["subscription_status"] is None
        assert data["subscription_ends_at"] is None

    def test_status_active_subscription(self, client, pro_headers):
        response = client.get("/api/subscription", headers=pro_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_pro"] is True
        assert data["subscription_status"] == "active"
        assert data["subscription_ends_at"] is not None


class TestSubscriptionWebhooks:
    @patch("app.api.checkout.settings")
    def test_subscription_created(self, mock_settings, client, session, test_user):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        ends_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        payload = {
            "meta": {"custom_data": {"user_id": str(test_user.id), "checkout_type": "subscription"}},
            "data": {
                "id": "sub-456",
                "attributes": {"status": "active", "ends_at": ends_at},
            },
        }
        body = json.dumps(payload).encode()

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": _sign(body),
                "X-Event-Name": "subscription_created",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        session.refresh(test_user)
        assert test_user.lemon_subscription_id == "sub-456"
        assert test_user.subscription_status == "active"
        assert test_user.is_pro is True

        event = session.exec(select(WebhookEvent)).first()
        assert event.status == "processed"

    @patch("app.api.checkout.settings")
    def test_subscription_cancelled(self, mock_settings, client, session, pro_user):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        future_end = (datetime.now(timezone.utc) + timedelta(days=15)).isoformat()
        payload = {
            "meta": {"custom_data": {}},
            "data": {
                "id": pro_user.lemon_subscription_id,
                "attributes": {"status": "cancelled", "ends_at": future_end},
            },
        }
        body = json.dumps(payload).encode()

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": _sign(body),
                "X-Event-Name": "subscription_cancelled",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        session.refresh(pro_user)
        assert pro_user.subscription_status == "cancelled"
        # Still pro because ends_at is in the future (grace period)
        assert pro_user.is_pro is True

    @patch("app.api.checkout.settings")
    def test_subscription_expired(self, mock_settings, client, session, pro_user):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        past_end = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        payload = {
            "meta": {"custom_data": {}},
            "data": {
                "id": pro_user.lemon_subscription_id,
                "attributes": {"status": "expired", "ends_at": past_end},
            },
        }
        body = json.dumps(payload).encode()

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": _sign(body),
                "X-Event-Name": "subscription_expired",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        session.refresh(pro_user)
        assert pro_user.subscription_status == "expired"
        assert pro_user.is_pro is False

    @patch("app.api.checkout.settings")
    def test_subscription_resumed(self, mock_settings, client, session, pro_user):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        # First cancel
        pro_user.subscription_status = "cancelled"
        session.add(pro_user)
        session.commit()

        future_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        payload = {
            "meta": {"custom_data": {}},
            "data": {
                "id": pro_user.lemon_subscription_id,
                "attributes": {"status": "active", "ends_at": future_end},
            },
        }
        body = json.dumps(payload).encode()

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": _sign(body),
                "X-Event-Name": "subscription_resumed",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        session.refresh(pro_user)
        assert pro_user.subscription_status == "active"
        assert pro_user.is_pro is True

    @patch("app.api.checkout.settings")
    def test_subscription_payment_failed(self, mock_settings, client, session, pro_user):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        payload = {
            "meta": {"custom_data": {}},
            "data": {
                "id": pro_user.lemon_subscription_id,
                "attributes": {"status": "past_due"},
            },
        }
        body = json.dumps(payload).encode()

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": _sign(body),
                "X-Event-Name": "subscription_payment_failed",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        session.refresh(pro_user)
        assert pro_user.subscription_status == "past_due"
        assert pro_user.is_pro is False


class TestCustomerPortal:
    def test_portal_requires_auth(self, client):
        response = client.post("/api/subscription/portal")
        assert response.status_code == 401

    def test_portal_no_subscription(self, client, auth_headers):
        response = client.post("/api/subscription/portal", headers=auth_headers)
        assert response.status_code == 404

    @patch("app.api.checkout.httpx.Client")
    @patch("app.api.checkout.settings")
    def test_portal_success(self, mock_settings, mock_httpx_client, client, pro_headers):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_api_key = "test-key"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "attributes": {
                    "urls": {"customer_portal": "https://portal.lemonsqueezy.com/test"}
                }
            }
        }
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_response
        mock_httpx_client.return_value = mock_ctx

        response = client.post("/api/subscription/portal", headers=pro_headers)
        assert response.status_code == 200
        assert "portal.lemonsqueezy.com" in response.json()["url"]


class TestAuthMeIncludesIsPro:
    def test_me_returns_is_pro_false(self, client, auth_headers):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_pro"] is False

    def test_me_returns_is_pro_true(self, client, pro_headers):
        response = client.get("/api/auth/me", headers=pro_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_pro"] is True


class TestAdminUsersEndpoint:
    def test_list_users_requires_admin(self, client, auth_headers):
        response = client.get("/api/admin/users", headers=auth_headers)
        assert response.status_code == 403

    def test_list_users(self, client, admin_headers, session):
        response = client.get("/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        user_item = data["items"][0]
        assert "is_pro" in user_item
        assert "subscription_status" in user_item

    def test_list_users_pagination(self, client, admin_headers, session, test_user, pro_user):
        response = client.get("/api/admin/users?skip=0&limit=1", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] >= 3  # admin + test + pro
