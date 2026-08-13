"""Generators for the AWS-shaped identifiers the console displays.

None of these are real AWS values — they exist so the UI reads like Route53
instead of showing database primary keys. They are deliberately kept together
so the "what does an AWS id look like" knowledge lives in one file.
"""

from __future__ import annotations

import secrets

# Base32-style alphabet: uppercase letters and digits, as AWS resource ids use.
_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

#: Route53 zone ids are "Z" followed by 21 characters, e.g. Z04773791BUYSTFF9NQ4M.
_ZONE_ID_BODY_LENGTH = 21


def generate_zone_id() -> str:
    """A Route53-style hosted zone id."""
    body = "".join(secrets.choice(_ID_ALPHABET) for _ in range(_ZONE_ID_BODY_LENGTH))
    return f"Z{body}"


def generate_aws_account_id() -> str:
    """A 12-digit AWS account number for the top navigation.

    Never starts with 0, because real account ids are shown in full and a
    leading zero reads as a formatting bug.
    """
    first = secrets.choice("123456789")
    rest = "".join(secrets.choice("0123456789") for _ in range(11))
    return f"{first}{rest}"


def generate_name_servers() -> list[str]:
    """The four delegated name servers assigned to a new hosted zone.

    Real Route53 hands out one server from each of four TLDs (.com, .net, .org,
    .co.uk) drawn from a delegation set, and the numbering is consecutive. That
    pattern is reproduced here because it is visible on the zone detail page.
    """
    base = secrets.randbelow(2000) + 128  # keep the numbers plausibly sized
    suffixes = ("com", "net", "org", "co.uk")
    return [
        f"ns-{base + index}.awsdns-{(base + index) % 64:02d}.{suffix}"
        for index, suffix in enumerate(suffixes)
    ]


def build_soa_value(primary_name_server: str) -> str:
    """The SOA record value Route53 creates with every public hosted zone.

    Fields, in order: primary NS, responsible party, serial, refresh, retry,
    expire, minimum TTL.
    """
    return (
        f"{primary_name_server}. awsdns-hostmaster.amazon.com. "
        "1 7200 900 1209600 86400"
    )
