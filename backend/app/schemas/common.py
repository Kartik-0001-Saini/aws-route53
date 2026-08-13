"""Shared response envelopes and query primitives."""

from __future__ import annotations

from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")

#: The console's page-size selector offers these; anything else is rejected so
#: a crafted query cannot ask for the whole table at once.
PAGE_SIZE_CHOICES = (10, 20, 50, 100)


class PageParams(BaseModel):
    """Pagination, as a dependency.

    Page-number based rather than cursor based, because the Route53 table shows
    "1 2 3 …" controls and needs a total count to render them.
    """

    page: Annotated[int, Query(ge=1, description="1-based page number.")] = 1
    page_size: Annotated[
        int, Query(ge=1, le=100, description="Rows per page.")
    ] = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(BaseModel, Generic[T]):
    """A page of results plus everything the table footer needs to render."""

    items: list[T]
    total: int = Field(description="Total rows matching the filters, ignoring paging.")
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def create(
        cls, items: list[T], *, total: int, params: PageParams
    ) -> "Page[T]":
        # Always at least one page, so an empty table still renders "Page 1".
        total_pages = max(1, -(-total // params.page_size))  # ceiling division
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages,
        )


class MessageResponse(BaseModel):
    """A bare acknowledgement, for endpoints with nothing else to return."""

    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """The single error shape every failing endpoint returns.

    Declared so it appears in the OpenAPI schema rather than only in prose.
    """

    error: ErrorDetail
