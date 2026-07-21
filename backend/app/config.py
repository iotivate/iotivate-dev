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

    # Refresh-cookie domain. Empty = host-only (current single-domain / local
    # dev behavior). Set to ".iotivate.dev" (leading dot) in production so the
    # refresh cookie is shared across subdomains and one login works on both
    # iotivate.dev and radar.iotivate.dev. See docs/RADAR_PRODUCT_SPEC.md §4.
    cookie_domain: str = ""

    # Lemon Squeezy settings
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""
    lemonsqueezy_webhook_secret: str = ""
    lemonsqueezy_pro_monthly_variant_id: str = ""
    lemonsqueezy_pro_yearly_variant_id: str = ""

    @property
    def ls_configured(self) -> bool:
        return bool(
            self.lemonsqueezy_api_key
            and self.lemonsqueezy_store_id
            and self.lemonsqueezy_webhook_secret
        )

    @property
    def pro_subscription_configured(self) -> bool:
        return bool(
            self.ls_configured
            and self.lemonsqueezy_pro_monthly_variant_id
            and self.lemonsqueezy_pro_yearly_variant_id
        )

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password and self.smtp_to_email)

    @property
    def smtp_validation_errors(self) -> list[str]:
        """Return list of SMTP configuration issues for debugging."""
        errors = []
        if not self.smtp_host:
            errors.append("SMTP_HOST not set")
        if not self.smtp_user:
            errors.append("SMTP_USER not set")
        if not self.smtp_password:
            errors.append("SMTP_PASSWORD not set")
        if not self.smtp_to_email:
            errors.append("SMTP_TO_EMAIL not set")
        if self.smtp_port not in [25, 465, 587]:
            errors.append(f"SMTP_PORT ({self.smtp_port}) should be 25, 465, or 587")
        if self.smtp_user and "@" not in self.smtp_user:
            errors.append("SMTP_USER should be a full email address")
        if self.smtp_from_email and "@" not in self.smtp_from_email:
            errors.append("SMTP_FROM_EMAIL should be a full email address")
        if self.smtp_to_email and "@" not in self.smtp_to_email:
            errors.append("SMTP_TO_EMAIL should be a full email address")
        return errors

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
