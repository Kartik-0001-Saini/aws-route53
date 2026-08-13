"""DNS record endpoints.

Nested under a hosted zone, because a record has no meaning outside one and
the nesting is what makes ownership impossible to bypass — `CurrentZone`
already resolved the zone against the caller.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentZone, DbSession, Paging
from app.models.enums import RecordType
from app.schemas.common import Page
from app.schemas.dns_record import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    DnsRecordCreate,
    DnsRecordResponse,
    DnsRecordUpdate,
)
from app.services import dns_record_service
from app.services.dns_record_service import SortDirection, SortField

router = APIRouter(prefix="/hosted-zones/{zone_id}/records", tags=["DNS records"])


def _to_response(record) -> DnsRecordResponse:
    """Serialise a record, including the derived `values` list.

    `values` is a Python property rather than a column, so it is attached
    explicitly instead of relying on `from_attributes` to find it.
    """
    payload = DnsRecordResponse.model_validate(record)
    payload.values = record.values
    return payload


@router.get(
    "",
    response_model=Page[DnsRecordResponse],
    summary="List records in a hosted zone",
)
def list_records(
    zone: CurrentZone,
    db: DbSession,
    params: Paging,
    search: Annotated[
        str | None,
        Query(max_length=255, description="Matches record name, value or set ID."),
    ] = None,
    type: Annotated[
        list[RecordType] | None,
        Query(description="Filter by record type. Repeat for several types."),
    ] = None,
    sort_by: Annotated[SortField, Query()] = "name",
    sort_dir: Annotated[SortDirection, Query()] = "asc",
) -> Page[DnsRecordResponse]:
    """One page of a zone's records, with search, type filter and sort."""
    records, total = dns_record_service.list_records(
        db,
        zone=zone,
        params=params,
        search=search,
        record_types=type,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return Page.create(
        [_to_response(record) for record in records], total=total, params=params
    )


@router.post(
    "",
    response_model=DnsRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a record",
)
def create_record(
    payload: DnsRecordCreate, zone: CurrentZone, db: DbSession
) -> DnsRecordResponse:
    """Create a record set. The name is resolved against the zone server-side."""
    record = dns_record_service.create_record(db, zone=zone, payload=payload)
    return _to_response(record)


@router.get(
    "/{record_id}",
    response_model=DnsRecordResponse,
    summary="Get a record",
)
def get_record(
    record_id: int, zone: CurrentZone, db: DbSession
) -> DnsRecordResponse:
    record = dns_record_service.get_record(db, zone=zone, record_id=record_id)
    return _to_response(record)


@router.put(
    "/{record_id}",
    response_model=DnsRecordResponse,
    summary="Edit a record",
)
def update_record(
    record_id: int, payload: DnsRecordUpdate, zone: CurrentZone, db: DbSession
) -> DnsRecordResponse:
    """Update a record's value and routing. Name and type are immutable."""
    record = dns_record_service.update_record(
        db, zone=zone, record_id=record_id, payload=payload
    )
    return _to_response(record)


@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # Required on 204: FastAPI infers the response model from the return
    # annotation, and `-> None` infers as `NoneType`, which it then rejects as
    # a body on a status code that cannot have one.
    response_model=None,
    summary="Delete a record",
)
def delete_record(record_id: int, zone: CurrentZone, db: DbSession) -> None:
    """Delete a record. Apex NS and SOA records return 409."""
    dns_record_service.delete_record(db, zone=zone, record_id=record_id)


@router.post(
    "/bulk-delete",
    response_model=BulkDeleteResponse,
    summary="Delete several records",
)
def bulk_delete_records(
    payload: BulkDeleteRequest, zone: CurrentZone, db: DbSession
) -> BulkDeleteResponse:
    """Delete a selection from the records table.

    System records in the selection are reported back as skipped rather than
    failing the batch, so "select all then delete" behaves sensibly.
    """
    deleted, skipped = dns_record_service.delete_records(
        db, zone=zone, record_ids=payload.record_ids
    )
    return BulkDeleteResponse(deleted=deleted, skipped=skipped)
