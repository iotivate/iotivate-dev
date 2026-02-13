import json
import logging
from datetime import datetime, timezone

import bleach
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from app.auth import get_admin_user
from app.config import settings
from app.database import get_session
from app.models.contact import ContactMessage
from app.models.project import Project
from app.models.purchase import Purchase
from app.models.tool import Tool, ToolStatus
from app.models.user import User
from app.models.webhook_event import WebhookEvent
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
)
from app.services.r2_cleanup import extract_r2_urls_from_project, delete_r2_objects

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

ALLOWED_HTML_TAGS = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "strong", "em",
    "code", "pre", "img", "br", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div", "hr",
]

ALLOWED_HTML_ATTRS = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
}


def sanitize_html(html: str | None) -> str | None:
    if html is None:
        return None
    return bleach.clean(html, tags=ALLOWED_HTML_TAGS, attributes=ALLOWED_HTML_ATTRS, strip=True)


# --- Schemas ---

class ToolCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    status: str = Field(default="coming_soon")


class ToolUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = None


# --- Helper functions for JSON conversion ---

def _safe_json_load(raw: str | None) -> object:
    """Parse a JSON string, returning None on corruption instead of crashing."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Corrupt JSON field: %.100s", raw)
        return None


def project_to_response(project: Project) -> dict:
    """Convert Project model to response dict with parsed JSON fields."""
    data = {
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
    return data


def create_data_to_model(data: ProjectCreate) -> dict:
    """Convert ProjectCreate to model fields with JSON serialization."""
    return {
        "slug": data.slug,
        "name": data.name,
        "description": data.description,
        "tags": data.tags,
        "youtube_id": data.youtube_id,
        "overview": data.overview,
        "is_published": data.is_published,
        "parts_json": json.dumps([p.model_dump() for p in data.parts]) if data.parts else None,
        "downloads_json": json.dumps([d.model_dump() for d in data.downloads]) if data.downloads else None,
        "circuit_json": json.dumps(data.circuit.model_dump()) if data.circuit else None,
        "build_guide_json": json.dumps([s.model_dump() for s in data.build_guide]) if data.build_guide else None,
        "firmware_json": json.dumps(data.firmware.model_dump()) if data.firmware else None,
        "app_json": json.dumps(data.app.model_dump()) if data.app else None,
        "support_json": json.dumps(data.support.model_dump()) if data.support else None,
    }


# --- Tools CRUD ---

@router.get("/tools")
def list_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    total = session.exec(select(func.count()).select_from(Tool)).one()
    tools = session.exec(select(Tool).offset(skip).limit(limit)).all()
    return {
        "items": [t.model_dump() for t in tools],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/tools", status_code=status.HTTP_201_CREATED)
def create_tool(
    data: ToolCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> Tool:
    existing = session.exec(select(Tool).where(Tool.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tool with this slug already exists")
    tool = Tool(**data.model_dump())
    session.add(tool)
    session.commit()
    session.refresh(tool)
    return tool


@router.put("/tools/{tool_id}")
def update_tool(
    tool_id: int,
    data: ToolUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> Tool:
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tool, key, value)
    session.add(tool)
    session.commit()
    session.refresh(tool)
    return tool


@router.delete("/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(
    tool_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> None:
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    session.delete(tool)
    session.commit()


# --- Projects CRUD ---

@router.get("/projects")
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    total = session.exec(select(func.count()).select_from(Project)).one()
    projects = session.exec(select(Project).offset(skip).limit(limit)).all()
    return {
        "items": [project_to_response(p) for p in projects],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/projects/{project_id}")
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project_to_response(project)


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    existing = session.exec(select(Project).where(Project.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project with this slug already exists")

    # Sanitize HTML fields
    data.overview = sanitize_html(data.overview)
    if data.build_guide:
        for step in data.build_guide:
            step.content = sanitize_html(step.content) or ""

    model_data = create_data_to_model(data)
    project = Project(**model_data)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project_to_response(project)


@router.put("/projects/{project_id}")
def update_project(
    project_id: int,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Sanitize HTML fields before processing
    if data.overview is not None:
        data.overview = sanitize_html(data.overview)
    if data.build_guide is not None:
        for step in data.build_guide:
            step.content = sanitize_html(step.content) or ""

    update_data = data.model_dump(exclude_unset=True)

    # Handle JSON fields
    json_field_mapping = {
        "parts": "parts_json",
        "downloads": "downloads_json",
        "circuit": "circuit_json",
        "build_guide": "build_guide_json",
        "firmware": "firmware_json",
        "app": "app_json",
        "support": "support_json",
    }

    for key, value in update_data.items():
        if key in json_field_mapping:
            json_key = json_field_mapping[key]
            if value is not None:
                if isinstance(value, list):
                    setattr(project, json_key, json.dumps([v.model_dump() if hasattr(v, 'model_dump') else v for v in value]))
                else:
                    setattr(project, json_key, json.dumps(value.model_dump() if hasattr(value, 'model_dump') else value))
            else:
                setattr(project, json_key, None)
        else:
            setattr(project, key, value)

    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project_to_response(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> None:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    # Clean up R2 files before deleting the project
    r2_urls = extract_r2_urls_from_project(project)
    if r2_urls:
        delete_r2_objects(r2_urls)
    session.delete(project)
    session.commit()


# --- Contacts (read-only + delete) ---

@router.get("/contacts")
def list_contacts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    total = session.exec(select(func.count()).select_from(ContactMessage)).one()
    contacts = session.exec(
        select(ContactMessage).order_by(ContactMessage.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return {
        "items": [c.model_dump() for c in contacts],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> None:
    contact = session.get(ContactMessage, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    session.delete(contact)
    session.commit()


# --- Webhook Events ---

@router.get("/webhooks")
def list_webhook_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    total = session.exec(select(func.count()).select_from(WebhookEvent)).one()
    events = session.exec(
        select(WebhookEvent).order_by(WebhookEvent.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": e.id,
                "event_name": e.event_name,
                "lemon_order_id": e.lemon_order_id,
                "status": e.status,
                "error_message": e.error_message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/webhooks/sync")
def sync_orders(
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> dict:
    if not settings.ls_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lemon Squeezy not configured",
        )

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                "https://api.lemonsqueezy.com/v1/orders",
                headers={
                    "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
                    "Accept": "application/vnd.api+json",
                },
                params={"filter[store_id]": settings.lemonsqueezy_store_id},
            )
    except httpx.RequestError as e:
        logger.error("Lemon Squeezy API request failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach Lemon Squeezy API",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Lemon Squeezy API returned an error",
        )

    orders = resp.json().get("data", [])
    synced = 0

    for order in orders:
        order_id = str(order.get("id", ""))
        if not order_id:
            continue

        existing = session.exec(
            select(Purchase).where(Purchase.lemon_order_id == order_id)
        ).first()
        if not existing:
            synced += 1
            logger.info("Order %s found in Lemon Squeezy but missing from purchases", order_id)

    return {"missing_orders": synced, "total_orders": len(orders)}


# --- Admin user info ---

@router.get("/me")
def admin_me(user: User = Depends(get_admin_user)) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_admin}
