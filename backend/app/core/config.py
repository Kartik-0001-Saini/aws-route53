"""Application settings, loaded once from the environment at import time."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Typed view of `backend/.env`.

    Every value has a development-safe default so the app boots on a fresh
    clone with no `.env` at all. The only setting that *must* change for
    production is `DEMO_TOKEN_SECRET`.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ------------------------------------------------------------
    PROJECT_NAME: str = "Route 53 Clone API"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # ---- Database -------------------------------------------------------
    DATABASE_URL: str = "sqlite:///./data/route53.db"

    # ---- CORS -----------------------------------------------------------
    CORS_ORIGINS: str = "http://localhost:3000"

    # ---- Firebase -------------------------------------------------------
    # Empty means "Google sign-in disabled"; the demo login path still works,
    # which is what lets the app run before Firebase has been set up.
    FIREBASE_SERVICE_ACCOUNT_B64: str = ""
    FIREBASE_PROJECT_ID: str = ""

    # ---- Demo user ------------------------------------------------------
    DEMO_TOKEN_SECRET: str = "insecure-development-secret"
    DEMO_USER_EMAIL: str = "demo@route53-clone.dev"
    DEMO_USER_NAME: str = "Demo User"
    DEMO_SESSION_TTL_HOURS: int = 12

    @field_validator("DATABASE_URL")
    @classmethod
    def _resolve_sqlite_path(cls, value: str) -> str:
        """Anchor relative SQLite paths to `backend/`, not the working directory.

        Without this, `uvicorn` started from the repo root and from `backend/`
        would silently open two different database files.
        """
        prefix = "sqlite:///./"
        if not value.startswith(prefix):
            return value

        db_path = BACKEND_ROOT / value[len(prefix) :]
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        """CORS origins as a list, tolerant of trailing slashes and blanks."""
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def firebase_enabled(self) -> bool:
        return bool(self.FIREBASE_SERVICE_ACCOUNT_B64.strip())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached accessor — the environment is read exactly once per process."""
    return Settings()


settings = get_settings()
