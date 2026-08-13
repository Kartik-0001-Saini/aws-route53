"""BIND zone-file import and export.

Pure text transformation — no database, no HTTP. The importer produces the same
`DnsRecordCreate` payloads the API accepts, so an imported record goes through
exactly the validation a hand-typed one does; there is no second, looser path
into the database.

The subset implemented is the one Route 53's own import accepts: `$ORIGIN`,
`$TTL`, the owner-name shorthands (`@`, blank-for-repeat, relative names), and
the record types in the assignment. Deliberately unsupported: `$INCLUDE` (it
reads from the filesystem), and `$GENERATE` (a macro language of its own).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Final

from app.models import DnsRecord, HostedZone
from app.models.enums import RecordType
from app.schemas.dns_record import DnsRecordCreate
from app.validators.dns import normalise_domain

#: Classes a zone file may declare. Only IN is meaningful here, but CH and HS
#: appear in real files and must be skipped rather than parsed as a type.
_CLASSES: Final[frozenset[str]] = frozenset({"IN", "CH", "HS"})

_DEFAULT_TTL: Final[int] = 300

#: `1h`, `2d`, `1w` — BIND's time shorthand, permitted wherever a TTL appears.
_DURATION_UNITS: Final[dict[str, int]] = {
    "s": 1,
    "m": 60,
    "h": 3_600,
    "d": 86_400,
    "w": 604_800,
}

_DURATION_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^(\d+)([smhdwSMHDW]?)$"
)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def export_zone_to_bind(zone: HostedZone, records: list[DnsRecord]) -> str:
    """Render a hosted zone as a BIND zone file.

    Output is sorted SOA first, then NS, then everything else alphabetically —
    the conventional layout, and one that produces a stable diff when the same
    zone is exported twice.
    """
    lines: list[str] = [
        f"; Zone file for {zone.name}",
        f"; Exported from Route 53 clone — hosted zone {zone.zone_id}",
        ";",
        f"$ORIGIN {zone.name}.",
        f"$TTL {_DEFAULT_TTL}",
        "",
    ]

    def sort_key(record: DnsRecord) -> tuple[int, str, str]:
        priority = {RecordType.SOA: 0, RecordType.NS: 1}.get(record.type, 2)
        return (priority, record.name, str(record.type))

    for record in sorted(records, key=sort_key):
        # Alias records point at an AWS resource and have no zone-file
        # equivalent. Emitting a broken line would produce a file that fails to
        # reimport, so they are noted as a comment instead.
        if record.is_alias:
            lines.append(
                f"; {_relative_name(record.name, zone.name)} {record.type} "
                f"ALIAS -> {record.alias_target} (not representable in BIND)"
            )
            continue

        owner = _relative_name(record.name, zone.name)
        ttl = record.ttl if record.ttl is not None else _DEFAULT_TTL

        for value in record.values:
            lines.append(
                f"{owner}\t{ttl}\tIN\t{record.type}\t"
                f"{_qualify_value(record.type, value, zone.name)}"
            )

    lines.append("")
    return "\n".join(lines)


def _relative_name(fqdn: str, zone_name: str) -> str:
    """`www.example.com` in zone `example.com` becomes `www`; the apex is `@`."""
    if fqdn == zone_name:
        return "@"

    suffix = f".{zone_name}"
    return fqdn[: -len(suffix)] if fqdn.endswith(suffix) else f"{fqdn}."


def _qualify_value(record_type: RecordType, value: str, zone_name: str) -> str:
    """Add the trailing dot that makes a hostname absolute in a zone file.

    Without it, `mail.example.com` in a zone-file value is read as
    `mail.example.com.example.com` — the single most common way a hand-written
    zone file breaks.
    """
    if record_type in {RecordType.TXT, RecordType.CAA, RecordType.SOA}:
        return value

    if record_type is RecordType.MX:
        parts = value.split()
        if len(parts) == 2:
            return f"{parts[0]} {_absolute(parts[1], zone_name)}"
        return value

    if record_type is RecordType.SRV:
        parts = value.split()
        if len(parts) == 4:
            return f"{' '.join(parts[:3])} {_absolute(parts[3], zone_name)}"
        return value

    if record_type in {RecordType.CNAME, RecordType.NS, RecordType.PTR}:
        return _absolute(value, zone_name)

    return value  # A and AAAA are addresses, not names.


def _absolute(host: str, _zone_name: str) -> str:
    return host if host.endswith(".") else f"{host}."


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ParsedZoneFile:
    """The outcome of parsing a zone file.

    Skipped lines are reported rather than dropped: an import that silently
    ignores half a file is worse than one that says what it could not read.
    """

    records: list[DnsRecordCreate] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def parse_bind_zone_file(content: str, zone_name: str) -> ParsedZoneFile:
    """Parse a BIND zone file into API payloads.

    Multi-value record sets are merged: three A lines for `www` become one
    payload with three newline-separated values, which is how Route 53 models
    them and what the API's uniqueness constraint expects.
    """
    result = ParsedZoneFile()
    origin = normalise_domain(zone_name)
    default_ttl = _DEFAULT_TTL
    last_owner = origin

    # Keyed by (name, type) so repeated lines collapse into one record set.
    grouped: dict[tuple[str, RecordType], list[str]] = {}
    ttls: dict[tuple[str, RecordType], int] = {}

    for raw_line, line_number in _logical_lines(content):
        line = _strip_comment(raw_line)
        if not line.strip():
            continue

        # ---- Directives ---------------------------------------------------
        if line.upper().startswith("$ORIGIN"):
            parts = line.split()
            if len(parts) >= 2:
                origin = normalise_domain(parts[1])
            continue

        if line.upper().startswith("$TTL"):
            parts = line.split()
            if len(parts) >= 2:
                parsed = _parse_duration(parts[1])
                if parsed is not None:
                    default_ttl = parsed
            continue

        if line.upper().startswith(("$INCLUDE", "$GENERATE")):
            result.skipped.append(
                f"Line {line_number}: {line.split()[0]} is not supported."
            )
            continue

        # ---- Records ------------------------------------------------------
        # A line starting with whitespace repeats the previous owner name.
        owner_omitted = raw_line[:1] in {" ", "\t"}
        tokens = line.split()
        if not tokens:
            continue

        if owner_omitted:
            owner = last_owner
        else:
            owner = _resolve_owner(tokens.pop(0), origin)
            last_owner = owner

        ttl, record_type, value = _parse_record_body(tokens, default_ttl)

        if record_type is None:
            result.skipped.append(
                f"Line {line_number}: could not determine a record type."
            )
            continue

        if record_type is RecordType.SOA:
            # SOA is created with the hosted zone and is not user-importable.
            continue

        try:
            parsed_type = RecordType(record_type)
        except ValueError:
            result.skipped.append(
                f"Line {line_number}: unsupported record type {record_type}."
            )
            continue

        if not value:
            result.skipped.append(f"Line {line_number}: no value.")
            continue

        key = (owner, parsed_type)
        grouped.setdefault(key, []).append(
            _normalise_value(parsed_type, value, origin)
        )
        ttls.setdefault(key, ttl)

    for (name, record_type), values in grouped.items():
        result.records.append(
            DnsRecordCreate(
                name=name,
                type=record_type,
                value="\n".join(values),
                ttl=ttls[(name, record_type)],
            )
        )

    return result


def _logical_lines(content: str) -> list[tuple[str, int]]:
    """Split into lines, joining BIND's parenthesised continuations.

    A multi-line SOA record spans several physical lines inside `( ... )`; each
    has to be reassembled before it can be parsed as one record.
    """
    lines: list[tuple[str, int]] = []
    buffer = ""
    buffer_start = 0
    depth = 0

    for index, physical in enumerate(content.splitlines(), start=1):
        stripped = _strip_comment(physical)
        depth += stripped.count("(") - stripped.count(")")

        if depth > 0:
            if not buffer:
                buffer = physical
                buffer_start = index
            else:
                buffer += " " + physical.strip()
            continue

        if buffer:
            buffer += " " + physical.strip()
            lines.append((buffer.replace("(", " ").replace(")", " "), buffer_start))
            buffer = ""
            depth = 0
        else:
            lines.append((physical, index))

    if buffer:
        lines.append((buffer.replace("(", " ").replace(")", " "), buffer_start))

    return lines


def _strip_comment(line: str) -> str:
    """Remove a trailing `;` comment, ignoring semicolons inside quotes.

    TXT values legitimately contain semicolons — a DMARC record is mostly
    semicolons — so a naive `split(";")` would truncate them.
    """
    out: list[str] = []
    in_quotes = False

    for char in line:
        if char == '"':
            in_quotes = not in_quotes
        elif char == ";" and not in_quotes:
            break
        out.append(char)

    return "".join(out)


def _resolve_owner(token: str, origin: str) -> str:
    """Resolve a zone-file owner name to a fully qualified name."""
    if token == "@":
        return origin
    if token.endswith("."):
        return normalise_domain(token)
    return normalise_domain(f"{token}.{origin}")


def _parse_duration(token: str) -> int | None:
    """Parse `3600`, `1h`, `2d` into seconds."""
    match = _DURATION_PATTERN.match(token)
    if not match:
        return None

    amount, unit = match.groups()
    return int(amount) * _DURATION_UNITS.get(unit.lower(), 1) if unit else int(amount)


def _parse_record_body(
    tokens: list[str], default_ttl: int
) -> tuple[int, str | None, str]:
    """Extract TTL, type and value from the tokens after the owner name.

    The middle of a zone-file line is famously loose: TTL and class may each be
    present or absent, in either order. Rather than guess by position, tokens
    are consumed while they look like a TTL or a class, and whatever follows is
    the type.
    """
    ttl = default_ttl

    while tokens:
        candidate = tokens[0]

        if candidate.upper() in _CLASSES:
            tokens.pop(0)
            continue

        parsed = _parse_duration(candidate)
        if parsed is not None:
            ttl = parsed
            tokens.pop(0)
            continue

        break

    if not tokens:
        return ttl, None, ""

    record_type = tokens.pop(0).upper()
    return ttl, record_type, " ".join(tokens).strip()


def _normalise_value(record_type: RecordType, value: str, origin: str) -> str:
    """Convert a zone-file value into the form the API stores.

    Two conversions, both of which are silent corruption if missed:

    * `@` means the origin. `www IN CNAME @` is the ordinary way to point a
      subdomain at the apex, and storing a literal "@" fails validation.
    * The trailing dot that makes a zone-file name absolute is not stored.

    TXT and CAA are exempt from both: their quoted payloads may legitimately
    contain an `@` (every DMARC record does) or end in a dot.
    """
    if record_type in {RecordType.TXT, RecordType.CAA}:
        return value

    if record_type is RecordType.MX:
        parts = value.split()
        return (
            f"{parts[0]} {_normalise_host(parts[1], origin)}"
            if len(parts) == 2
            else value
        )

    if record_type is RecordType.SRV:
        parts = value.split()
        return (
            f"{' '.join(parts[:3])} {_normalise_host(parts[3], origin)}"
            if len(parts) == 4
            else value
        )

    return _normalise_host(value, origin)


def _normalise_host(host: str, origin: str) -> str:
    """Resolve `@` to the origin and drop a zone-file trailing dot."""
    if host == "@":
        return origin
    return host.rstrip(".") if host.endswith(".") else host


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------


def export_zone_to_dict(zone: HostedZone, records: list[DnsRecord]) -> dict:
    """Render a hosted zone as a JSON-serialisable structure.

    Shaped to be re-importable and to read like the API's own responses rather
    than a database dump — no primary keys, no user id.
    """
    return {
        "hosted_zone": {
            "id": zone.zone_id,
            "name": zone.name,
            "type": str(zone.type),
            "comment": zone.comment,
            "name_servers": zone.name_servers,
            "created_at": zone.created_at.isoformat(),
        },
        "record_count": len(records),
        "records": [
            {
                "name": record.name,
                "type": str(record.type),
                "ttl": record.ttl,
                "values": record.values,
                "routing_policy": str(record.routing_policy),
                "set_identifier": record.set_identifier or None,
                "weight": record.weight,
                "region": record.region,
                "failover_type": (
                    str(record.failover_type) if record.failover_type else None
                ),
                "alias_target": record.alias_target,
                "managed_by_route53": record.is_system,
            }
            for record in records
        ],
    }
