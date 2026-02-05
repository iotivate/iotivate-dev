from enum import Enum

from sqlmodel import SQLModel, Field


class ToolStatus(str, Enum):
    coming_soon = "coming_soon"
    active = "active"
    beta = "beta"
    deprecated = "deprecated"


class Tool(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=200)
    description: str = Field(max_length=2000)
    status: str = Field(default=ToolStatus.coming_soon)
