import json
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from fastapi.testclient import TestClient

from app.auth import create_access_token, hash_password
from app.database import get_session
from app.main import app
from app.models.user import User
from app.models.tool import Tool
from app.models.project import Project
from app.models.contact import ContactMessage
from app.models.purchase import Purchase
from app.models.webhook_event import WebhookEvent


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


def _all_limiters():
    """Every slowapi Limiter instance currently alive. Each router module makes
    its own, so discover them by type rather than hard-coding imports (stays
    correct as routers are added or removed)."""
    import gc

    from slowapi import Limiter

    return [obj for obj in gc.get_objects() if isinstance(obj, Limiter)]


@pytest.fixture(name="client")
def client_fixture(session):
    def get_session_override():
        yield session

    app.dependency_overrides[get_session] = get_session_override

    # Disable rate limiting for tests. Each router instantiates its own slowapi
    # Limiter (checked via `.enabled` at request time), and the app config key
    # controls them all, so flip both: the config (covers every limiter) and
    # each instance we can reach. Without this, cross-test request volume trips
    # per-endpoint limits and later tests fail spuriously.
    app.state.limiter.enabled = False
    limiters = _all_limiters()
    original = [(lim, lim.enabled) for lim in limiters]
    for lim in limiters:
        lim.enabled = False

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client

    for lim, was in original:
        lim.enabled = was
    app.dependency_overrides.clear()


@pytest.fixture(name="test_user")
def test_user_fixture(session):
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=hash_password("Test1234!"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="admin_user")
def admin_user_fixture(session):
    user = User(
        email="admin@example.com",
        username="adminuser",
        hashed_password=hash_password("Admin1234!"),
        is_admin=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(test_user):
    token = create_access_token({"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="admin_headers")
def admin_headers_fixture(admin_user):
    token = create_access_token({"sub": admin_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="pro_user")
def pro_user_fixture(session):
    user = User(
        email="pro@example.com",
        username="prouser",
        hashed_password=hash_password("Pro1234!"),
        lemon_subscription_id="sub-123",
        subscription_status="active",
        subscription_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
        subscription_updated_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="pro_headers")
def pro_headers_fixture(pro_user):
    token = create_access_token({"sub": pro_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="sample_tool")
def sample_tool_fixture(session):
    tool = Tool(
        slug="serial-monitor",
        name="Serial Monitor",
        description="A web-based serial monitor for IoT devices.",
        status="active",
    )
    session.add(tool)
    session.commit()
    session.refresh(tool)
    return tool


@pytest.fixture(name="sample_project")
def sample_project_fixture(session):
    project = Project(
        slug="smart-relay",
        name="Smart Relay",
        description="An ESP32-based smart relay controller.",
        tags="esp32,relay,iot",
        is_published=True,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@pytest.fixture(name="unpublished_project")
def unpublished_project_fixture(session):
    project = Project(
        slug="secret-project",
        name="Secret Project",
        description="An unpublished project.",
        tags="hidden",
        is_published=False,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@pytest.fixture(name="project_with_firmware")
def project_with_firmware_fixture(session):
    firmware_data = {
        "name": "Smart Relay Firmware",
        "version": "1.0.0",
        "price": 9.99,
        "currency": "USD",
        "features": ["OTA updates"],
        "variantId": "variant-123",
    }
    project = Project(
        slug="paid-project",
        name="Paid Project",
        description="A project with purchasable firmware.",
        tags="esp32",
        is_published=True,
        firmware_json=json.dumps(firmware_data),
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project
