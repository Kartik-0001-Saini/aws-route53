"""The v1 API surface.

One place that knows every route the version exposes, so mounting a new
resource is a single line and the prefix is never repeated.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, dns_records, hosted_zones, transfer

api_router = APIRouter()

# Order matters for documentation grouping only — FastAPI matches on the full
# path, and the record router's prefix is strictly longer than the zone one.
api_router.include_router(auth.router)
api_router.include_router(hosted_zones.router)
api_router.include_router(dns_records.router)
api_router.include_router(transfer.router)

__all__ = ["api_router"]
