"""Business rules for hosted zones.

Owns the transaction. Routers call in, get domain objects or an `AppError`
back, and never touch a query themselves.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.identifiers import build_soa_value, generate_name_servers, generate_zone_id
from app.models import DnsRecord, HostedZone, User
from app.models.enums import HostedZoneType, RecordType
from app.schemas.common import PageParams
from app.schemas.hosted_zone import HostedZoneCreate, HostedZoneUpdate

SortField = Literal["name", "created_at", "record_count", "type"]
SortDirection = Literal["asc", "desc"]

#: TTLs Route53 assigns to the records it creates with a zone.
_APEX_NS_TTL = 172_800  # 2 days
_APEX_SOA_TTL = 900  # 15 minutes

_SORT_COLUMNS = {
    "name": HostedZone.name,
    "created_at": HostedZone.created_at,
    "type": HostedZone.type,
    "record_count": HostedZone.record_count,
}


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def _base_query(user_id: int) -> Select[tuple[HostedZone]]:
    """Every zone read starts here, so ownership can never be forgotten."""
    return select(HostedZone).where(HostedZone.user_id == user_id)


def _apply_filters(
    query: Select[tuple[HostedZone]],
    *,
    search: str | None,
    zone_type: HostedZoneType | None,
) -> Select[tuple[HostedZone]]:
    if search:
        # Matches the console's single search box, which searches the domain
        # name, the comment and the zone id at once.
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(HostedZone.name).like(term),
                func.lower(HostedZone.comment).like(term),
                func.lower(HostedZone.zone_id).like(term),
            )
        )

    if zone_type is not None:
        query = query.where(HostedZone.type == zone_type)

    return query


def list_zones(
    db: Session,
    *,
    user_id: int,
    params: PageParams,
    search: str | None = None,
    zone_type: HostedZoneType | None = None,
    sort_by: SortField = "name",
    sort_dir: SortDirection = "asc",
) -> tuple[list[HostedZone], int]:
    """Return one page of zones plus the unpaginated total."""
    query = _apply_filters(_base_query(user_id), search=search, zone_type=zone_type)

    # Count before ordering and paging: the footer needs the full match count,
    # and ORDER BY on a COUNT query is wasted work.
    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    ) or 0

    column = _SORT_COLUMNS[sort_by]
    query = query.order_by(column.desc() if sort_dir == "desc" else column.asc())

    zones = list(db.scalars(query.offset(params.offset).limit(params.page_size)))
    return zones, total


def get_zone(db: Session, *, user_id: int, zone_id: str) -> HostedZone:
    """Fetch one zone by its public `Z…` id, or raise `NotFoundError`.

    Ownership is part of the lookup rather than a check afterwards, so another
    user's zone is indistinguishable from one that does not exist — which is
    what stops the API confirming that a given zone id is in use.
    """
    zone = db.scalar(_base_query(user_id).where(HostedZone.zone_id == zone_id))
    if zone is None:
        raise NotFoundError(
            f"Hosted zone {zone_id} was not found.", code="HostedZoneNotFound"
        )
    return zone


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


def _build_apex_records(zone: HostedZone) -> list[DnsRecord]:
    """The NS and SOA records Route53 creates alongside every hosted zone.

    Flagged `is_system` so the API refuses to delete them, matching the console
    where the delete button is disabled for both.
    """
    return [
        DnsRecord(
            zone=zone,
            name=zone.name,
            type=RecordType.NS,
            ttl=_APEX_NS_TTL,
            value="\n".join(zone.name_servers),
            is_system=True,
        ),
        DnsRecord(
            zone=zone,
            name=zone.name,
            type=RecordType.SOA,
            ttl=_APEX_SOA_TTL,
            value=build_soa_value(zone.name_servers[0]),
            is_system=True,
        ),
    ]


def create_zone(
    db: Session, *, user: User, payload: HostedZoneCreate, commit: bool = True
) -> HostedZone:
    """Create a hosted zone together with its apex NS and SOA records."""
    existing = db.scalar(
        _base_query(user.id).where(
            HostedZone.name == payload.name, HostedZone.type == payload.type
        )
    )
    if existing is not None:
        raise ConflictError(
            f"A {payload.type} hosted zone for {payload.name} already exists.",
            code="HostedZoneAlreadyExists",
            details={"fields": {"name": "This hosted zone already exists."}},
        )

    if payload.type is HostedZoneType.PRIVATE and not payload.vpc_id:
        raise ValidationError(
            "A private hosted zone must be associated with a VPC.",
            details={"fields": {"vpc_id": "Required for private zones."}},
        )

    zone = HostedZone(
        zone_id=generate_zone_id(),
        user_id=user.id,
        name=payload.name,
        type=payload.type,
        comment=payload.comment,
        # Private zones are resolved inside a VPC and get no public delegation
        # set, exactly as in Route53.
        name_servers=(
            generate_name_servers()
            if payload.type is HostedZoneType.PUBLIC
            else []
        ),
        vpc_id=payload.vpc_id,
        vpc_region=payload.vpc_region,
    )
    db.add(zone)
    db.flush()  # assigns zone.id so the apex records can reference it

    if zone.name_servers:
        db.add_all(_build_apex_records(zone))

    if commit:
        db.commit()
        db.refresh(zone)
    return zone


def update_zone(
    db: Session, *, user_id: int, zone_id: str, payload: HostedZoneUpdate
) -> HostedZone:
    """Update a zone's comment — the only mutable field, as in Route53."""
    zone = get_zone(db, user_id=user_id, zone_id=zone_id)
    zone.comment = payload.comment
    db.commit()
    db.refresh(zone)
    return zone


def delete_zone(db: Session, *, user_id: int, zone_id: str) -> None:
    """Delete a zone and everything in it.

    Route53 refuses to delete a zone that still holds records other than its
    apex NS and SOA. That guard is reproduced here — it is the reason the
    console makes you empty a zone first, and skipping it would make the delete
    flow feel wrong.
    """
    zone = get_zone(db, user_id=user_id, zone_id=zone_id)

    user_records = db.scalar(
        select(func.count(DnsRecord.id)).where(
            DnsRecord.hosted_zone_id == zone.id,
            DnsRecord.is_system.is_(False),
        )
    ) or 0

    if user_records:
        raise ConflictError(
            "This hosted zone still contains records. Delete them before "
            "deleting the hosted zone.",
            code="HostedZoneNotEmpty",
            details={"record_count": user_records},
        )

    db.delete(zone)  # cascade removes the apex records
    db.commit()
