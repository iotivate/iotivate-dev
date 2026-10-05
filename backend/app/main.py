import logging
import os
import re
import time
import traceback
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
from app.logging_config import setup_logging
from app.api.tools import router as tools_router
from app.api.projects import router as projects_router
from app.api.contact import router as contact_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.upload import router as upload_router
from app.api.checkout import router as checkout_router
from app.api.devices import router as devices_router
from app.api.zones import router as zones_router
from app.api.analytics import router as analytics_router
from app.api.bike import router as bike_router
from app.api.printing import router as printing_router
from app.api.admin_printing import router as admin_printing_router
from app.api.radar_ws import router as radar_ws_router

# Configure logging before anything else
setup_logging(settings.log_level)

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


def _seed_printing() -> None:
    """Seed sensible 3D-printing defaults (editable later in admin). Idempotent —
    only writes when the tables are empty. Numbers are placeholders; set your real
    rate, bed size, and shipping fees in admin."""
    from app.models.printing import PrintColor, PrintFilament, PrintSettings, ShippingZone

    with Session(engine) as session:
        if session.get(PrintSettings, 1) is None:
            session.add(PrintSettings(id=1))  # model defaults

        if session.exec(select(PrintFilament)).first() is None:
            pla = PrintFilament(type="PLA", name="PLA", density_g_cm3=1.24,
                                rate_per_gram=50.0, enabled=True, sort_order=0)
            session.add(pla)
            session.commit()
            session.refresh(pla)
            for cname, chex in [("Black", "#111111"), ("White", "#f5f5f5"),
                                ("Red", "#d7263d"), ("Blue", "#1b6ca8"), ("Grey", "#808080")]:
                session.add(PrintColor(filament_id=pla.id, name=cname, hex=chex))
            # Disabled placeholders — enable + price in admin when stocked.
            session.add(PrintFilament(type="ABS", name="ABS", density_g_cm3=1.04,
                                      rate_per_gram=60.0, enabled=False, sort_order=1))
            session.add(PrintFilament(type="TPU", name="TPU (flexible)", density_g_cm3=1.21,
                                      rate_per_gram=90.0, enabled=False, sort_order=2))

        if session.exec(select(ShippingZone)).first() is None:
            session.add(ShippingZone(name="Abuja (within city)", flat_rate=2500.0, sort_order=0))
            session.add(ShippingZone(name="Other states (Nigeria)", flat_rate=4500.0, sort_order=1))

        session.commit()
    logger.info("3D-printing defaults ensured")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    _bootstrap_admin()
    _seed_printing()
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
async def log_requests(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.error(
            "Unhandled exception during request %s %s\n%s",
            request.method,
            request.url.path,
            traceback.format_exc(),
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    duration_ms = (time.perf_counter() - start) * 1000
    log_msg = "%s %s %d %.1fms"
    log_args = (request.method, request.url.path, response.status_code, duration_ms)

    if response.status_code >= 500:
        logger.error(log_msg, *log_args)
    elif response.status_code >= 400:
        logger.warning(log_msg, *log_args)
    else:
        logger.info(log_msg, *log_args)

    return response


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
app.include_router(devices_router, prefix="/api")
app.include_router(zones_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(bike_router, prefix="/api")
app.include_router(printing_router, prefix="/api")
app.include_router(admin_printing_router, prefix="/api")
# Radar WebSocket routes live at /ws/radar/* (no /api prefix).
app.include_router(radar_ws_router)


@app.get("/health")
def health():
    return {"status": "ok"}
