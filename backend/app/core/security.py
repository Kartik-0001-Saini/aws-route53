"""Token verification for both login paths.

Two ways in, one contract. Whichever path a client used, it presents
`Authorization: Bearer <token>` and this module resolves it to a
`VerifiedIdentity`. Nothing downstream — dependencies, services, routers —
knows or cares which path produced it.

* **Google** — a Firebase ID token, verified against Google's public keys by
  `firebase-admin`. Signature, issuer, audience and expiry are all checked.
* **Demo** — a short-lived HS256 JWT this backend both mints and verifies, so
  the "Continue as demo user" button costs the API no special-casing.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Final

import jwt

from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.models.enums import AuthProvider

logger = logging.getLogger(__name__)

#: Fixed uid for the shared demo account. Constant, so every demo session lands
#: on the same `users` row and the same seeded zones.
DEMO_UID: Final[str] = "demo-user-fixed-uid"

_DEMO_ISSUER: Final[str] = "route53-clone-demo"
_DEMO_ALGORITHM: Final[str] = "HS256"

_firebase_app: Any | None = None
_firebase_init_attempted = False


@dataclass(frozen=True, slots=True)
class VerifiedIdentity:
    """The trustworthy facts about a caller, extracted from a valid token."""

    uid: str
    email: str
    display_name: str | None
    photo_url: str | None
    provider: AuthProvider


# ---------------------------------------------------------------------------
# Firebase
# ---------------------------------------------------------------------------


def _decode_service_account() -> dict[str, Any]:
    """Decode the base64 service-account blob from the environment."""
    raw = settings.FIREBASE_SERVICE_ACCOUNT_B64.strip()
    try:
        decoded = base64.b64decode(raw, validate=True)
        return json.loads(decoded)
    except (binascii.Error, ValueError) as exc:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64-encoded JSON. "
            "Re-encode the service-account file with:\n"
            '  [Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))'
        ) from exc


def init_firebase() -> None:
    """Initialise the Firebase Admin SDK once, at startup.

    Deliberately non-fatal: a misconfigured or absent service account disables
    Google sign-in but leaves the demo path working, so a broken credential
    never takes the whole API down.
    """
    global _firebase_app, _firebase_init_attempted

    if _firebase_init_attempted:
        return
    _firebase_init_attempted = True

    if not settings.firebase_enabled:
        logger.warning(
            "FIREBASE_SERVICE_ACCOUNT_B64 is not set — Google sign-in is "
            "disabled. The demo login still works."
        )
        return

    try:
        import firebase_admin
        from firebase_admin import credentials

        service_account = _decode_service_account()
        _firebase_app = firebase_admin.initialize_app(
            credentials.Certificate(service_account)
        )
        logger.info(
            "Firebase Admin initialised for project %s",
            service_account.get("project_id", "<unknown>"),
        )
    except Exception:
        logger.exception("Firebase Admin failed to initialise; Google sign-in is off")
        _firebase_app = None


def is_firebase_ready() -> bool:
    return _firebase_app is not None


def verify_firebase_token(token: str) -> VerifiedIdentity:
    """Verify a Firebase ID token and extract the caller's identity."""
    if _firebase_app is None:
        raise AuthenticationError(
            "Google sign-in is not configured on this server.",
            code="ProviderUnavailable",
        )

    from firebase_admin import auth as firebase_auth

    try:
        claims = firebase_auth.verify_id_token(token, app=_firebase_app)
    except firebase_auth.ExpiredIdTokenError as exc:
        raise AuthenticationError(
            "Your session has expired. Please sign in again.", code="TokenExpired"
        ) from exc
    except firebase_auth.RevokedIdTokenError as exc:
        raise AuthenticationError(
            "This session has been revoked. Please sign in again.",
            code="TokenRevoked",
        ) from exc
    except Exception as exc:
        # Bad signature, wrong audience, malformed token — all indistinguishable
        # to the caller on purpose, so the response leaks nothing.
        logger.warning("Firebase token rejected: %s", exc)
        raise AuthenticationError("Invalid authentication token.") from exc

    email = claims.get("email")
    if not email:
        raise AuthenticationError(
            "This account has no email address associated with it.",
            code="EmailRequired",
        )

    return VerifiedIdentity(
        uid=claims["uid"],
        email=email,
        display_name=claims.get("name"),
        photo_url=claims.get("picture"),
        provider=AuthProvider.GOOGLE,
    )


# ---------------------------------------------------------------------------
# Demo session
# ---------------------------------------------------------------------------


def issue_demo_token() -> tuple[str, datetime]:
    """Mint a signed demo session token. Returns the token and its expiry."""
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.DEMO_SESSION_TTL_HOURS
    )
    payload = {
        "sub": DEMO_UID,
        "iss": _DEMO_ISSUER,
        "email": settings.DEMO_USER_EMAIL,
        "name": settings.DEMO_USER_NAME,
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.DEMO_TOKEN_SECRET, algorithm=_DEMO_ALGORITHM)
    return token, expires_at


def verify_demo_token(token: str) -> VerifiedIdentity:
    """Verify a demo session token minted by `issue_demo_token`."""
    try:
        claims = jwt.decode(
            token,
            settings.DEMO_TOKEN_SECRET,
            algorithms=[_DEMO_ALGORITHM],
            issuer=_DEMO_ISSUER,
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError(
            "Your demo session has expired. Please sign in again.",
            code="TokenExpired",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid authentication token.") from exc

    return VerifiedIdentity(
        uid=claims["sub"],
        email=claims.get("email", settings.DEMO_USER_EMAIL),
        display_name=claims.get("name", settings.DEMO_USER_NAME),
        photo_url=None,
        provider=AuthProvider.DEMO,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def verify_token(token: str) -> VerifiedIdentity:
    """Resolve any Bearer token to an identity.

    The demo token is tried first because it is cheap, local, and identifiable
    by its issuer — a Firebase token can never satisfy it, so there is no risk
    of one path shadowing the other.
    """
    if not token or not token.strip():
        raise AuthenticationError("Authentication token is missing.")

    try:
        return verify_demo_token(token)
    except AuthenticationError as demo_error:
        # An *expired* demo token is a demo token. Re-raise rather than letting
        # it fall through to Firebase and come back as "invalid token", which
        # would send the user chasing the wrong problem.
        if demo_error.code == "TokenExpired":
            raise

    return verify_firebase_token(token)
