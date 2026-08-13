"""Business rules for DNS records.

Field shapes are already validated by Pydantic and `validators.dns`. What is
left here is everything that needs the zone as context: name resolution,
collision rules, and the system-record guard.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import DnsRecord, HostedZone
from app.models.enums import USER_CREATABLE_TYPES, RecordType
from app.schemas.common import PageParams
from app.schemas.dns_record import DnsRecordCreate, DnsRecordUpdate
from app.validators.dns import (
    validate_record_name,
    validate_record_values,
    validate_ttl,
)

SortField = Literal["name", "type", "ttl", "created_at"]
SortDirection = Literal["asc", "desc"]

_SORT_COLUMNS = {
    "name": DnsRecord.name,
    "type": DnsRecord.type,
    "ttl": DnsRecord.ttl,
    "created_at": DnsRecord.created_at,
}


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def list_records(
    db: Session,
    *,
    zone: HostedZone,
    params: PageParams,
    search: str | None = None,
    record_types: list[RecordType] | None = None,
    sort_by: SortField = "name",
    sort_dir: SortDirection = "asc",
) -> tuple[list[DnsRecord], int]:
    """Return one page of a zone's records plus the unpaginated total."""
    query: Select[tuple[DnsRecord]] = select(DnsRecord).where(
        DnsRecord.hosted_zone_id == zone.id
    )

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(DnsRecord.name).like(term),
                func.lower(DnsRecord.value).like(term),
                func.lower(DnsRecord.set_identifier).like(term),
            )
        )

    if record_types:
        query = query.where(DnsRecord.type.in_(record_types))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    column = _SORT_COLUMNS[sort_by]
    query = query.order_by(
        column.desc() if sort_dir == "desc" else column.asc(),
        # Stable tiebreak: without it, two records sharing a name can swap
        # places between pages and a row appears twice while another vanishes.
        DnsRecord.id.asc(),
    )

    records = list(db.scalars(query.offset(params.offset).limit(params.page_size)))
    return records, total


def get_record(db: Session, *, zone: HostedZone, record_id: int) -> DnsRecord:
    """Fetch one record within a zone, or raise `NotFoundError`."""
    record = db.scalar(
        select(DnsRecord).where(
            DnsRecord.id == record_id, DnsRecord.hosted_zone_id == zone.id
        )
    )
    if record is None:
        raise NotFoundError("This record was not found.", code="RecordNotFound")
    return record


# ---------------------------------------------------------------------------
# Domain rules
# ---------------------------------------------------------------------------


def _assert_no_cname_conflict(
    db: Session,
    *,
    zone: HostedZone,
    name: str,
    record_type: RecordType,
    exclude_id: int | None = None,
) -> None:
    """Enforce RFC 1034: a CNAME cannot share a name with any other record.

    Both directions have to be checked — adding a CNAME where records already
    exist, and adding any record where a CNAME already exists.
    """
    query = select(DnsRecord).where(
        DnsRecord.hosted_zone_id == zone.id, DnsRecord.name == name
    )
    if exclude_id is not None:
        query = query.where(DnsRecord.id != exclude_id)

    siblings = list(db.scalars(query))
    if not siblings:
        return

    if record_type is RecordType.CNAME:
        raise ConflictError(
            f"Another record already exists for {name}. A CNAME record cannot "
            "share a name with any other record.",
            code="CnameConflict",
        )

    if any(sibling.type is RecordType.CNAME for sibling in siblings):
        raise ConflictError(
            f"A CNAME record already exists for {name}. No other record can "
            "share a name with a CNAME.",
            code="CnameConflict",
        )


def _assert_unique_record_set(
    db: Session,
    *,
    zone: HostedZone,
    name: str,
    record_type: RecordType,
    set_identifier: str,
    exclude_id: int | None = None,
) -> None:
    """Guard the (zone, name, type, set identifier) uniqueness rule.

    Checked here rather than relying on the database constraint so the user
    gets a sentence about what collided instead of an IntegrityError.
    """
    query = select(DnsRecord).where(
        DnsRecord.hosted_zone_id == zone.id,
        DnsRecord.name == name,
        DnsRecord.type == record_type,
        DnsRecord.set_identifier == set_identifier,
    )
    if exclude_id is not None:
        query = query.where(DnsRecord.id != exclude_id)

    if db.scalar(query) is not None:
        raise ConflictError(
            f"A {record_type} record for {name} already exists in this hosted "
            "zone. Edit the existing record to add more values.",
            code="RecordAlreadyExists",
        )


