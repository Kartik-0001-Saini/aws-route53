"""Hosted zone request and response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import HostedZoneType
from app.validators.dns import validate_domain_name


class HostedZoneBase(BaseModel):
    comment: Annotated[str | None, Field(max_length=256)] = None


class HostedZoneCreate(HostedZoneBase):
    """`POST /hosted-zones` — the Create hosted zone form."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    type: HostedZoneType = HostedZoneType.PUBLIC
    vpc_id: Annotated[str | None, Field(max_length=64)] = None
    vpc_region: Annotated[str | None, Field(max_length=32)] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        # Domain rules live in the validator module, so the API and the BIND
        # importer cannot drift apart on what a legal domain is.
        return validate_domain_name(value)

    @field_validator("comment")
    @classmethod
    def _blank_comment_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class HostedZoneUpdate(BaseModel):
    """`PATCH /hosted-zones/{id}`.

    Only the comment is editable — Route53 does not allow renaming a zone or
    changing its type after creation, and neither do we.
    """

    comment: Annotated[str | None, Field(max_length=256)] = None

    @field_validator("comment")
    @classmethod
    def _blank_comment_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class HostedZoneSummary(BaseModel):
    """A row in the hosted zones table."""

    model_config = ConfigDict(from_attributes=True)

    zone_id: str
    name: str
    type: HostedZoneType
    comment: str | None
    record_count: int = Field(description="Records in this zone, including NS and SOA.")
    created_at: datetime
    updated_at: datetime


class HostedZoneDetail(HostedZoneSummary):
    """The zone detail page, including the delegation set."""

    name_servers: list[str]
    vpc_id: str | None
    vpc_region: str | None
