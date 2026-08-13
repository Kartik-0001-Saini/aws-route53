/**
 * React Query cache keys, in one place.
 *
 * Hierarchical, so a broad key invalidates everything beneath it: after
 * creating a record, `invalidateQueries({ queryKey: queryKeys.zones.all })`
 * refreshes the zone list too, because its record-count column just changed.
 *
 * Defining them here rather than inline is what makes that reliable — an
 * invalidation that misses by one array element fails silently, leaving a
 * stale table on screen with no error anywhere.
 */

import type { DnsRecordListQuery, HostedZoneListQuery } from "@/types/api";

export const queryKeys = {
  auth: {
    config: ["auth", "config"] as const,
    session: ["auth", "session"] as const,
  },

  zones: {
    all: ["hosted-zones"] as const,
    list: (query: HostedZoneListQuery) => ["hosted-zones", "list", query] as const,
    detail: (zoneId: string) => ["hosted-zones", "detail", zoneId] as const,
  },

  records: {
    all: (zoneId: string) => ["hosted-zones", zoneId, "records"] as const,
    list: (zoneId: string, query: DnsRecordListQuery) =>
      ["hosted-zones", zoneId, "records", "list", query] as const,
    detail: (zoneId: string, recordId: number) =>
      ["hosted-zones", zoneId, "records", "detail", recordId] as const,
  },
} as const;
