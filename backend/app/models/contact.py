from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class ContactMessage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    email: str = Field(max_length=255)
    message: str = Field(max_length=5000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
