from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    username: str = Field(unique=True, index=True, max_length=30)
    hashed_password: str = Field(max_length=255)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)

    # Subscription fields
    lemon_subscription_id: str | None = Field(default=None, index=True, max_length=50)
    subscription_status: str | None = Field(default=None, max_length=30)
    subscription_ends_at: datetime | None = Field(default=None)
    subscription_updated_at: datetime | None = Field(default=None)

    @property
    def is_pro(self) -> bool:
        if self.subscription_status in ("active", "on_trial"):
            return True
        if self.subscription_status == "cancelled" and self.subscription_ends_at:
            ends_at = self.subscription_ends_at
            now = datetime.now(timezone.utc)
            # Handle naive datetimes from SQLite (treat as UTC)
            if ends_at.tzinfo is None:
                ends_at = ends_at.replace(tzinfo=timezone.utc)
            return ends_at > now
        return False
