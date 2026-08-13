"""FastAPI application factory and entry point.

Run locally with:

    cd backend
    .\\venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    validation_error_handler,
)
from app.core.security import init_firebase, is_firebase_ready

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Start-up and shut-down.

    Firebase is initialised once here rather than lazily on the first request,
    so a bad service-account credential shows up in the boot log instead of as
    a puzzling 401 later.
    """
    init_firebase()
    logger.info(
        "%s starting — environment=%s, google_sign_in=%s",
        settings.PROJECT_NAME,
        settings.ENVIRONMENT,
        "enabled" if is_firebase_ready() else "disabled",
    )
    yield
    logger.info("%s shutting down", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description=(
            "Backend for an AWS Route 53 console clone. Hosted zones and DNS "
            "records are fully persisted; no DNS resolution is performed."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Exact origins, never a wildcard: credentials are sent with every request
    # and browsers reject `*` when they are.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["Health"], status_code=status.HTTP_200_OK)
    def health() -> dict[str, object]:
        """Liveness probe, also used by the frontend to warm a sleeping host."""
        return {
            "status": "ok",
            "environment": settings.ENVIRONMENT,
            "google_sign_in": is_firebase_ready(),
        }

    return app


app = create_app()
