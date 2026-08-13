"""Per-record-type DNS validation.

Pure functions — no database, no HTTP, no ORM. That keeps the rules unit
testable in isolation and means the same logic can serve the API, the BIND
importer, and the seeder without any of them reaching through a service.

The rules follow what Route53 itself enforces, because a clone that accepts
`999.1.1.1` as an A record stops feeling like the real console the moment
anyone tries it.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Final

from app.core.exceptions import ValidationError
from app.models.enums import RecordType

# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------

MIN_TTL: Final[int] = 0
MAX_TTL: Final[int] = 2_147_483_647  # Route53's ceiling: a signed 32-bit int
MAX_DOMAIN_LENGTH: Final[int] = 255
MAX_LABEL_LENGTH: Final[int] = 63
MAX_TXT_CHUNK_LENGTH: Final[int] = 255
MAX_UINT16: Final[int] = 65_535

#: One DNS label. Letters, digits and hyphens; no leading or trailing hyphen.
#: `_` is permitted because SRV and DMARC names require it, and `*` because
#: Route53 supports a leading wildcard label.
_LABEL_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^(?!-)[a-z0-9_-]{1,63}(?<!-)$"
)

_CAA_TAGS: Final[frozenset[str]] = frozenset({"issue", "issuewild", "iodef"})


# ---------------------------------------------------------------------------
# Names
# ---------------------------------------------------------------------------


def normalise_domain(name: str) -> str:
    """Canonicalise a domain name: lower-cased, no trailing dot, trimmed.

    Storing one canonical form is what makes the unique constraint on
    (zone, name, type) meaningful — otherwise `Example.com.` and `example.com`
    would be two different records pointing at the same place.
    """
    return name.strip().rstrip(".").lower()


def validate_domain_name(name: str, *, field: str = "name") -> str:
    """Validate and canonicalise a domain name, or raise `ValidationError`."""
    canonical = normalise_domain(name)

    if not canonical:
        raise ValidationError(
            "Enter a domain name.", details={"fields": {field: "Required."}}
        )

    if len(canonical) > MAX_DOMAIN_LENGTH:
        raise ValidationError(
            f"Domain names cannot exceed {MAX_DOMAIN_LENGTH} characters.",
            details={"fields": {field: "Too long."}},
        )

    labels = canonical.split(".")
    if len(labels) < 2:
        raise ValidationError(
            "Enter a fully qualified domain name, for example example.com.",
            details={"fields": {field: "Must include a top-level domain."}},
        )

    for index, label in enumerate(labels):
        # A wildcard is only legal as the leftmost label.
        if label == "*" and index == 0:
            continue
        if len(label) > MAX_LABEL_LENGTH:
            raise ValidationError(
                f"Each part of a domain name must be {MAX_LABEL_LENGTH} "
                "characters or fewer.",
                details={"fields": {field: f"'{label}' is too long."}},
            )
        if not _LABEL_PATTERN.match(label):
            raise ValidationError(
                "Domain names can contain only letters, digits and hyphens, "
                "and cannot begin or end with a hyphen.",
                details={"fields": {field: f"'{label}' is not valid."}},
            )

    return canonical


def validate_record_name(name: str, zone_name: str) -> str:
    """Resolve a record name against its zone and validate the result.

    Route53's console treats this field as a *prefix*: it renders the zone name
    as static text beside the input, so typing `www` in the example.com zone
    creates `www.example.com`. Anything that is not already inside the zone is
    therefore appended to it rather than rejected — `other.com` becomes
    `other.com.example.com`, which is exactly what the real console does.

    The one case that cannot be resolved is a name that ends with the zone
    name without being inside it: `notexample.com` ends with `example.com` but
    is a different domain, so appending would be wrong and accepting it as-is
    would put a record outside its own zone. That is rejected.
    """
    zone = normalise_domain(zone_name)
    candidate = normalise_domain(name)

    if not candidate:
        return zone  # An empty name means the zone apex.

    fqdn = candidate if candidate.endswith(zone) else f"{candidate}.{zone}"

    if fqdn != zone and not fqdn.endswith(f".{zone}"):
        raise ValidationError(
            f"The record name must be within the {zone} hosted zone.",
            details={"fields": {"name": f"Must end with .{zone}"}},
        )

    return validate_domain_name(fqdn)


# ---------------------------------------------------------------------------
# TTL
# ---------------------------------------------------------------------------


def validate_ttl(ttl: int | None, *, is_alias: bool) -> int | None:
    """Validate a TTL. Alias records take their target's TTL and must omit it."""
    if is_alias:
        return None

    if ttl is None:
        raise ValidationError(
            "Enter a TTL.", details={"fields": {"ttl": "Required."}}
        )

    if not MIN_TTL <= ttl <= MAX_TTL:
        raise ValidationError(
            f"TTL must be between {MIN_TTL} and {MAX_TTL} seconds.",
            details={"fields": {"ttl": "Out of range."}},
        )

    return ttl


# ---------------------------------------------------------------------------
# Values, by record type
# ---------------------------------------------------------------------------


def _fail(message: str, value: str) -> ValidationError:
    return ValidationError(
        message, details={"fields": {"value": f"'{value}' is not valid."}}
    )


def _validate_a(value: str) -> None:
    try:
        if not isinstance(ipaddress.ip_address(value), ipaddress.IPv4Address):
            raise ValueError
    except ValueError:
        raise _fail("Enter a valid IPv4 address, for example 192.0.2.1.", value) from None


