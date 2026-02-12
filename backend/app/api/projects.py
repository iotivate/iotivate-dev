import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.database import get_session
from app.models.project import Project

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/projects", tags=["projects"])


def _safe_json_load(raw: str | None) -> object:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Corrupt JSON field: %.100s", raw)
        return None


def project_to_dict(project: Project) -> dict:
    """Convert Project model to dict with parsed JSON fields for public API."""
    return {
        "id": project.id,
        "slug": project.slug,
        "name": project.name,
        "description": project.description,
        "tags": project.tags,
        "youtube_id": project.youtube_id,
        "overview": project.overview,
        "is_published": project.is_published,
        "parts": _safe_json_load(project.parts_json),
        "downloads": _safe_json_load(project.downloads_json),
        "circuit": _safe_json_load(project.circuit_json),
        "build_guide": _safe_json_load(project.build_guide_json),
        "firmware": _safe_json_load(project.firmware_json),
        "app": _safe_json_load(project.app_json),
        "support": _safe_json_load(project.support_json),
    }


@router.get("/")
@limiter.limit("30/minute")
def list_projects(request: Request, session: Session = Depends(get_session)) -> list[dict]:
    # Only return published projects for public API
    projects = session.exec(select(Project).where(Project.is_published == True)).all()
    # Return basic info for listing
    return [
        {
            "id": p.id,
            "slug": p.slug,
            "name": p.name,
            "description": p.description,
            "tags": p.tags,
        }
        for p in projects
    ]


@router.get("/{slug}")
@limiter.limit("60/minute")
def get_project(
    request: Request,
    slug: str = Path(max_length=100, pattern=r"^[a-z0-9-]+$"),
    session: Session = Depends(get_session),
) -> dict:
    project = session.exec(select(Project).where(Project.slug == slug)).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not project.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project_to_dict(project)
