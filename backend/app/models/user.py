"""The `users` table — one row per authenticated identity."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UtcDateTime
from app.models.enums import AuthProvider

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone


class User(Base, TimestampMixin):
    """An authenticated console user.

    Firebase owns authentication; this table owns *identity within the app*.
    `firebase_uid` is the join between the two — for demo sessions it is a
    fixed sentinel rather than a Google-issued uid, so both login paths produce
    the same shape of row and nothing downstream needs to special-case them.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    firebase_uid: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    photo_url: Mapped[str | None] = mapped_column(String(1024))

    provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, native_enum=False, length=16),
        default=AuthProvider.GOOGLE,
        nullable=False,
    )

    #: Mocked AWS account number shown in the top navigation. Generated once
    #: per user and stable thereafter, because it appears in the UI.
    aws_account_id: Mapped[str] = mapped_column(String(12), nullable=False)

    #: Set when the seeder has populated this user's starter zones, so a
    #: returning user who deleted everything is not silently re-seeded.
    seeded_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_login_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    hosted_zones: Mapped[list["HostedZone"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def is_demo(self) -> bool:
        return self.provider is AuthProvider.DEMO

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User id={self.id} email={self.email!r} provider={self.provider}>"
