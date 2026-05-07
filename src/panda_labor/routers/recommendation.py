"""GET /api/recommendation/{store_id}/{date}, POST /api/recommendation/recompute"""
import json
from datetime import date, datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..lakebase import conn
from ..model_client import call_labor_endpoint

router = APIRouter(prefix="/api/recommendation", tags=["recommendation"])


class RoleMix(BaseModel):
    cook: int
    cashier: int
    shift_lead: int
    manager: int


class DayPartRecommendation(BaseModel):
    day_part: str
    recommended_headcount: int
    recommended_cost: float
    recommended_role_mix: RoleMix


class RecommendationResponse(BaseModel):
    store_id: int
    forecast_date: date
    generated_ts: datetime
    day_parts: list[DayPartRecommendation]


def _parse_role_mix(raw) -> RoleMix:
    """Lakebase represents the UC struct as JSON; asyncpg gives us str or dict."""
    if isinstance(raw, str):
        raw = json.loads(raw)
    return RoleMix(**raw)


@router.get("/{store_id}/{forecast_date}", response_model=RecommendationResponse)
async def get_recommendation(store_id: int, forecast_date: date) -> RecommendationResponse:
    async with conn() as c:
        rows = await c.fetch(
            """
            SELECT day_part, recommended_headcount, recommended_cost,
                   recommended_role_mix, generated_ts
            FROM labor_recommendations_synced
            WHERE store_id = $1 AND forecast_date = $2
            ORDER BY CASE day_part
                       WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2
                       WHEN 'dinner' THEN 3 ELSE 4 END
            """,
            store_id, forecast_date,
        )
    if not rows:
        raise HTTPException(
            404, f"No recommendation for store {store_id} on {forecast_date}"
        )
    parts = [
        DayPartRecommendation(
            day_part=r["day_part"],
            recommended_headcount=r["recommended_headcount"],
            recommended_cost=r["recommended_cost"],
            recommended_role_mix=_parse_role_mix(r["recommended_role_mix"]),
        )
        for r in rows
    ]
    return RecommendationResponse(
        store_id=store_id, forecast_date=forecast_date,
        generated_ts=rows[0]["generated_ts"], day_parts=parts,
    )


class RecomputeRequest(BaseModel):
    store_id: int
    day_part: str
    projected_sales: float


class RecomputeResponse(BaseModel):
    day_part: str
    recommended_headcount: int
    recommended_cost: float
    recommended_role_mix: RoleMix


@router.post("/recompute", response_model=RecomputeResponse)
async def recompute(req: RecomputeRequest) -> RecomputeResponse:
    if req.day_part not in ("breakfast", "lunch", "dinner", "late"):
        raise HTTPException(400, f"Invalid day_part: {req.day_part}")
    if req.projected_sales < 0 or req.projected_sales > 100000:
        raise HTTPException(400, "projected_sales must be between 0 and 100000")
    pred = await call_labor_endpoint(req.store_id, req.projected_sales, req.day_part)
    return RecomputeResponse(
        day_part=req.day_part,
        recommended_headcount=pred["recommended_headcount"],
        recommended_cost=pred["recommended_cost"],
        recommended_role_mix=RoleMix(
            cook=pred["cook"], cashier=pred["cashier"],
            shift_lead=pred["shift_lead"], manager=pred["manager"],
        ),
    )
