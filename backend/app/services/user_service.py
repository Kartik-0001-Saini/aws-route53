"""Resolving a verified token into a local user row."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.identifiers import generate_aws_account_id
from app.core.security import VerifiedIdentity
from app.db.base import utcnow
from app.db.seed import seed_user
from app.models import User

logger = logging.getLogger(__name__)


def resolve_user(db: Session, identity: VerifiedIdentity) -> User:
    """Find or create the `users` row for a verified identity.

    This is the only place a user row is created. Firebase owns authentication;
    the first time an authenticated uid appears here, it gets a local row, a
    mocked AWS account number, and a seeded set of hosted zones.
    """
    user = db.scalar(select(User).where(User.firebase_uid == identity.uid))

    if user is None:
        user = _create_user(db, identity)
        seed_user(db, user)
    else:
        _refresh_profile(user, identity)

    user.last_login_at = utcnow()
    db.commit()
    db.refresh(user)
    return user


def _create_user(db: Session, identity: VerifiedIdentity) -> User:
    """Insert a new user, tolerating a concurrent insert of the same uid."""
    user = User(
        firebase_uid=identity.uid,
        email=identity.email,
        display_name=identity.display_name,
        photo_url=identity.photo_url,
        provider=identity.provider,
        aws_account_id=generate_aws_account_id(),
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # Two requests from the same fresh session can race on the unique
        # `firebase_uid`. The loser re-reads the winner's row rather than
        # surfacing a 500 for what is a successful login.
        db.rollback()
        existing = db.scalar(select(User).where(User.firebase_uid == identity.uid))
        if existing is None:
            raise
        logger.info("Concurrent sign-up resolved for %s", identity.email)
        return existing

    db.refresh(user)
    logger.info("Created user %s via %s", user.email, user.provider)
    return user


def _refresh_profile(user: User, identity: VerifiedIdentity) -> None:
    """Keep the local profile in step with the identity provider.

    A user who changes their Google display name or avatar should see it
    change in the console header on their next sign-in.
    """
    user.email = identity.email
    if identity.display_name:
        user.display_name = identity.display_name
    if identity.photo_url:
        user.photo_url = identity.photo_url
