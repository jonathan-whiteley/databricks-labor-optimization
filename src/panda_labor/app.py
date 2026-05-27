"""FastAPI entry - mounts routers, manages Lakebase pool + endpoint warm."""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .lakebase import get_pool
from .model_client import warm
from .routers import stores, forecast, recommendation, schedule, genie


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Lakebase isn't reachable outside the workspace network. Cap the boot
    # warm-up so local dev doesn't sit through asyncpg's 60s connect timeout;
    # the per-request path in lakebase.get_pool() will surface a real error
    # if Lakebase is genuinely down in prod.
    try:
        await asyncio.wait_for(get_pool(), timeout=8.0)
    except Exception as e:
        print(f"WARN: lakebase pool init failed/timed out at boot: {e}")
    try:
        await asyncio.wait_for(warm(), timeout=5.0)
    except Exception as e:
        print(f"WARN: endpoint warm failed: {e}")
    yield


app = FastAPI(title="Labor IQ", lifespan=lifespan)
app.include_router(stores.router)
app.include_router(forecast.router)
app.include_router(recommendation.router)
app.include_router(schedule.router)
app.include_router(genie.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# Mount UI static last so /api/* routes take precedence.
# Directory is optional: it won't exist during unit tests or local API-only dev.
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="ui")
