"""FastAPI entry - mounts routers, manages Lakebase pool + endpoint warm."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .lakebase import get_pool
from .model_client import warm
from .routers import stores, forecast, recommendation, schedule


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await get_pool()
    except Exception as e:
        # Lakebase may be reachable only when the app runs in the workspace.
        print(f"WARN: lakebase pool init failed at boot: {e}")
    try:
        await warm()
    except Exception as e:
        print(f"WARN: endpoint warm failed: {e}")
    yield


app = FastAPI(title="Panda Labor Planner", lifespan=lifespan)
app.include_router(stores.router)
app.include_router(forecast.router)
app.include_router(recommendation.router)
app.include_router(schedule.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
