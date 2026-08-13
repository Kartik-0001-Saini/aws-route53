"""Alembic environment.

Two things here are load-bearing on SQLite and easy to get wrong:

1. `render_as_batch=True` — SQLite cannot `ALTER COLUMN` or drop a constraint.
   Batch mode makes Alembic rebuild the table instead, which only works
   because `db/base.py` gives every constraint a deterministic name.
2. The URL comes from app settings, not `alembic.ini`, so a migration can
   never run against a different database than the app.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, event, pool

from app.core.config import settings

# Importing the package registers every model on Base.metadata. Without this,
# autogenerate would produce an empty migration.
from app.models import Base  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting — `alembic upgrade head --sql`."""
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    if connectable.dialect.name == "sqlite":
        # SQLite ignores foreign keys unless the PRAGMA is set, including
        # during a batch table rebuild, where ignoring them silently drops
        # child rows. It has to be applied at connect time: the statement is a
        # no-op inside a transaction, and issuing it on the connection Alembic
        # is about to use opens one — which then swallows the version stamp on
        # close, leaving `alembic_version` empty and every later `upgrade`
        # replaying migrations that have already run.
        @event.listens_for(connectable, "connect")
        def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

        # SQLite is flagged as non-transactional DDL, so `begin_transaction()`
        # above is a no-op and nothing is committed on exit.
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
