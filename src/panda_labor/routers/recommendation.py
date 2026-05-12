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


class ApprovedSchedule(BaseModel):
    revenue: float
    headcount: int
    cost: float
    role_mix: RoleMix


class DayPartRecommendation(BaseModel):
    day_part: str
    # Always the model's baseline rec at the forecast revenue.
    recommended_headcount: int
    recommended_cost: float
    recommended_role_mix: RoleMix
    # If the GM has approved a schedule for this day-part, these reflect
    # what they locked in (which may differ from the baseline). The frontend
    # renders `approved` over `recommended` when present, and uses
    # `recommended` as the "vs AI forecast" anchor for deltas.
    approved: ApprovedSchedule | None = None


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
    """Return the plan for a store/date. When the user has approved a
    schedule, the latest approval per day_part overrides the model's
    recommendation so the UI reflects the persisted decision after reload."""
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
        approvals = await c.fetch(
            """
            SELECT DISTINCT ON (day_part)
                   day_part,
                   approved_headcount, approved_cost,
                   approved_role_cook, approved_role_cashier,
                   approved_role_shift_lead, approved_role_manager,
                   overridden_revenue
            FROM schedules
            WHERE store_id = $1 AND schedule_date = $2
            ORDER BY day_part, approved_ts DESC
            """,
            store_id, forecast_date,
        )
    if not rows:
        raise HTTPException(
            404, f"No recommendation for store {store_id} on {forecast_date}"
        )
    approved_by_dp = {a["day_part"]: a for a in approvals}
    parts: list[DayPartRecommendation] = []
    for r in rows:
        a = approved_by_dp.get(r["day_part"])
        approved: ApprovedSchedule | None = None
        # Only surface the approval if we have the revenue context for it —
        # without it the UI can't reconcile crew+cost against a meaningful
        # baseline. Older rows pre-dating overridden_revenue are ignored.
        if a is not None and a["overridden_revenue"] is not None:
            approved = ApprovedSchedule(
                revenue=a["overridden_revenue"],
                headcount=a["approved_headcount"],
                cost=a["approved_cost"],
                role_mix=RoleMix(
                    cook=a["approved_role_cook"],
                    cashier=a["approved_role_cashier"],
                    shift_lead=a["approved_role_shift_lead"],
                    manager=a["approved_role_manager"],
                ),
            )
        parts.append(DayPartRecommendation(
            day_part=r["day_part"],
            recommended_headcount=r["recommended_headcount"],
            recommended_cost=r["recommended_cost"],
            recommended_role_mix=_parse_role_mix(r["recommended_role_mix"]),
            approved=approved,
        ))
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
