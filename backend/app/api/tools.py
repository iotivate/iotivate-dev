from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.database import get_session
from app.models.tool import Tool

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("/")
def list_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> dict:
    total = session.exec(select(func.count()).select_from(Tool)).one()
    tools = session.exec(select(Tool).offset(skip).limit(limit)).all()
    return {
        "items": [t.model_dump() for t in tools],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{slug}")
def get_tool(
    slug: str = Path(max_length=100, pattern=r"^[a-z0-9-]+$"),
    session: Session = Depends(get_session),
) -> Tool:
    tool = session.exec(select(Tool).where(Tool.slug == slug)).first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return tool
