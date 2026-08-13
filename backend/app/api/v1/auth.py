"""Authentication endpoints.

Sign-in itself happens in the browser against Firebase; this router only
verifies the resulting token, mints the demo equivalent, and reports what the
login screen is allowed to offer.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.security import (
    DEMO_UID,
    VerifiedIdentity,
    is_firebase_ready,
    issue_demo_token,
)
from app.models.enums import AuthProvider
from app.schemas.auth import (
    AuthConfigResponse,
    DemoLoginResponse,
    SessionResponse,
    UserProfile,
)
from app.schemas.common import MessageResponse
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/config",
    response_model=AuthConfigResponse,
    summary="Which sign-in methods this server supports",
)
def get_auth_config() -> AuthConfigResponse:
    """Tell the login screen whether to render the Google button.

    Without this the frontend would show a button that fails on click whenever
    the server has no Firebase credential configured.
    """
    return AuthConfigResponse(google_enabled=is_firebase_ready(), demo_enabled=True)


@router.post(
    "/demo",
    response_model=DemoLoginResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a demo session",
)
def demo_login(db: DbSession) -> DemoLoginResponse:
    """Sign in as the shared demo user.

    Exists so the hosted demo can be opened by anyone without a Google account,
    a popup blocker, or a Workspace policy standing in the way. The token it
    returns is presented exactly like a Firebase one, so the rest of the API
    has no notion of a "demo request".
    """
    token, expires_at = issue_demo_token()

    identity = VerifiedIdentity(
        uid=DEMO_UID,
        email=settings.DEMO_USER_EMAIL,
        display_name=settings.DEMO_USER_NAME,
        photo_url=None,
        provider=AuthProvider.DEMO,
    )
    user = user_service.resolve_user(db, identity)

    return DemoLoginResponse(
        access_token=token,
        expires_at=expires_at,
        user=UserProfile.model_validate(user),
    )


@router.get(
    "/me",
    response_model=SessionResponse,
    summary="The signed-in user",
)
def get_me(current_user: CurrentUser) -> SessionResponse:
    """Restore a session on page load.

    The frontend calls this on boot with whatever token it has persisted; a
    401 means the stored session is gone and the login screen is shown.
    """
    return SessionResponse(user=UserProfile.model_validate(current_user))


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="End the session",
)
def logout(current_user: CurrentUser) -> MessageResponse:
    """Acknowledge sign-out.

    Both token types are stateless and short-lived, so there is nothing to
    revoke server-side; the client discards the token. The endpoint exists so
    the frontend has one logout path and the action can be audited later
    without changing the client.
    """
    return MessageResponse(message=f"Signed out {current_user.email}.")
