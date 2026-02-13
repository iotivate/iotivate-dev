import sys

from pydantic_settings import BaseSettings

_INSECURE_DEFAULTS = {"change-me-in-production", "secret", "changeme", ""}


class Settings(BaseSettings):
    database_url: str = "sqlite:///./iotivate.db"
    secret_key: str
    cors_origins: str = "http://localhost:3000"

    # Cloudflare R2 settings
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "iotivate-files"
    r2_public_url: str = ""  # e.g., https://files.iotivate.dev

    # Admin bootstrap settings (set all three to auto-create admin on startup)
    admin_email: str = ""
    admin_username: str = ""
    admin_password: str = ""

    # SMTP settings (for contact form notifications)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_to_email: str = ""
    smtp_use_tls: bool = True

    # Logging
    log_level: str = "INFO"

    # Frontend URL (for password reset links)
    frontend_url: str = "http://localhost:3000"

    # Lemon Squeezy settings
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""
    lemonsqueezy_webhook_secret: str = ""

    @property
    def ls_configured(self) -> bool:
        return bool(
            self.lemonsqueezy_api_key
            and self.lemonsqueezy_store_id
            and self.lemonsqueezy_webhook_secret
        )

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password and self.smtp_to_email)

    @property
    def admin_bootstrap_configured(self) -> bool:
        return bool(self.admin_email and self.admin_username and self.admin_password)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

if settings.secret_key in _INSECURE_DEFAULTS:
    print("FATAL: SECRET_KEY is missing or set to an insecure default. Set a strong SECRET_KEY in .env")
    sys.exit(1)
