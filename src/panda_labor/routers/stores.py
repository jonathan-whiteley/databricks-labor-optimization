"""GET /api/stores"""
from fastapi import APIRouter
from pydantic import BaseModel
from ..lakebase import conn

router = APIRouter(prefix="/api/stores", tags=["stores"])


class Store(BaseModel):
    store_id: int
    store_name: str
    region: str
    state: str


@router.get("", response_model=list[Store])
async def list_stores() -> list[Store]:
    async with conn() as c:
        rows = await c.fetch(
            "SELECT store_id, store_name, region, state FROM stores_synced ORDER BY store_id"
        )
        return [Store(**dict(r)) for r in rows]
