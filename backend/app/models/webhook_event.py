from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class WebhookEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    event_name: str = Field(max_length=100, index=True)
    lemon_order_id: str | None = Field(default=None, max_length=50, index=True)
    payload_json: str = Field(default="")
    status: str = Field(max_length=20, index=True)  # "processed", "failed", "ignored"
    error_message: str | None = Field(default=None, max_length=2000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
