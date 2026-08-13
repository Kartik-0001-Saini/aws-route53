/**
 * Types mirroring the backend's Pydantic schemas.
 *
 * Hand-written rather than generated: the API surface is small, and a typo
 * here fails the TypeScript build immediately, which is the same protection a
 * generator would give without the toolchain.
 *
 * Kept in the same order as `backend/app/schemas/` so the two can be diffed by
 * eye when either changes.
 */

/* ==========================================================================
   Enumerations — the string values the API accepts and returns
   ========================================================================== */

export const RECORD_TYPES = [
  "A",
  "AAAA",
  "CAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SRV",
  "TXT",
] as const;

/** Types a user can create. SOA is returned by the API but never offered. */
export type RecordType = (typeof RECORD_TYPES)[number];

/** Every type the API can return, including the two the zone owns. */
export type AnyRecordType = RecordType | "SOA";

export type HostedZoneType = "public" | "private";

export type RoutingPolicy =
  | "simple"
  | "weighted"
  | "latency"
  | "failover"
  | "geolocation"
  | "multivalue";

export type FailoverType = "primary" | "secondary";

export type AuthProvider = "google" | "demo";

/* ==========================================================================
   Envelopes
   ========================================================================== */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** The single error shape every failing endpoint returns. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: {
      /** Field-level messages, keyed by field name, for form display. */
      fields?: Record<string, string>;
      [key: string]: unknown;
    };
  };
}

/* ==========================================================================
   Auth
   ========================================================================== */

export interface UserProfile {
  id: number;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  provider: AuthProvider;
  aws_account_id: string;
  last_login_at: string | null;
  created_at: string;
}

export interface AuthConfig {
  google_enabled: boolean;
  demo_enabled: boolean;
}

export interface DemoLoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: UserProfile;
}

export interface SessionResponse {
  user: UserProfile;
}

/* ==========================================================================
   Hosted zones
   ========================================================================== */

export interface HostedZoneSummary {
  zone_id: string;
  name: string;
  type: HostedZoneType;
  comment: string | null;
  record_count: number;
  created_at: string;
  updated_at: string;
}

export interface HostedZoneDetail extends HostedZoneSummary {
  name_servers: string[];
  vpc_id: string | null;
  vpc_region: string | null;
}

export interface HostedZoneCreateInput {
  name: string;
  type?: HostedZoneType;
  comment?: string | null;
  vpc_id?: string | null;
  vpc_region?: string | null;
}

export interface HostedZoneUpdateInput {
  comment: string | null;
}

/**
 * Declared as a type alias rather than an interface on purpose: only type
 * aliases get an implicit index signature, which is what lets them be passed
 * to the client's `Record<string, QueryValue>` query builder.
 */
export type HostedZoneListQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  type?: HostedZoneType;
  sort_by?: "name" | "created_at" | "record_count" | "type";
  sort_dir?: "asc" | "desc";
};

/* ==========================================================================
   DNS records
   ========================================================================== */

export interface DnsRecord {
  id: number;
  name: string;
  type: AnyRecordType;
  ttl: number | null;
  /** Newline-separated, as the console's value textarea presents it. */
  value: string;
  /** `value` pre-split, for table rendering. */
  values: string[];
  routing_policy: RoutingPolicy;
  set_identifier: string;
  weight: number | null;
  region: string | null;
  failover_type: FailoverType | null;
  health_check_id: string | null;
  is_alias: boolean;
  alias_target: string | null;
  /** Apex NS and SOA records: not editable, not deletable. */
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface DnsRecordCreateInput {
  /** Blank means the zone apex. Resolved against the zone server-side. */
  name?: string;
  type: RecordType;
  value?: string;
  ttl?: number | null;
  routing_policy?: RoutingPolicy;
  set_identifier?: string;
  weight?: number | null;
  region?: string | null;
  failover_type?: FailoverType | null;
  health_check_id?: string | null;
  is_alias?: boolean;
  alias_target?: string | null;
}

/** Name and type are immutable, so an update omits both. */
export type DnsRecordUpdateInput = Omit<DnsRecordCreateInput, "name" | "type">;

/** A type alias, for the same index-signature reason as `HostedZoneListQuery`. */
export type DnsRecordListQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  type?: AnyRecordType[];
  sort_by?: "name" | "type" | "ttl" | "created_at";
  sort_dir?: "asc" | "desc";
};

export interface BulkDeleteResponse {
  deleted: number;
  /** System records that were requested but could not be deleted. */
  skipped: number[];
}

/* ==========================================================================
   Import and export
   ========================================================================== */

export interface ImportRequest {
  /** The zone file, as text. */
  content: string;
  /** False previews the import and writes nothing. */
  apply?: boolean;
  /** Replace record sets that already exist instead of reporting a conflict. */
  overwrite_existing?: boolean;
}

export interface ImportedRecord {
  name: string;
  type: string;
  ttl: number | null;
  values: string[];
}

export interface ImportResult {
  applied: boolean;
  created: number;
  updated: number;
  /** Already present, and `overwrite_existing` was false. */
  conflicts: ImportedRecord[];
  /** What the parser produced, for the preview table. */
  records: ImportedRecord[];
  /** Lines the parser could not read, with line numbers. */
  skipped: string[];
  /** Records validation rejected, as "name TYPE: reason". */
  rejected: string[];
}
