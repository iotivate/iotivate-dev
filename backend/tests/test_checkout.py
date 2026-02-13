import hashlib
import hmac
import json
from unittest.mock import patch

from sqlmodel import select

from app.models.purchase import Purchase


class TestCheckPurchase:
    def test_requires_auth(self, client):
        response = client.get("/api/purchases/smart-relay")
        assert response.status_code == 401

    def test_not_purchased(self, client, auth_headers, sample_project):
        response = client.get("/api/purchases/smart-relay", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["purchased"] is False

    def test_purchased(self, client, auth_headers, test_user, sample_project, session):
        purchase = Purchase(
            user_id=test_user.id,
            project_id=sample_project.id,
            lemon_order_id="order-123",
            status="paid",
            amount=999,
            currency="USD",
            customer_email=test_user.email,
        )
        session.add(purchase)
        session.commit()

        response = client.get("/api/purchases/smart-relay", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["purchased"] is True

    def test_project_not_found(self, client, auth_headers):
        response = client.get("/api/purchases/nonexistent", headers=auth_headers)
        assert response.status_code == 404


class TestWebhook:
    def _sign(self, body: bytes, secret: str = "test-webhook-secret") -> str:
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    @patch("app.api.checkout.settings")
    def test_missing_signature(self, mock_settings, client):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"
        response = client.post("/api/webhooks/lemonsqueezy", content=b"{}")
        assert response.status_code == 400

    @patch("app.api.checkout.settings")
    def test_invalid_signature(self, mock_settings, client):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"
        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=b"{}",
            headers={"X-Signature": "invalid", "X-Event-Name": "order_created"},
        )
        assert response.status_code == 400

    @patch("app.api.checkout.settings")
    def test_order_created(self, mock_settings, client, test_user, sample_project, session):
        mock_settings.ls_configured = True
        mock_settings.lemonsqueezy_webhook_secret = "test-webhook-secret"

        payload = {
            "meta": {
                "custom_data": {
                    "user_id": str(test_user.id),
                    "project_slug": "smart-relay",
                },
            },
            "data": {
                "id": "order-456",
                "attributes": {
                    "total": 999,
                    "currency": "USD",
                    "user_email": "test@example.com",
                },
            },
        }
        body = json.dumps(payload).encode()
        sig = self._sign(body)

        response = client.post(
            "/api/webhooks/lemonsqueezy",
            content=body,
            headers={
                "X-Signature": sig,
                "X-Event-Name": "order_created",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 200

        purchase = session.exec(
            select(Purchase).where(Purchase.lemon_order_id == "order-456")
        ).first()
        assert purchase is not None
        assert purchase.user_id == test_user.id
        assert purchase.amount == 999
