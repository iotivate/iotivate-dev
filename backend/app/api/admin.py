from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import get_admin_user
from app.database import get_session
from app.models.contact import ContactMessage
from app.models.project import Project
from app.models.tool import Tool, ToolStatus
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


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


class ProjectCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    tags: str = Field(default="", max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tags: str | None = Field(default=None, max_length=500)


# --- Tools CRUD ---

@router.get("/tools")
def list_tools(
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> list[Tool]:
    return session.exec(select(Tool)).all()


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
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> list[Project]:
    return session.exec(select(Project)).all()


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> Project:
    existing = session.exec(select(Project).where(Project.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project with this slug already exists")
    project = Project(**data.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.put("/projects/{project_id}")
def update_project(
    project_id: int,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> None:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    session.delete(project)
    session.commit()


# --- Contacts (read-only + delete) ---

@router.get("/contacts")
def list_contacts(
    session: Session = Depends(get_session),
    _: User = Depends(get_admin_user),
) -> list[ContactMessage]:
    return session.exec(select(ContactMessage).order_by(ContactMessage.created_at.desc())).all()


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


# --- Admin user info ---

@router.get("/me")
def admin_me(user: User = Depends(get_admin_user)) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_admin}
