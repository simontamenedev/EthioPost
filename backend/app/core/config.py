from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/  (this file is backend/app/core/config.py)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # .env is read from backend/ no matter which folder uvicorn is started from.
    # Real environment variables override the file.
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "EthioPost API"
    app_description: str = "Starter API for the EthioPost delivery dashboard."
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    # No default on purpose: a missing DATABASE_URL fails at startup instead of
    # silently creating a SQLite file.
    # e.g. postgresql+psycopg://postgres:PASSWORD@localhost:5432/ethiopost
    database_url: str

    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # password reset + email
    frontend_url: str = "http://localhost:3000"
    reset_token_expire_minutes: int = 30

    smtp_host: str = ""            # empty = don't send, just log the link (dev)
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Post Finance <no-reply@example.com>"
    smtp_use_ssl: bool = False     # True for port 465, otherwise STARTTLS

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()