def _assert_type_is_creatable(record_type: RecordType) -> None:
    if record_type not in USER_CREATABLE_TYPES:
        raise ValidationError(
            f"{record_type} records are managed by the hosted zone and cannot "
            "be created manually.",
            details={"fields": {"type": "Not available."}},
        )


def _assert_not_system(record: DnsRecord, action: str) -> None:
    if record.is_system:
        raise ConflictError(
            f"The {record.type} record at the zone apex is managed by Route 53 "
            f"and cannot be {action}.",
            code="SystemRecordImmutable",
        )


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------


def validate_new_record(
    zone: HostedZone, payload: DnsRecordCreate
) -> tuple[str, int | None, str]:
    """Validate a record payload against its zone, without touching the database.

    Returns the canonical `(name, ttl, value)`. Split out of `create_record` so
    the zone-file import can tell the user what *will* be rejected before it
    writes anything — a preview that counts records validation would refuse is
    a preview that lies, which defeats the point of having one.
    """
    _assert_type_is_creatable(payload.type)

    name = validate_record_name(payload.name, zone.name)
    ttl = validate_ttl(payload.ttl, is_alias=payload.is_alias)
    # Alias records point at an AWS resource instead of holding a value.
    value = (
        "" if payload.is_alias else validate_record_values(payload.type, payload.value)
    )

    return name, ttl, value


def create_record(
    db: Session,
    *,
    zone: HostedZone,
    payload: DnsRecordCreate,
    commit: bool = True,
) -> DnsRecord:
    """Create a record set inside a zone."""
    name, ttl, value = validate_new_record(zone, payload)

    _assert_unique_record_set(
        db,
        zone=zone,
        name=name,
        record_type=payload.type,
        set_identifier=payload.set_identifier,
    )
    _assert_no_cname_conflict(db, zone=zone, name=name, record_type=payload.type)

    record = DnsRecord(
        hosted_zone_id=zone.id,
        name=name,
        type=payload.type,
        ttl=ttl,
        value=value,
        routing_policy=payload.routing_policy,
        set_identifier=payload.set_identifier,
        weight=payload.weight,
        region=payload.region,
        failover_type=payload.failover_type,
        health_check_id=payload.health_check_id,
        is_alias=payload.is_alias,
        alias_target=payload.alias_target,
    )
    db.add(record)

    if commit:
        db.commit()
        db.refresh(record)
    return record


def update_record(
    db: Session, *, zone: HostedZone, record_id: int, payload: DnsRecordUpdate
) -> DnsRecord:
    """Update a record set's value and routing.

    Name and type are the record set's identity in Route53 and stay fixed; the
    console likewise disables both fields when editing.
    """
    record = get_record(db, zone=zone, record_id=record_id)
    _assert_not_system(record, "edited")

    ttl = validate_ttl(payload.ttl, is_alias=payload.is_alias)
    value = (
        "" if payload.is_alias else validate_record_values(record.type, payload.value)
    )

    if payload.set_identifier != record.set_identifier:
        _assert_unique_record_set(
            db,
            zone=zone,
            name=record.name,
            record_type=record.type,
            set_identifier=payload.set_identifier,
            exclude_id=record.id,
        )

    record.ttl = ttl
    record.value = value
    record.routing_policy = payload.routing_policy
    record.set_identifier = payload.set_identifier
    record.weight = payload.weight
    record.region = payload.region
    record.failover_type = payload.failover_type
    record.health_check_id = payload.health_check_id
    record.is_alias = payload.is_alias
    record.alias_target = payload.alias_target

    db.commit()
    db.refresh(record)
    return record


def delete_record(db: Session, *, zone: HostedZone, record_id: int) -> None:
    record = get_record(db, zone=zone, record_id=record_id)
    _assert_not_system(record, "deleted")
    db.delete(record)
    db.commit()


def delete_records(
    db: Session, *, zone: HostedZone, record_ids: list[int]
) -> tuple[int, list[int]]:
    """Delete several records at once.

    Returns `(deleted_count, skipped_ids)`. System records are reported as
    skipped rather than failing the whole batch, so selecting every row in the
    table and pressing Delete does the sensible thing.
    """
    records = list(
        db.scalars(
            select(DnsRecord).where(
                DnsRecord.hosted_zone_id == zone.id,
                DnsRecord.id.in_(record_ids),
            )
        )
    )

    skipped: list[int] = []
    deleted = 0
    for record in records:
        if record.is_system:
            skipped.append(record.id)
            continue
        db.delete(record)
        deleted += 1

    db.commit()
    return deleted, skipped
