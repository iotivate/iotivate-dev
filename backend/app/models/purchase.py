from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Purchase(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    lemon_order_id: str = Field(unique=True, index=True, max_length=50)
    status: str = Field(default="paid", max_length=20)  # "paid", "refunded"
    amount: int = Field(ge=0)  # cents
    currency: str = Field(default="USD", max_length=10)
    customer_email: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
