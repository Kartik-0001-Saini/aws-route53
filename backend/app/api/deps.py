"""Shared FastAPI dependencies.

`CurrentUser` is the single place a request's identity is established. Nothing
else in the codebase reads the Authorization header, and no endpoint accepts a
user id from the client.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError
from app.core.security import verify_token
from app.db.session import get_db
from app.models import HostedZone, User
from app.schemas.common import PageParams
from app.services import hosted_zone_service, user_service

# auto_error=False so a missing header raises our own error envelope rather
# than FastAPI's bare {"detail": "Not authenticated"}.
_bearer_scheme = HTTPBearer(auto_error=False, description="Firebase ID token or demo session token.")

DbSession = Annotated[Session, Depends(get_db)]
Paging = Annotated[PageParams, Depends()]


def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
    ],
) -> User:
    """Verify the Bearer token and resolve it to a local user row."""
    if credentials is None:
        raise AuthenticationError("Sign in to continue.")

    identity = verify_token(credentials.credentials)
    return user_service.resolve_user(db, identity)


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_zone(
    zone_id: str, db: DbSession, current_user: CurrentUser
) -> HostedZone:
    """Resolve the `{zone_id}` path parameter to a zone the caller owns.

    Every record endpoint depends on this, which is what guarantees a record
    can never be reached through a zone belonging to somebody else.
    """
    return hosted_zone_service.get_zone(
        db, user_id=current_user.id, zone_id=zone_id
    )


CurrentZone = Annotated[HostedZone, Depends(get_current_zone)]


def get_client_ip(request: Request) -> str:
    """Best-effort client IP, honouring the proxy header set by the host.

    Only the first entry of `X-Forwarded-For` is trusted, and only for logging
    — nothing authorises on it.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
