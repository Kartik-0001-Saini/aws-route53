/**
 * Per-record-type presentation metadata.
 *
 * The backend owns validation; this owns what the form *says*. Keeping the two
 * aligned by hand is deliberate — the rules and their explanations change for
 * different reasons, and a shared schema would make the copy hostage to the
 * validator.
 *
 * The example strings are the ones a user can paste and have accepted, so they
 * are checked against `backend/app/validators/dns.py` whenever either changes.
 */

import type { AnyRecordType, RecordType, RoutingPolicy } from "@/types/api";

export interface RecordTypeInfo {
  /** How the console labels the type in the dropdown. */
  label: string;
  /** One line explaining what the type is for. */
  description: string;
  /** Placeholder for the value textarea. */
  placeholder: string;
  /** Format guidance shown under the value field. */
  valueHint: string;
  /** Whether the type accepts several values in one record set. */
  multiValue: boolean;
}

export const RECORD_TYPE_INFO: Record<AnyRecordType, RecordTypeInfo> = {
  A: {
    label: "A – IPv4 address",
    description: "Routes traffic to an IPv4 address.",
    placeholder: "192.0.2.1",
    valueHint: "One IPv4 address per line, for example 192.0.2.1",
    multiValue: true,
  },
  AAAA: {
    label: "AAAA – IPv6 address",
    description: "Routes traffic to an IPv6 address.",
    placeholder: "2001:db8::1",
    valueHint: "One IPv6 address per line, for example 2001:db8::1",
    multiValue: true,
  },
  CNAME: {
    label: "CNAME – Canonical name",
    description: "Routes traffic to another domain name.",
    placeholder: "example.com",
    valueHint:
      "A single domain name. A CNAME cannot share a name with any other record.",
    multiValue: false,
  },
  MX: {
    label: "MX – Mail exchange",
    description: "Routes mail to the servers that accept it for this domain.",
    placeholder: "10 mail.example.com",
    valueHint:
      "Priority then mail server, one per line — for example 10 mail.example.com. Lower priority wins.",
    multiValue: true,
  },
  TXT: {
    label: "TXT – Text",
    description: "Holds arbitrary text, commonly SPF, DKIM and domain verification.",
    placeholder: '"v=spf1 include:amazonses.com -all"',
    valueHint:
      'Each value in double quotes, one per line. Split anything over 255 bytes into several quoted strings: "part one" "part two"',
    multiValue: true,
  },
  NS: {
    label: "NS – Name server",
    description: "Delegates a subdomain to another set of name servers.",
    placeholder: "ns-1.awsdns-00.com",
    valueHint: "One name server per line.",
    multiValue: true,
  },
  PTR: {
    label: "PTR – Pointer",
    description: "Maps an IP address back to a domain name, for reverse lookups.",
    placeholder: "host.example.com",
    valueHint: "One domain name per line.",
    multiValue: true,
  },
  SRV: {
    label: "SRV – Service locator",
    description: "Advertises the host and port for a named service.",
    placeholder: "1 10 5269 xmpp.example.com",
    valueHint:
      "Priority, weight, port then target, one per line — for example 1 10 5269 xmpp.example.com",
    multiValue: true,
  },
  CAA: {
    label: "CAA – Certification authority authorisation",
    description: "Names the certificate authorities allowed to issue for this domain.",
    placeholder: '0 issue "amazon.com"',
    valueHint:
      'Flags, tag then a quoted value — for example 0 issue "amazon.com". Tag must be issue, issuewild or iodef.',
    multiValue: true,
  },
  SOA: {
    label: "SOA – Start of authority",
    description: "Authoritative information about the zone. Managed by Route 53.",
    placeholder: "",
    valueHint: "Created with the hosted zone and cannot be edited.",
    multiValue: false,
  },
};

/**
 * The order the console lists types in — alphabetical, as Route 53 does, so
 * scanning the dropdown for a known type is predictable.
 */
export const CREATABLE_RECORD_TYPES: readonly RecordType[] = [
  "A",
  "AAAA",
  "CAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SRV",
  "TXT",
];

/** Every type that can appear in the table, including the zone-owned SOA. */
export const ALL_RECORD_TYPES: readonly AnyRecordType[] = [
  ...CREATABLE_RECORD_TYPES,
  "SOA",
];

/* ==========================================================================
   Routing policies
   ========================================================================== */

export interface RoutingPolicyInfo {
  label: string;
  description: string;
  /** Extra fields the policy makes mandatory. Mirrors the backend's rules. */
  requires: {
    setIdentifier: boolean;
    weight: boolean;
    region: boolean;
    failoverType: boolean;
  };
}

const NO_REQUIREMENTS = {
  setIdentifier: false,
  weight: false,
  region: false,
  failoverType: false,
};

export const ROUTING_POLICY_INFO: Record<RoutingPolicy, RoutingPolicyInfo> = {
  simple: {
    label: "Simple routing",
    description: "One record, one answer. The default.",
    requires: NO_REQUIREMENTS,
  },
  weighted: {
    label: "Weighted",
    description:
      "Split traffic between several records in proportions you choose.",
    requires: { ...NO_REQUIREMENTS, setIdentifier: true, weight: true },
  },
  latency: {
    label: "Latency",
    description: "Answer with the region that responds fastest for the client.",
    requires: { ...NO_REQUIREMENTS, setIdentifier: true, region: true },
  },
  failover: {
    label: "Failover",
    description: "Answer with the secondary record when the primary is unhealthy.",
    requires: { ...NO_REQUIREMENTS, setIdentifier: true, failoverType: true },
  },
  geolocation: {
    label: "Geolocation",
    description: "Answer based on where the query came from.",
    requires: { ...NO_REQUIREMENTS, setIdentifier: true },
  },
  multivalue: {
    label: "Multivalue answer",
    description: "Return up to eight healthy records chosen at random.",
    requires: { ...NO_REQUIREMENTS, setIdentifier: true },
  },
};

export const ROUTING_POLICIES: readonly RoutingPolicy[] = [
  "simple",
  "weighted",
  "latency",
  "failover",
  "geolocation",
  "multivalue",
];

/* ==========================================================================
   TTL
   ========================================================================== */

/** The shortcuts Route 53 offers beside the TTL field. */
export const TTL_PRESETS: readonly { label: string; seconds: number }[] = [
  { label: "1 minute", seconds: 60 },
  { label: "5 minutes", seconds: 300 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86_400 },
];

export const DEFAULT_TTL = 300;

/**
 * Strip the zone suffix from a fully qualified record name.
 *
 * The API stores and returns names in full, but the form edits only the prefix
 * — the console renders the zone name as static text beside the input.
 */
export function toRecordNamePrefix(fqdn: string, zoneName: string): string {
  if (fqdn === zoneName) return "";
  const suffix = `.${zoneName}`;
  return fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) : fqdn;
}
