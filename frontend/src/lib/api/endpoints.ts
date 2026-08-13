/**
 * Typed wrappers around every endpoint.
 *
 * Components call these, never `apiRequest` directly — so a change to a path
 * or a query parameter is a one-line edit here rather than a search across the
 * component tree.
 */

import { apiRequest, downloadFile } from "@/lib/api/client";
import type {
  AuthConfig,
  BulkDeleteResponse,
  DemoLoginResponse,
  DnsRecord,
  DnsRecordCreateInput,
  DnsRecordListQuery,
  DnsRecordUpdateInput,
  HostedZoneCreateInput,
  HostedZoneDetail,
  HostedZoneListQuery,
  HostedZoneSummary,
  HostedZoneUpdateInput,
  ImportRequest,
  ImportResult,
  Page,
  SessionResponse,
} from "@/types/api";

/* ==========================================================================
   Auth
   ========================================================================== */

export const authApi = {
  /** Which sign-in methods the server supports. Called before login. */
  getConfig: () =>
    apiRequest<AuthConfig>("/auth/config", { anonymous: true }),

  /** Start a demo session. */
  demoLogin: () =>
    apiRequest<DemoLoginResponse>("/auth/demo", {
      method: "POST",
      anonymous: true,
    }),

  /** Restore a persisted session on boot. 401 means the token is dead. */
  getSession: () => apiRequest<SessionResponse>("/auth/me"),

  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),
};

/* ==========================================================================
   Hosted zones
   ========================================================================== */

export const hostedZonesApi = {
  list: (query: HostedZoneListQuery = {}, signal?: AbortSignal) =>
    apiRequest<Page<HostedZoneSummary>>("/hosted-zones", { query, signal }),

  get: (zoneId: string, signal?: AbortSignal) =>
    apiRequest<HostedZoneDetail>(`/hosted-zones/${zoneId}`, { signal }),

  create: (body: HostedZoneCreateInput) =>
    apiRequest<HostedZoneDetail>("/hosted-zones", { method: "POST", body }),

  update: (zoneId: string, body: HostedZoneUpdateInput) =>
    apiRequest<HostedZoneDetail>(`/hosted-zones/${zoneId}`, {
      method: "PATCH",
      body,
    }),

  remove: (zoneId: string) =>
    apiRequest<void>(`/hosted-zones/${zoneId}`, { method: "DELETE" }),

  /** Download the zone as a BIND zone file or as JSON. */
  export: (zoneId: string, zoneName: string, format: "bind" | "json") =>
    downloadFile(
      `/hosted-zones/${zoneId}/export`,
      `${zoneName}.${format === "bind" ? "zone" : "json"}`,
      { format },
    ),

  /**
   * Import records from a BIND zone file.
   *
   * Defaults to a preview — nothing is written unless `apply` is true — so the
   * console can show exactly what an import will do before committing.
   */
  import: (zoneId: string, body: ImportRequest) =>
    apiRequest<ImportResult>(`/hosted-zones/${zoneId}/import`, {
      method: "POST",
      body,
    }),
};

/* ==========================================================================
   DNS records
   ========================================================================== */

export const dnsRecordsApi = {
  list: (zoneId: string, query: DnsRecordListQuery = {}, signal?: AbortSignal) =>
    apiRequest<Page<DnsRecord>>(`/hosted-zones/${zoneId}/records`, {
      query,
      signal,
    }),

  get: (zoneId: string, recordId: number, signal?: AbortSignal) =>
    apiRequest<DnsRecord>(`/hosted-zones/${zoneId}/records/${recordId}`, {
      signal,
    }),

  create: (zoneId: string, body: DnsRecordCreateInput) =>
    apiRequest<DnsRecord>(`/hosted-zones/${zoneId}/records`, {
      method: "POST",
      body,
    }),

  update: (zoneId: string, recordId: number, body: DnsRecordUpdateInput) =>
    apiRequest<DnsRecord>(`/hosted-zones/${zoneId}/records/${recordId}`, {
      method: "PUT",
      body,
    }),

  remove: (zoneId: string, recordId: number) =>
    apiRequest<void>(`/hosted-zones/${zoneId}/records/${recordId}`, {
      method: "DELETE",
    }),

  bulkRemove: (zoneId: string, recordIds: number[]) =>
    apiRequest<BulkDeleteResponse>(
      `/hosted-zones/${zoneId}/records/bulk-delete`,
      { method: "POST", body: { record_ids: recordIds } },
    ),
};
