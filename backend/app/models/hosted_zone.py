"""The `hosted_zones` table."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin
from app.models.enums import HostedZoneType

if TYPE_CHECKING:
    from app.models.dns_record import DnsRecord
    from app.models.user import User


class HostedZone(Base, TimestampMixin):
    """A DNS hosted zone, shaped like the Route53 resource.

    `zone_id` is the public identifier used in URLs and the API (`Z…`); the
    integer `id` never leaves the backend. That mirrors Route53 and means a
    zone can be renumbered internally without breaking a bookmarked link.
    """

    __tablename__ = "hosted_zones"
    __table_args__ = (
        # Route53 permits duplicate zone names per account, but only when the
        # types differ (a public and a private zone for the same domain).
        UniqueConstraint("user_id", "name", "type", name="uq_zone_owner_name_type"),
        Index("ix_hosted_zones_user_name", "user_id", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    #: Public, Route53-style identifier: "Z" + 21 uppercase base32 characters.
    zone_id: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    #: Always stored with the trailing dot stripped and lower-cased, so
    #: "Example.COM." and "example.com" cannot both exist.
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)

    type: Mapped[HostedZoneType] = mapped_column(
        Enum(HostedZoneType, native_enum=False, length=16),
        default=HostedZoneType.PUBLIC,
        nullable=False,
    )

    comment: Mapped[str | None] = mapped_column(Text)

    #: The four delegated name servers. A list of strings; JSON keeps them
    #: ordered and avoids a table that would only ever be read as a whole.
    name_servers: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # ---- Private-zone association (mocked, as the assignment allows) ------
    vpc_id: Mapped[str | None] = mapped_column(String(64))
    vpc_region: Mapped[str | None] = mapped_column(String(32))

    records: Mapped[list["DnsRecord"]] = relationship(
        back_populates="zone",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    owner: Mapped["User"] = relationship(back_populates="hosted_zones")

    if TYPE_CHECKING:
        # Mapped in `models/__init__.py` as a correlated-subquery column
        # property, which cannot be declared here without importing DnsRecord
        # and creating an import cycle. Declared for type checkers only.
        record_count: int

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<HostedZone {self.zone_id} {self.name!r} type={self.type}>"
