"""Lakebase Postgres connection pool with auto-rotating OAuth credentials."""
import os
import uuid
import asyncpg
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from databricks.sdk import WorkspaceClient
from .config import settings


def _db_user() -> str:
    """Pick the Postgres role to authenticate as.

    When running inside a Databricks App, the platform sets DATABRICKS_CLIENT_ID
    to the App service principal's client_id (a UUID). Lakebase OAuth requires
    the connecting user to match the identity that minted the token, so we
    authenticate as the SP when present and fall back to the human owner email
    for local dev.
    """
    sp = os.getenv("DATABRICKS_CLIENT_ID")
    if sp:
        return sp
    return settings().user_email


_pool: asyncpg.Pool | None = None
_pool_expiry: datetime | None = None


async def _mint_credential() -> tuple[str, datetime]:
    """Generate a fresh Lakebase database credential."""
    s = settings()
    w = WorkspaceClient()
    cred = w.database.generate_database_credential(
        instance_names=[s.lakebase_instance],
        request_id=str(uuid.uuid4()),
    )
    expiry = datetime.now(timezone.utc) + timedelta(minutes=50)
    return cred.token, expiry


async def get_pool() -> asyncpg.Pool:
    """Return a live pool, rotating credentials before they expire."""
    global _pool, _pool_expiry
    if (
        _pool is None
        or _pool_expiry is None
        or datetime.now(timezone.utc) >= _pool_expiry
    ):
        if _pool is not None:
            await _pool.close()
        token, expiry = await _mint_credential()
        s = settings()
        _pool = await asyncpg.create_pool(
            host=s.lakebase_host,
            port=5432,
            user=_db_user(),
            password=token,
            database=s.lakebase_database,
            ssl="require",
            min_size=1,
            max_size=5,
            server_settings={"search_path": s.lakebase_pg_schema},
        )
        _pool_expiry = expiry
    return _pool


@asynccontextmanager
async def conn():
    pool = await get_pool()
    async with pool.acquire() as c:
        yield c
