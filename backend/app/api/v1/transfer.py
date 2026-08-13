"""Zone import and export endpoints."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import select

from app.api.deps import CurrentZone, DbSession
from app.core.exceptions import AppError
from app.models import DnsRecord
from app.schemas.transfer import ImportedRecord, ImportRequest, ImportResult
from app.services import bind_service, dns_record_service

router = APIRouter(prefix="/hosted-zones/{zone_id}", tags=["Import and export"])


def _zone_records(db: DbSession, zone_id: int) -> list[DnsRecord]:
    """Every record in a zone, ordered for a stable export."""
    return list(
        db.scalars(
            select(DnsRecord)
            .where(DnsRecord.hosted_zone_id == zone_id)
            .order_by(DnsRecord.name, DnsRecord.type)
        )
    )


@router.get(
    "/export",
    summary="Export a hosted zone",
    response_class=PlainTextResponse,
    responses={
        200: {
            "content": {"text/plain": {}, "application/json": {}},
            "description": "A BIND zone file, or the zone as JSON.",
        }
    },
)
def export_zone(
    zone: CurrentZone,
    db: DbSession,
    format: Annotated[
        Literal["bind", "json"], Query(description="Output format.")
    ] = "bind",
):
    """Export a zone and all its records.

    `Content-Disposition` carries a filename, so the browser saves
    `example.com.zone` rather than `export`.
    """
    records = _zone_records(db, zone.id)

    if format == "json":
        return JSONResponse(
            content=bind_service.export_zone_to_dict(zone, records),
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{zone.name}.json"'
                )
            },
        )

    return PlainTextResponse(
        content=bind_service.export_zone_to_bind(zone, records),
        headers={
            "Content-Disposition": f'attachment; filename="{zone.name}.zone"'
        },
    )


@router.post(
    "/import",
    response_model=ImportResult,
    summary="Import records from a BIND zone file",
)
def import_zone(
    payload: ImportRequest, zone: CurrentZone, db: DbSession
) -> ImportResult:
    """Import records from a BIND zone file.

    Defaults to a **preview**: nothing is written unless `apply` is true. That
    is what lets the console show exactly what an import will do — including
    which lines it could not read — before anyone commits to changing DNS.

    Every record goes through the same service and validators as a hand-created
    one, so an import cannot introduce a record the API would otherwise reject.
    """
    parsed = bind_service.parse_bind_zone_file(payload.content, zone.name)

    result = ImportResult(
        applied=payload.apply,
        created=0,
        updated=0,
        skipped=parsed.skipped,
    )

    def describe(record) -> ImportedRecord:
        return ImportedRecord(
            name=record.name,
            type=str(record.type),
            ttl=record.ttl,
            values=record.value.splitlines(),
        )

    existing = {
        (record.name, record.type): record
        for record in _zone_records(db, zone.id)
    }

    for candidate in parsed.records:
        # Validate first, in preview and apply alike. A preview that counts a
        # record validation will refuse would promise a create that never
        # happens — and the whole reason the preview exists is to be trusted.
        try:
            dns_record_service.validate_new_record(zone, candidate)
        except AppError as error:
            result.rejected.append(
                f"{candidate.name} {candidate.type}: {error.message}"
            )
            continue

        # Only records that survive validation reach the preview table, so what
        # it lists is exactly what will be written.
        result.records.append(describe(candidate))

        # The parser emits fully qualified names; the service resolves them
        # against the zone again, which is harmless and keeps one code path.
        key = (candidate.name, candidate.type)
        collision = existing.get(key)

        if collision is not None and not payload.overwrite_existing:
            result.conflicts.append(describe(candidate))
            continue

        if not payload.apply:
            # Preview: count what would happen without touching the database.
            if collision is None:
                result.created += 1
            elif not collision.is_system:
                result.updated += 1
            continue

        try:
            if collision is None:
                dns_record_service.create_record(
                    db, zone=zone, payload=candidate, commit=False
                )
                result.created += 1
            elif collision.is_system:
                # Apex NS and SOA belong to the zone. Skip rather than fail the
                # whole import over a line most zone files contain.
                result.rejected.append(
                    f"{candidate.name} {candidate.type}: managed by Route 53."
                )
            else:
                collision.value = candidate.value
                collision.ttl = candidate.ttl
                result.updated += 1
        except AppError as error:
            result.rejected.append(
                f"{candidate.name} {candidate.type}: {error.message}"
            )

    if payload.apply:
        # One transaction for the whole file: a partially applied zone is
        # harder to reason about than one that failed outright.
        db.commit()

    return result
