"""Auth request and response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AuthProvider


class UserProfile(BaseModel):
    """The signed-in user, as the console header renders them."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str | None
    photo_url: str | None
    provider: AuthProvider
    aws_account_id: str = Field(description="Mocked AWS account number.")
    last_login_at: datetime | None
    created_at: datetime

    @property
    def is_demo(self) -> bool:
        return self.provider is AuthProvider.DEMO


class DemoLoginResponse(BaseModel):
    """The demo path's token, mirroring what Firebase hands the client."""

    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserProfile


class SessionResponse(BaseModel):
    """`GET /auth/me` — used on boot to restore a persisted session."""

    user: UserProfile


class AuthConfigResponse(BaseModel):
    """What the login screen needs to know before rendering.

    Lets the frontend hide the Google button when the server has no Firebase
    credential, instead of showing a button that fails when clicked.
    """

    google_enabled: bool
    demo_enabled: bool = True
