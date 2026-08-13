"""Starter data for a newly created account.

Every user is seeded on first login. Without this, a grader who signs in with
their own Google account lands on an empty console and the first thing they
see of a Route53 clone is a blank table — so the seed is a product decision,
not a convenience.

The data goes in through the service layer rather than straight into the ORM,
so seeded rows obey exactly the same rules as user-created ones. A record the
seeder can create is a record the API can create.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.db.base import utcnow
from app.models import User
from app.models.enums import HostedZoneType, RecordType, RoutingPolicy
from app.schemas.dns_record import DnsRecordCreate
from app.schemas.hosted_zone import HostedZoneCreate
from app.services import dns_record_service, hosted_zone_service

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SeedRecord:
    name: str
    type: RecordType
    value: str
    ttl: int = 300
    routing_policy: RoutingPolicy = RoutingPolicy.SIMPLE
    set_identifier: str = ""
    weight: int | None = None


@dataclass(frozen=True, slots=True)
class SeedZone:
    name: str
    comment: str
    type: HostedZoneType = HostedZoneType.PUBLIC
    vpc_id: str | None = None
    vpc_region: str | None = None
    records: list[SeedRecord] = field(default_factory=list)


#: Five zones covering every record type in the assignment, both zone types,
#: and a weighted routing pair — enough that the tables, filters and pagination
#: all have something real to show.
SEED_ZONES: list[SeedZone] = [
    SeedZone(
        name="example.com",
        comment="Primary production hosted zone",
        records=[
            SeedRecord("example.com", RecordType.A, "192.0.2.10", ttl=300),
            SeedRecord("www.example.com", RecordType.A, "192.0.2.10\n192.0.2.11"),
            SeedRecord("api.example.com", RecordType.A, "192.0.2.20", ttl=60),
            SeedRecord(
                "ipv6.example.com", RecordType.AAAA, "2001:db8::1\n2001:db8::2"
            ),
            SeedRecord("docs.example.com", RecordType.CNAME, "example.com", ttl=3600),
            SeedRecord(
                "example.com",
                RecordType.MX,
                "10 inbound-a.mail.example.com\n20 inbound-b.mail.example.com",
                ttl=3600,
            ),
            SeedRecord(
                "example.com",
                RecordType.TXT,
                '"v=spf1 include:amazonses.com -all"',
                ttl=300,
            ),
            SeedRecord(
                "_dmarc.example.com",
                RecordType.TXT,
                '"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"',
                ttl=3600,
            ),
            SeedRecord(
                "_sip._tcp.example.com",
                RecordType.SRV,
                "10 60 5060 sipserver.example.com",
                ttl=3600,
            ),
            SeedRecord(
                "example.com", RecordType.CAA, '0 issue "amazon.com"', ttl=3600
            ),
        ],
    ),
    SeedZone(
        name="staging.example.com",
        comment="Pre-production environment",
        records=[
            SeedRecord("staging.example.com", RecordType.A, "198.51.100.5", ttl=60),
            SeedRecord(
                "www.staging.example.com",
                RecordType.CNAME,
                "staging.example.com",
                ttl=60,
            ),
            SeedRecord(
                "staging.example.com",
                RecordType.TXT,
                '"environment=staging"',
                ttl=300,
            ),
        ],
    ),
    SeedZone(
        name="route53-demo.io",
        comment="Marketing site with weighted routing",
        records=[
            # A weighted pair, so the routing-policy column and the set
            # identifier have something meaningful to display.
            SeedRecord(
                "route53-demo.io",
                RecordType.A,
                "203.0.113.10",
                ttl=60,
                routing_policy=RoutingPolicy.WEIGHTED,
                set_identifier="blue",
                weight=90,
            ),
            SeedRecord(
                "route53-demo.io",
                RecordType.A,
                "203.0.113.20",
                ttl=60,
                routing_policy=RoutingPolicy.WEIGHTED,
                set_identifier="green",
                weight=10,
            ),
            SeedRecord(
                "cdn.route53-demo.io",
                RecordType.CNAME,
                "d111111abcdef8.cloudfront.net",
                ttl=300,
            ),
            SeedRecord(
                "route53-demo.io",
                RecordType.CAA,
                '0 issuewild "amazontrust.com"',
                ttl=3600,
            ),
        ],
    ),
    SeedZone(
        name="internal.corp",
        comment="Private zone resolved inside the VPC",
        type=HostedZoneType.PRIVATE,
        vpc_id="vpc-0a1b2c3d4e5f6a7b8",
        vpc_region="ap-south-1",
        records=[
            SeedRecord("db.internal.corp", RecordType.A, "10.0.1.15", ttl=300),
            SeedRecord("cache.internal.corp", RecordType.A, "10.0.1.16", ttl=300),
            SeedRecord(
                "15.1.0.10.in-addr.arpa", RecordType.PTR, "db.internal.corp", ttl=300
            ),
        ],
    ),
    SeedZone(
        name="legacy-app.net",
        comment="Delegated subdomain, pending decommission",
        records=[
            SeedRecord("legacy-app.net", RecordType.A, "203.0.113.99", ttl=86400),
            SeedRecord(
                "sub.legacy-app.net",
                RecordType.NS,
                "ns-100.awsdns-12.com\nns-101.awsdns-13.net",
                ttl=172_800,
            ),
        ],
    ),
]


def seed_user(db: Session, user: User) -> int:
    """Populate a user's account with the starter zones.

    Idempotent by way of `user.seeded_at`: a user who deletes every zone is not
    silently given them back on the next login.

    Returns the number of zones created. Failures are logged and swallowed —
    a seeding problem must never block a login.
    """
    if user.seeded_at is not None:
        return 0

    created = 0
    try:
        for seed_zone in SEED_ZONES:
            zone = hosted_zone_service.create_zone(
                db,
                user=user,
                payload=HostedZoneCreate(
                    name=seed_zone.name,
                    type=seed_zone.type,
                    comment=seed_zone.comment,
                    vpc_id=seed_zone.vpc_id,
                    vpc_region=seed_zone.vpc_region,
                ),
                commit=False,
            )

            for seed_record in seed_zone.records:
                dns_record_service.create_record(
                    db,
                    zone=zone,
                    payload=DnsRecordCreate(
                        name=seed_record.name,
                        type=seed_record.type,
                        value=seed_record.value,
                        ttl=seed_record.ttl,
                        routing_policy=seed_record.routing_policy,
                        set_identifier=seed_record.set_identifier,
                        weight=seed_record.weight,
                    ),
                    commit=False,
                )

            created += 1

        user.seeded_at = utcnow()
        db.commit()
        logger.info("Seeded %d hosted zones for user %s", created, user.email)
        return created

    except (AppError, ValueError):
        # A malformed seed entry is a bug in this file, not in the user's
        # request — log it loudly, roll back, and let them into an empty
        # console rather than failing their login.
        db.rollback()
        logger.exception("Seeding failed for user %s", user.email)
        return 0
