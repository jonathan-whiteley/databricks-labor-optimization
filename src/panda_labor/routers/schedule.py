"""POST /api/schedule/save - write approved schedule to Lakebase."""
from datetime import date
from typing import Annotated
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from ..lakebase import conn

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


class DayPartApproval(BaseModel):
    day_part: str
    approved_headcount: int = Field(ge=0, le=50)
    approved_cost: float = Field(ge=0)
    approved_role_cook: int = Field(ge=0)
    approved_role_cashier: int = Field(ge=0)
    approved_role_shift_lead: int = Field(ge=0)
    approved_role_manager: int = Field(ge=0)


class SaveScheduleRequest(BaseModel):
    store_id: int
    schedule_date: date
    day_parts: list[DayPartApproval]
    override_reason: str | None = None


class SaveScheduleResponse(BaseModel):
    schedule_ids: list[int]


@router.post("/save", response_model=SaveScheduleResponse)
async def save_schedule(
    req: SaveScheduleRequest,
    x_forwarded_email: Annotated[str | None, Header()] = None,
) -> SaveScheduleResponse:
    if not req.day_parts:
        raise HTTPException(400, "day_parts is empty")
    approved_by = x_forwarded_email or "demo@databricks.com"
    async with conn() as c:
        async with c.transaction():
            ids: list[int] = []
            for dp in req.day_parts:
                row = await c.fetchrow(
                    """
                    INSERT INTO schedules (
                        store_id, schedule_date, day_part,
                        approved_headcount, approved_cost,
                        approved_role_cook, approved_role_cashier,
                        approved_role_shift_lead, approved_role_manager,
                        approved_by, override_reason
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    RETURNING schedule_id
                    """,
                    req.store_id, req.schedule_date, dp.day_part,
                    dp.approved_headcount, dp.approved_cost,
                    dp.approved_role_cook, dp.approved_role_cashier,
                    dp.approved_role_shift_lead, dp.approved_role_manager,
                    approved_by, req.override_reason,
                )
                ids.append(row["schedule_id"])
            return SaveScheduleResponse(schedule_ids=ids)
