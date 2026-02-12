from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=200)
    description: str = Field(max_length=2000)
    tags: str = Field(default="", max_length=500)

    # Extended content (stored as JSON strings)
    youtube_id: str | None = Field(default=None, max_length=50)
    overview: str | None = Field(default=None)  # HTML content
    parts_json: str | None = Field(default=None)  # JSON array of parts
    downloads_json: str | None = Field(default=None)  # JSON array of downloads
    circuit_json: str | None = Field(default=None)  # JSON object for circuit
    build_guide_json: str | None = Field(default=None)  # JSON array of steps
    firmware_json: str | None = Field(default=None)  # JSON object for firmware
    app_json: str | None = Field(default=None)  # JSON object for app
    support_json: str | None = Field(default=None)  # JSON object for support

    # Status
    is_published: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
