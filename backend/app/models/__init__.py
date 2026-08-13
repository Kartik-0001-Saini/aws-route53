"""Model package.

Every model is imported here so that a single `import app.models` populates
`Base.metadata`. Alembic's autogenerate and the test fixtures both depend on
that being complete — a model that is only imported by the module that uses it
is invisible to a migration.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from app.db.base import Base
from app.models.dns_record import DnsRecord
from app.models.enums import (
    USER_CREATABLE_TYPES,
    AuthProvider,
    FailoverType,
    HostedZoneType,
    RecordType,
    RoutingPolicy,
)
from app.models.hosted_zone import HostedZone
from app.models.user import User

# `HostedZone.record_count` — the count shown in the "Records" column of the
# hosted zones table.
#
# Mapped as a correlated subquery rather than a stored counter: a stored value
# is one missed decrement away from lying, and the zone list is small enough
# that the subquery cost is irrelevant. Declared here rather than in
# `hosted_zone.py` because it needs both mappers to exist.
HostedZone.__mapper__.add_property(
    "record_count",
    column_property(
        select(func.count(DnsRecord.id))
        .where(DnsRecord.hosted_zone_id == HostedZone.id)
        .correlate_except(DnsRecord)
        .scalar_subquery(),
        deferred=False,
    ),
)

__all__ = [
    "Base",
    "User",
    "HostedZone",
    "DnsRecord",
    "AuthProvider",
    "HostedZoneType",
    "RecordType",
    "RoutingPolicy",
    "FailoverType",
    "USER_CREATABLE_TYPES",
]
