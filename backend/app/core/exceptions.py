"""Application error types and their HTTP translation.

Services raise these; they know nothing about HTTP. The handlers registered in
`main.py` turn them into a single consistent error envelope, so the frontend
has exactly one error shape to parse:

    {"error": {"code": "ZoneNotFound", "message": "...", "details": {...}}}
"""

from __future__ import annotations

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for every expected failure.

    Anything not derived from this is a genuine bug and is allowed to surface
    as a 500 rather than being quietly reshaped into a friendly message.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BadRequest"

    def __init__(
        self,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if code:
            self.code = code

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            payload["details"] = self.details
        return {"error": payload}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NotFound"


class ConflictError(AppError):
    """A uniqueness or state conflict — a duplicate zone or record set."""

    status_code = status.HTTP_409_CONFLICT
    code = "Conflict"


class ValidationError(AppError):
    """A domain rule was broken (a malformed MX value, an out-of-range TTL)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "ValidationError"


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "Unauthenticated"


class PermissionError_(AppError):
    """Authenticated, but the resource belongs to somebody else.

    Named with a trailing underscore to avoid shadowing the builtin.
    """

    status_code = status.HTTP_403_FORBIDDEN
    code = "Forbidden"


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    headers = (
        {"WWW-Authenticate": "Bearer"}
        if isinstance(exc, AuthenticationError)
        else None
    )
    return JSONResponse(
        status_code=exc.status_code, content=exc.to_payload(), headers=headers
    )


async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Reshape FastAPI's 422 into the same envelope as everything else.

    Field errors are flattened to `{"field.path": "message"}` so the frontend
    can map them straight onto form inputs.
    """
    field_errors: dict[str, str] = {}
    for error in exc.errors():
        # loc looks like ("body", "name") — drop the source segment.
        location = ".".join(str(part) for part in error["loc"][1:]) or "body"
        field_errors.setdefault(location, error["msg"])

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "ValidationError",
                "message": "The request could not be processed.",
                "details": {"fields": field_errors},
            }
        },
    )
