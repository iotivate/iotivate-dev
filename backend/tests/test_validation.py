"""Schema-level validation edge cases."""


class TestRegisterValidation:
    def test_username_special_chars(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "user@name!",
            "password": "Strong1234!",
        })
        assert response.status_code == 422

    def test_password_no_uppercase(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "nouppercase1!",
        })
        assert response.status_code == 422

    def test_password_no_digit(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "NoDigitsHere!",
        })
        assert response.status_code == 422

    def test_password_no_special_char(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "NoSpecial123",
        })
        assert response.status_code == 422

    def test_password_too_short(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "Sh0rt!",
        })
        assert response.status_code == 422

    def test_username_too_short(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "ab",
            "password": "Strong1234!",
        })
        assert response.status_code == 422


class TestContactValidation:
    def test_message_too_short(self, client):
        response = client.post("/api/contact/", json={
            "name": "John",
            "email": "john@example.com",
            "message": "Short",
        })
        assert response.status_code == 422

    def test_name_too_long(self, client):
        response = client.post("/api/contact/", json={
            "name": "A" * 101,
            "email": "john@example.com",
            "message": "This is a valid length message for testing.",
        })
        assert response.status_code == 422


class TestCheckoutValidation:
    def test_invalid_slug_pattern(self, client, auth_headers):
        response = client.post("/api/checkout", headers=auth_headers, json={
            "project_slug": "INVALID SLUG!",
        })
        assert response.status_code == 422
