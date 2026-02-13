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
