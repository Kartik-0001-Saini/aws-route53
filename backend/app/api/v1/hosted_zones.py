"""Hosted zone endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, CurrentZone, DbSession, Paging
from app.models.enums import HostedZoneType
from app.schemas.common import Page
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneSummary,
    HostedZoneUpdate,
)
from app.services import hosted_zone_service
from app.services.hosted_zone_service import SortDirection, SortField

router = APIRouter(prefix="/hosted-zones", tags=["Hosted zones"])


@router.get(
    "",
    response_model=Page[HostedZoneSummary],
    summary="List hosted zones",
)
def list_hosted_zones(
    db: DbSession,
    current_user: CurrentUser,
    params: Paging,
    search: Annotated[
        str | None,
        Query(max_length=255, description="Matches domain name, comment or zone ID."),
    ] = None,
    type: Annotated[HostedZoneType | None, Query(description="Filter by zone type.")] = None,
    sort_by: Annotated[SortField, Query()] = "name",
    sort_dir: Annotated[SortDirection, Query()] = "asc",
) -> Page[HostedZoneSummary]:
    """One page of the caller's hosted zones, with search, filter and sort."""
    zones, total = hosted_zone_service.list_zones(
        db,
        user_id=current_user.id,
        params=params,
        search=search,
        zone_type=type,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return Page.create(
        [HostedZoneSummary.model_validate(zone) for zone in zones],
        total=total,
        params=params,
    )


@router.post(
    "",
    response_model=HostedZoneDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a hosted zone",
)
def create_hosted_zone(
    payload: HostedZoneCreate, db: DbSession, current_user: CurrentUser
) -> HostedZoneDetail:
    """Create a hosted zone and its apex NS and SOA records."""
    zone = hosted_zone_service.create_zone(db, user=current_user, payload=payload)
    return HostedZoneDetail.model_validate(zone)


@router.get(
    "/{zone_id}",
    response_model=HostedZoneDetail,
    summary="Get a hosted zone",
)
def get_hosted_zone(zone: CurrentZone) -> HostedZoneDetail:
    """A single zone, including its delegation set."""
    return HostedZoneDetail.model_validate(zone)


@router.patch(
    "/{zone_id}",
    response_model=HostedZoneDetail,
    summary="Edit a hosted zone",
)
def update_hosted_zone(
    zone_id: str,
    payload: HostedZoneUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> HostedZoneDetail:
    """Update the comment. Name and type are immutable, as in Route 53."""
    zone = hosted_zone_service.update_zone(
        db, user_id=current_user.id, zone_id=zone_id, payload=payload
    )
    return HostedZoneDetail.model_validate(zone)


@router.delete(
    "/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # See the note on the record delete route: `-> None` infers as `NoneType`,
    # which FastAPI rejects as a body on a 204.
    response_model=None,
    summary="Delete a hosted zone",
)
def delete_hosted_zone(
    zone_id: str, db: DbSession, current_user: CurrentUser
) -> None:
    """Delete a zone. Fails with 409 while it still holds user records."""
    hosted_zone_service.delete_zone(db, user_id=current_user.id, zone_id=zone_id)
