"""Schemas for zone import and export."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field


class ImportRequest(BaseModel):
    """`POST /hosted-zones/{zone_id}/import` — a BIND zone file, as text."""

    #: 1 MB ceiling. A legitimate zone file is a few kilobytes; anything near
    #: this is either a mistake or an attempt to make the parser work hard.
    content: Annotated[str, Field(min_length=1, max_length=1_048_576)]

    #: When false, the response reports what *would* happen and writes nothing.
    #: The console uses this to preview an import before committing to it.
    apply: bool = False

    #: Replace a record set that already exists rather than reporting a
    #: conflict. Off by default: silently overwriting live DNS is not a safe
    #: default for a button labelled "Import".
    overwrite_existing: bool = False


class ImportedRecord(BaseModel):
    name: str
    type: str
    ttl: int | None
    values: list[str]


class ImportResult(BaseModel):
    """What an import did, or would do."""

    applied: bool = Field(description="False when this was a preview.")
    created: int
    updated: int
    #: Record sets already present, when `overwrite_existing` is false.
    conflicts: list[ImportedRecord] = Field(default_factory=list)
    #: Records the parser produced, for the preview table.
    records: list[ImportedRecord] = Field(default_factory=list)
    #: Lines the parser could not read, with their line numbers.
    skipped: list[str] = Field(default_factory=list)
    #: Records rejected by validation, as "name TYPE: reason".
    rejected: list[str] = Field(default_factory=list)
