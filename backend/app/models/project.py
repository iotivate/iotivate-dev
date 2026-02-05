from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=200)
    description: str = Field(max_length=2000)
    tags: str = Field(default="", max_length=500)
