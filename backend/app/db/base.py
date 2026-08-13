"""Declarative base and the shared column conventions."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData, TypeDecorator
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint names. SQLite cannot ALTER a constraint, so Alembic
# has to rebuild the table to change one — and it can only do that if the
# constraint has a predictable name rather than an auto-generated one.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    """Timezone-aware UTC now.

    `datetime.utcnow()` is deprecated in 3.12+ and returns a naive value, which
    compares incorrectly against the aware values Pydantic serialises.
    """
    return datetime.now(timezone.utc)


class UtcDateTime(TypeDecorator[datetime]):
    """A datetime column that is always UTC-aware in Python.

    SQLite has no timezone-aware type: `DateTime(timezone=True)` silently
    stores the naive part and hands it back with `tzinfo=None`. The API would
    then serialise `2026-08-13T04:30:31` with no offset, and the browser would
    read that as *local* time — every timestamp in the console wrong by the
    user's UTC offset.

    This normalises both directions: values are converted to UTC before being
    stored, and re-tagged as UTC when loaded.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, _dialect: Dialect
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            # A naive value reaching this point is already UTC by convention;
            # anything else is a bug in the caller, not something to guess at.
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(
        self, value: datetime | None, _dialect: Dialect
    ) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """`created_at` / `updated_at`, maintained by the ORM rather than the DB.

    SQLite has no `ON UPDATE CURRENT_TIMESTAMP`, so `onupdate` is applied in
    Python. That keeps behaviour identical if this ever moves to Postgres.
    """

    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        default=utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime,
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
