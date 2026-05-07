"""Lakebase Postgres connection pool with auto-rotating OAuth credentials."""
import uuid
import asyncpg
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from databricks.sdk import WorkspaceClient
from .config import settings


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
            user=s.user_email,
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
