"""Domain enumerations shared by models, schemas and validators.

These are stored as strings rather than integers so the database stays readable
and a value never silently changes meaning if the enum is reordered.
"""

from __future__ import annotations

from enum import StrEnum


class AuthProvider(StrEnum):
    GOOGLE = "google"
    DEMO = "demo"


class HostedZoneType(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class RecordType(StrEnum):
    """Record types the console offers.

    SOA and NS are created with the zone and are not user-creatable at the
    apex, mirroring Route53. Every other type is fully CRUD-able.
    """

    A = "A"
    AAAA = "AAAA"
    CAA = "CAA"
    CNAME = "CNAME"
    MX = "MX"
    NS = "NS"
    PTR = "PTR"
    SOA = "SOA"
    SRV = "SRV"
    TXT = "TXT"


#: Types a user may create or edit — the assignment's list, minus the two the
#: zone owns itself at the apex.
USER_CREATABLE_TYPES: frozenset[RecordType] = frozenset(
    {
        RecordType.A,
        RecordType.AAAA,
        RecordType.CAA,
        RecordType.CNAME,
        RecordType.MX,
        RecordType.NS,
        RecordType.PTR,
        RecordType.SRV,
        RecordType.TXT,
    }
)


class RoutingPolicy(StrEnum):
    SIMPLE = "simple"
    WEIGHTED = "weighted"
    LATENCY = "latency"
    FAILOVER = "failover"
    GEOLOCATION = "geolocation"
    MULTIVALUE = "multivalue"


class FailoverType(StrEnum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
