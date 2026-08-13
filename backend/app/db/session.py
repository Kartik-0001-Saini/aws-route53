"""Engine, session factory, and the FastAPI session dependency."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    # SQLite guards connections against cross-thread use; FastAPI runs sync
    # endpoints in a threadpool, so a connection legitimately moves threads.
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
    echo=False,
)


if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _connection_record) -> None:
        """Per-connection PRAGMAs.

        `foreign_keys=ON` is the important one: SQLite ignores foreign keys —
        including `ON DELETE CASCADE` — unless it is set on every connection.
        Without it, deleting a hosted zone would orphan its records instead of
        removing them.
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # WAL lets reads proceed during a write, which matters on a single-file
        # DB served by a multi-threaded app.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Request-scoped session.

    Commits are the service layer's job. This only guarantees the session is
    closed and any in-flight transaction is rolled back when the request ends.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_sqlite_database() -> None:
    """Create SQLite tables for serverless/demo deployments.

    Production on Vercel uses an empty database file under /tmp, so Alembic is
    not available before the first request. Importing models populates
    Base.metadata before create_all runs.
    """
    if not _is_sqlite:
        return

    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)


__all__ = ["engine", "SessionLocal", "get_db", "init_sqlite_database", "Engine"]
