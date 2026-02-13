import logging
import os
import re
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlmodel import Session, select

from app.config import settings
from app.database import engine
from app.api.tools import router as tools_router
from app.api.projects import router as projects_router
from app.api.contact import router as contact_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.upload import router as upload_router
from app.api.checkout import router as checkout_router

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


logger = logging.getLogger("iotivate")


def _bootstrap_admin() -> None:
    """Create admin user from env vars if configured. Idempotent."""
    if not settings.admin_bootstrap_configured:
        return

    from app.auth import hash_password
    from app.models.user import User

    email = settings.admin_email.strip().lower()
    username = settings.admin_username.strip()

    # Basic email validation
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        logger.error("ADMIN_EMAIL is not a valid email address, skipping admin bootstrap")
        return

    if len(username) < 3 or len(username) > 30:
        logger.error("ADMIN_USERNAME must be 3-30 characters, skipping admin bootstrap")
        return

    password = settings.admin_password
    if len(password) < 8:
        logger.error("ADMIN_PASSWORD must be at least 8 characters, skipping admin bootstrap")
        return

    with Session(engine) as session:
        existing = session.exec(
            select(User).where((User.email == email) | (User.username == username))
        ).first()
        if existing:
            logger.info("Admin user already exists, skipping bootstrap")
            return

        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(password),
            is_admin=True,
        )
        session.add(user)
        session.commit()
        logger.info("Admin user '%s' created via bootstrap", username)


def _run_migrations() -> None:
    """Run Alembic migrations to head."""
    alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    alembic_cfg = AlembicConfig(alembic_ini)
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    _bootstrap_admin()
    yield


app = FastAPI(
    title="iotivate.dev API",
    description="Backend API for iotivate.dev — IoT tools and project platform.",
    version="0.1.0",
    lifespan=lifespan,
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(tools_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(contact_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(checkout_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
