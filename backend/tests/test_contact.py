from unittest.mock import patch


class TestContactForm:
    @patch("app.api.contact.send_contact_notification")
    def test_valid_submission(self, mock_email, client):
        response = client.post("/api/contact/", json={
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Hello, I have a question about your IoT tools.",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "ok"
        mock_email.assert_called_once_with(
            "John Doe", "john@example.com", "Hello, I have a question about your IoT tools."
        )

    def test_invalid_email(self, client):
        response = client.post("/api/contact/", json={
            "name": "John Doe",
            "email": "not-an-email",
            "message": "Hello, this is a test message.",
        })
        assert response.status_code == 422

    def test_missing_name(self, client):
        response = client.post("/api/contact/", json={
            "email": "john@example.com",
            "message": "Hello, this is a test message.",
        })
        assert response.status_code == 422

    def test_missing_message(self, client):
        response = client.post("/api/contact/", json={
            "name": "John Doe",
            "email": "john@example.com",
        })
        assert response.status_code == 422

    def test_message_too_short(self, client):
        response = client.post("/api/contact/", json={
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Short",
        })
        assert response.status_code == 422
