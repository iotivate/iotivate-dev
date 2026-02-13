import hashlib
import hmac
import json
from unittest.mock import patch, MagicMock

from sqlmodel import select

from app.models.webhook_event import WebhookEvent


def _sign(body: bytes, secret: str = "test-webhook-secret") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class TestWebhookEventLogging:
    @patch("app.api.checkout.settings")
    def test_order_created_logs_event(self, mock_settings, client, session, test_user, sample_project):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        payload = {
            "meta": {"custom_data": {"user_id": str(test_user.id), "project_slug": sample_project.slug}},
            "data": {
                "id": "order-999",
                "attributes": {"total": 999, "currency": "USD", "user_email": "test@example.com"},
            },
        }
        body = json.dumps(payload).encode()
        signature = _sign(body)

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": signature,
                "X-Event-Name": "order_created",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        event = session.exec(select(WebhookEvent)).first()
        assert event is not None
        assert event.event_name == "order_created"
        assert event.lemon_order_id == "order-999"
        assert event.status == "processed"

    @patch("app.api.checkout.settings")
    def test_order_refunded_logs_event(self, mock_settings, client, session):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        payload = {"data": {"id": "order-456", "attributes": {}}}
        body = json.dumps(payload).encode()
        signature = _sign(body)

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": signature,
                "X-Event-Name": "order_refunded",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        event = session.exec(select(WebhookEvent)).first()
        assert event is not None
        assert event.event_name == "order_refunded"
        assert event.status == "processed"

    @patch("app.api.checkout.settings")
    def test_unknown_event_logged_as_ignored(self, mock_settings, client, session):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        payload = {"data": {"id": "order-789", "attributes": {}}}
        body = json.dumps(payload).encode()
        signature = _sign(body)

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": signature,
                "X-Event-Name": "subscription_updated",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        event = session.exec(select(WebhookEvent)).first()
        assert event is not None
        assert event.event_name == "subscription_updated"
        assert event.status == "ignored"

    @patch("app.api.checkout.settings")
    def test_failed_handler_logs_event_with_failed_status(self, mock_settings, client, session):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        # Missing custom_data fields won't raise, but let's test with a handler patch
        with patch("app.api.checkout._handle_order_created", side_effect=Exception("DB error")):
            payload = {"data": {"id": "order-err", "attributes": {}}}
            body = json.dumps(payload).encode()
            signature = _sign(body)

            response = client.post(
                "/api/webhooks/lemonsqueezy",
                content=body,
                headers={
                    "X-Signature": signature,
                    "X-Event-Name": "order_created",
                    "Content-Type": "application/json",
                },
            )
            assert response.status_code == 200

        event = session.exec(select(WebhookEvent)).first()
        assert event is not None
        assert event.status == "failed"
        assert "DB error" in (event.error_message or "")


class TestAdminWebhookEndpoints:
    def test_list_webhook_events(self, client, admin_headers, session):
        event = WebhookEvent(
            event_name="order_created",
            lemon_order_id="order-1",
            payload_json="{}",
            status="processed",
        )
        session.add(event)
        session.commit()

        response = client.get("/api/admin/webhooks", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["event_name"] == "order_created"

    def test_list_webhook_events_pagination(self, client, admin_headers, session):
        for i in range(5):
            session.add(WebhookEvent(
                event_name=f"event_{i}",
                payload_json="{}",
                status="processed",
            ))
        session.commit()

        response = client.get("/api/admin/webhooks?skip=2&limit=2", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5

    def test_list_webhook_events_requires_admin(self, client, auth_headers):
        response = client.get("/api/admin/webhooks", headers=auth_headers)
        assert response.status_code == 403

    @patch("app.api.admin.httpx.Client")
    @patch("app.api.admin.settings")
    def test_sync_orders(self, mock_settings, mock_httpx_client, client, admin_headers, session):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_api_key = "test-key"
        mock_settings.lemonsqueezy_store_id = "test-store"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"id": "order-1", "attributes": {}},
                {"id": "order-2", "attributes": {}},
            ]
        }
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_response
        mock_httpx_client.return_value = mock_ctx

        response = client.post("/api/admin/webhooks/sync", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_orders"] == 2
        assert data["missing_orders"] == 2

    def test_sync_requires_admin(self, client, auth_headers):
        response = client.post("/api/admin/webhooks/sync", headers=auth_headers)
        assert response.status_code == 403
