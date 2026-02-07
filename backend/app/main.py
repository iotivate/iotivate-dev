from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import create_db_and_tables
from app.api.tools import router as tools_router
from app.api.projects import router as projects_router
from app.api.contact import router as contact_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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


@app.get("/health")
def health():
    return {"status": "ok"}
