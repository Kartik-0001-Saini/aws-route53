/**
 * Shared form state for the create and edit record dialogs.
 *
 * Numeric fields are held as strings. An `<input type="number">` bound to a
 * number cannot represent "the user has cleared the field", and coercing an
 * empty string to 0 would silently submit a TTL of zero — a real value that
 * disables caching entirely. Conversion happens once, at submit.
 */

import { DEFAULT_TTL, toRecordNamePrefix } from "@/lib/dns/record-types";
import type {
  DnsRecord,
  DnsRecordCreateInput,
  FailoverType,
  RecordType,
  RoutingPolicy,
} from "@/types/api";

export interface RecordFormState {
  /** The prefix only — the zone name is rendered beside the input. */
  name: string;
  type: RecordType;
  value: string;
  ttl: string;
  routingPolicy: RoutingPolicy;
  setIdentifier: string;
  weight: string;
  region: string;
  failoverType: FailoverType | "";
  isAlias: boolean;
  aliasTarget: string;
}

export function emptyRecordForm(): RecordFormState {
  return {
    name: "",
    type: "A",
    value: "",
    ttl: String(DEFAULT_TTL),
    routingPolicy: "simple",
    setIdentifier: "",
    weight: "",
    region: "",
    failoverType: "",
    isAlias: false,
    aliasTarget: "",
  };
}

/** Populate the form from an existing record, for the edit dialog. */
export function recordToForm(
  record: DnsRecord,
  zoneName: string,
): RecordFormState {
  return {
    name: toRecordNamePrefix(record.name, zoneName),
    // SOA is never editable, so the cast is safe for anything reaching a form.
    type: record.type as RecordType,
    value: record.value,
    ttl: record.ttl === null ? "" : String(record.ttl),
    routingPolicy: record.routing_policy,
    setIdentifier: record.set_identifier,
    weight: record.weight === null ? "" : String(record.weight),
    region: record.region ?? "",
    failoverType: record.failover_type ?? "",
    isAlias: record.is_alias,
    aliasTarget: record.alias_target ?? "",
  };
}

/**
 * Convert the form to an API payload.
 *
 * Fields belonging to a routing policy that is no longer selected are sent as
 * null rather than left at their last value — otherwise switching from
 * weighted to simple would keep a stale weight attached to the record.
 */
export function formToPayload(form: RecordFormState): DnsRecordCreateInput {
  const isWeighted = form.routingPolicy === "weighted";
  const isLatency = form.routingPolicy === "latency";
  const isFailover = form.routingPolicy === "failover";

  return {
    name: form.name.trim(),
    type: form.type,
    // An alias points at a resource instead of holding a value or a TTL.
    value: form.isAlias ? "" : form.value,
    ttl: form.isAlias ? null : parseOptionalInt(form.ttl),
    routing_policy: form.routingPolicy,
    set_identifier:
      form.routingPolicy === "simple" ? "" : form.setIdentifier.trim(),
    weight: isWeighted ? parseOptionalInt(form.weight) : null,
    region: isLatency ? form.region.trim() || null : null,
    failover_type: isFailover ? form.failoverType || null : null,
    is_alias: form.isAlias,
    alias_target: form.isAlias ? form.aliasTarget.trim() || null : null,
  };
}

/**
 * The payload for an update, which omits the record's identity.
 *
 * Name and type are immutable on the API, so sending them would only invite a
 * confusing rejection. Built here rather than destructured away at the call
 * site so the reason lives with the rule.
 */
export function formToUpdatePayload(
  form: RecordFormState,
): Omit<DnsRecordCreateInput, "name" | "type"> {
  const payload: Partial<DnsRecordCreateInput> = { ...formToPayload(form) };
  delete payload.name;
  delete payload.type;
  return payload;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Whether the form is complete enough to submit.
 *
 * A cheap client-side gate only — the backend is the authority, and every rule
 * here is enforced there too. This exists so the submit button reflects
 * whether pressing it can possibly work.
 */
export function canSubmitRecordForm(form: RecordFormState): boolean {
  if (form.isAlias) {
    if (!form.aliasTarget.trim()) return false;
  } else {
    if (!form.value.trim()) return false;
    if (parseOptionalInt(form.ttl) === null) return false;
  }

  if (form.routingPolicy !== "simple" && !form.setIdentifier.trim()) {
    return false;
  }
  if (form.routingPolicy === "weighted" && parseOptionalInt(form.weight) === null) {
    return false;
  }
  if (form.routingPolicy === "latency" && !form.region.trim()) return false;
  if (form.routingPolicy === "failover" && !form.failoverType) return false;

  return true;
}
