from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlmodel import Session, select

from app.database import get_session
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/")
def list_projects(session: Session = Depends(get_session)) -> list[Project]:
    return session.exec(select(Project)).all()


@router.get("/{slug}")
def get_project(
    slug: str = Path(max_length=100, pattern=r"^[a-z0-9-]+$"),
    session: Session = Depends(get_session),
) -> Project:
    project = session.exec(select(Project).where(Project.slug == slug)).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
