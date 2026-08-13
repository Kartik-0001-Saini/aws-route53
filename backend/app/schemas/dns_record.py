"""DNS record request and response schemas.

Field-shape validation happens here; anything needing the zone as context
(is the name inside the zone? does a CNAME collide?) happens in the service,
because a Pydantic validator has no access to the database.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import FailoverType, RecordType, RoutingPolicy
from app.validators.dns import MAX_TTL


class DnsRecordBase(BaseModel):
    ttl: Annotated[int | None, Field(ge=0, le=MAX_TTL)] = 300
    routing_policy: RoutingPolicy = RoutingPolicy.SIMPLE
    set_identifier: Annotated[str, Field(max_length=128)] = ""
    weight: Annotated[int | None, Field(ge=0, le=255)] = None
    region: Annotated[str | None, Field(max_length=32)] = None
    failover_type: FailoverType | None = None
    health_check_id: Annotated[str | None, Field(max_length=64)] = None
    is_alias: bool = False
    alias_target: Annotated[str | None, Field(max_length=512)] = None

    @model_validator(mode="after")
    def _check_routing_requirements(self) -> "DnsRecordBase":
        """Enforce the fields each routing policy makes mandatory.

        Route53 requires a set identifier for every non-simple policy, because
        that is what distinguishes members of a group sharing a name and type.
        """
        if self.routing_policy is not RoutingPolicy.SIMPLE and not self.set_identifier:
            raise ValueError(
                "A record set identifier is required for "
                f"{self.routing_policy} routing."
            )

        if self.routing_policy is RoutingPolicy.WEIGHTED and self.weight is None:
            raise ValueError("A weight is required for weighted routing.")

        if self.routing_policy is RoutingPolicy.LATENCY and not self.region:
            raise ValueError("A region is required for latency routing.")

        if (
            self.routing_policy is RoutingPolicy.FAILOVER
            and self.failover_type is None
        ):
            raise ValueError(
                "Choose primary or secondary for failover routing."
            )

        if self.is_alias and not self.alias_target:
            raise ValueError("An alias record needs a target.")

        return self


class DnsRecordCreate(DnsRecordBase):
    """`POST /hosted-zones/{zone_id}/records` — the Create record form."""

    #: Blank means the zone apex. The full name is resolved server-side against
    #: the zone, so the client can send either `www` or `www.example.com`.
    name: Annotated[str, Field(max_length=255)] = ""
    type: RecordType
    value: Annotated[str, Field(max_length=65_535)] = ""


class DnsRecordUpdate(DnsRecordBase):
    """`PUT /records/{id}`.

    Name and type are immutable: in Route53 they are the record set's identity,
    and changing one is a delete plus a create.
    """

    value: Annotated[str, Field(max_length=65_535)] = ""


class DnsRecordResponse(BaseModel):
    """A row in the records table."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: RecordType
    ttl: int | None
    value: str
    values: list[str] = Field(description="`value` split into individual entries.")
    routing_policy: RoutingPolicy
    set_identifier: str
    weight: int | None
    region: str | None
    failover_type: FailoverType | None
    health_check_id: str | None
    is_alias: bool
    alias_target: str | None
    is_system: bool = Field(
        description="Apex NS and SOA records, which cannot be deleted."
    )
    created_at: datetime
    updated_at: datetime


class BulkDeleteRequest(BaseModel):
    """`POST /hosted-zones/{zone_id}/records/bulk-delete`."""

    record_ids: Annotated[list[int], Field(min_length=1, max_length=100)]


class BulkDeleteResponse(BaseModel):
    deleted: int
    skipped: list[int] = Field(
        default_factory=list,
        description="System records that were requested but cannot be deleted.",
    )