def _validate_aaaa(value: str) -> None:
    try:
        if not isinstance(ipaddress.ip_address(value), ipaddress.IPv6Address):
            raise ValueError
    except ValueError:
        raise _fail(
            "Enter a valid IPv6 address, for example 2001:db8::1.", value
        ) from None


def _validate_hostname(value: str, example: str) -> None:
    try:
        validate_domain_name(value, field="value")
    except ValidationError:
        raise _fail(f"Enter a valid domain name, for example {example}.", value) from None


def _validate_txt(value: str) -> None:
    """TXT values must be quoted, and each quoted string capped at 255 bytes."""
    if not (value.startswith('"') and value.endswith('"') and len(value) >= 2):
        raise _fail(
            'Enclose TXT values in double quotes, for example "v=spf1 -all".', value
        )

    for chunk in re.findall(r'"([^"]*)"', value):
        if len(chunk.encode("utf-8")) > MAX_TXT_CHUNK_LENGTH:
            raise _fail(
                f"Each quoted string in a TXT record must be "
                f"{MAX_TXT_CHUNK_LENGTH} bytes or fewer. Split longer values "
                'into several quoted strings: "part one" "part two".',
                value,
            )


def _parse_uint16(raw: str, label: str, value: str) -> None:
    if not raw.isdigit() or not 0 <= int(raw) <= MAX_UINT16:
        raise _fail(f"{label} must be a number between 0 and {MAX_UINT16}.", value)


def _validate_mx(value: str) -> None:
    """`<priority> <mail server>`, e.g. `10 mail.example.com`."""
    parts = value.split()
    if len(parts) != 2:
        raise _fail(
            "MX values must be a priority followed by a mail server, "
            "for example 10 mail.example.com.",
            value,
        )
    _parse_uint16(parts[0], "MX priority", value)
    _validate_hostname(parts[1], "mail.example.com")


def _validate_srv(value: str) -> None:
    """`<priority> <weight> <port> <target>`, e.g. `1 10 5269 xmpp.example.com`."""
    parts = value.split()
    if len(parts) != 4:
        raise _fail(
            "SRV values must be priority, weight, port and target, "
            "for example 1 10 5269 xmpp.example.com.",
            value,
        )
    for raw, label in zip(parts[:3], ("SRV priority", "SRV weight", "SRV port")):
        _parse_uint16(raw, label, value)
    _validate_hostname(parts[3], "xmpp.example.com")


def _validate_caa(value: str) -> None:
    """`<flags> <tag> "<value>"`, e.g. `0 issue "amazon.com"`."""
    parts = value.split(maxsplit=2)
    if len(parts) != 3:
        raise _fail(
            'CAA values must be flags, tag and a quoted value, '
            'for example 0 issue "amazon.com".',
            value,
        )

    flags, tag, tag_value = parts
    if not flags.isdigit() or not 0 <= int(flags) <= 255:
        raise _fail("CAA flags must be a number between 0 and 255.", value)
    if tag.lower() not in _CAA_TAGS:
        raise _fail(
            f"CAA tag must be one of: {', '.join(sorted(_CAA_TAGS))}.", value
        )
    if not (tag_value.startswith('"') and tag_value.endswith('"')):
        raise _fail("Enclose the CAA value in double quotes.", value)


def _validate_soa(value: str) -> None:
    if len(value.split()) != 7:
        raise _fail(
            "SOA values must have seven fields: primary name server, "
            "responsible party, serial, refresh, retry, expire and minimum TTL.",
            value,
        )


_VALIDATORS = {
    RecordType.A: _validate_a,
    RecordType.AAAA: _validate_aaaa,
    RecordType.CNAME: lambda v: _validate_hostname(v, "example.com"),
    RecordType.NS: lambda v: _validate_hostname(v, "ns-1.awsdns-00.com"),
    RecordType.PTR: lambda v: _validate_hostname(v, "host.example.com"),
    RecordType.TXT: _validate_txt,
    RecordType.MX: _validate_mx,
    RecordType.SRV: _validate_srv,
    RecordType.CAA: _validate_caa,
    RecordType.SOA: _validate_soa,
}

#: Types that may hold only one value. A CNAME must be the only record for its
#: name, and by extension can never be a multi-value set.
_SINGLE_VALUE_TYPES: Final[frozenset[RecordType]] = frozenset(
    {RecordType.CNAME, RecordType.SOA}
)


def validate_record_values(record_type: RecordType, raw_value: str) -> str:
    """Validate every line of a record set's value and return it normalised.

    Returns the values rejoined with newlines, blank lines and stray whitespace
    removed, ready to store.
    """
    values = [line.strip() for line in raw_value.splitlines() if line.strip()]

    if not values:
        raise ValidationError(
            "Enter a value for this record.",
            details={"fields": {"value": "Required."}},
        )

    if record_type in _SINGLE_VALUE_TYPES and len(values) > 1:
        raise ValidationError(
            f"A {record_type} record can have only one value.",
            details={"fields": {"value": f"{len(values)} values were provided."}},
        )

    validator = _VALIDATORS.get(record_type)
    if validator is None:  # pragma: no cover - unreachable while the map is total
        raise ValidationError(f"Unsupported record type: {record_type}.")

    seen: set[str] = set()
    for value in values:
        validator(value)
        if value in seen:
            raise ValidationError(
                "This record contains duplicate values.",
                details={"fields": {"value": f"'{value}' appears more than once."}},
            )
        seen.add(value)

    return "\n".join(values)
