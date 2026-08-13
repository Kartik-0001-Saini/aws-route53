"""The `dns_records` table."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import FailoverType, RecordType, RoutingPolicy

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone


class DnsRecord(Base, TimestampMixin):
    """A record *set* inside a hosted zone.

    Route53's unit is the record set, not the individual record: one entry can
    carry several values (three A records for one name arrive as three lines in
    a single set). `value` therefore stores newline-separated values, exactly
    as the console's textarea presents them.
    """

    __tablename__ = "dns_records"
    __table_args__ = (
        # Route53's identity for a record set. `set_identifier` distinguishes
        # the members of a weighted/latency group that share a name and type;
        # it is the empty string for simple records so the constraint stays
        # effective (SQLite treats every NULL as distinct, which would let
        # duplicates through).
        UniqueConstraint(
            "hosted_zone_id",
            "name",
            "type",
            "set_identifier",
            name="uq_record_zone_name_type_setid",
        ),
        Index("ix_dns_records_zone_name", "hosted_zone_id", "name"),
        Index("ix_dns_records_zone_type", "hosted_zone_id", "type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    hosted_zone_id: Mapped[int] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True, nullable=False
    )

    #: Fully qualified, trailing dot stripped, lower-cased. The apex is stored
    #: as the bare zone name rather than as an empty string.
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)

    type: Mapped[RecordType] = mapped_column(
        Enum(RecordType, native_enum=False, length=8), nullable=False
    )

    #: Seconds. Null only for alias records, which inherit the target's TTL.
    ttl: Mapped[int | None] = mapped_column(Integer)

    #: Newline-separated values. Text, not JSON, because the console edits it
    #: as free text and TXT records legitimately contain any character.
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # ---- Routing ---------------------------------------------------------
    routing_policy: Mapped[RoutingPolicy] = mapped_column(
        Enum(RoutingPolicy, native_enum=False, length=16),
        default=RoutingPolicy.SIMPLE,
        nullable=False,
    )
    set_identifier: Mapped[str] = mapped_column(
        String(128), default="", nullable=False, server_default=""
    )
    weight: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(32))
    failover_type: Mapped[FailoverType | None] = mapped_column(
        Enum(FailoverType, native_enum=False, length=16)
    )
    health_check_id: Mapped[str | None] = mapped_column(String(64))

    # ---- Alias -----------------------------------------------------------
    is_alias: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alias_target: Mapped[str | None] = mapped_column(String(512))

    #: True for the apex NS and SOA created alongside the zone. Route53 blocks
    #: deleting these, and so do we — the flag is what the service checks.
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="0"
    )

    zone: Mapped["HostedZone"] = relationship(back_populates="records")

    @property
    def values(self) -> list[str]:
        """The record set's values as a list, blank lines discarded."""
        return [line.strip() for line in self.value.splitlines() if line.strip()]

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<DnsRecord {self.type} {self.name!r} zone={self.hosted_zone_id}>"
