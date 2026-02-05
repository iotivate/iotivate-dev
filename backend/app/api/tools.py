from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlmodel import Session, select

from app.database import get_session
from app.models.tool import Tool

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("/")
def list_tools(session: Session = Depends(get_session)) -> list[Tool]:
    return session.exec(select(Tool)).all()


@router.get("/{slug}")
def get_tool(
    slug: str = Path(max_length=100, pattern=r"^[a-z0-9-]+$"),
    session: Session = Depends(get_session),
) -> Tool:
    tool = session.exec(select(Tool).where(Tool.slug == slug)).first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return tool
