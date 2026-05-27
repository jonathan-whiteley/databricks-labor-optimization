"""POST /api/schedule/save - write approved schedule to Lakebase.
DELETE /api/schedule/{store_id}/{date}/{day_part} - revert to AI forecast."""
from datetime import date
from typing import Annotated
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from ..lakebase import conn

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

ALLOWED_DAY_PARTS = ("breakfast", "lunch", "dinner", "late")


class DayPartApproval(BaseModel):
    day_part: str
    approved_headcount: int = Field(ge=0, le=50)
    approved_cost: float = Field(ge=0)
    approved_role_cook: int = Field(ge=0)
    approved_role_cashier: int = Field(ge=0)
    approved_role_shift_lead: int = Field(ge=0)
    approved_role_manager: int = Field(ge=0)
    overridden_revenue: float | None = None


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
                        approved_by, override_reason, overridden_revenue
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    RETURNING schedule_id
                    """,
                    req.store_id, req.schedule_date, dp.day_part,
                    dp.approved_headcount, dp.approved_cost,
                    dp.approved_role_cook, dp.approved_role_cashier,
                    dp.approved_role_shift_lead, dp.approved_role_manager,
                    approved_by, req.override_reason, dp.overridden_revenue,
                )
                ids.append(row["schedule_id"])
            return SaveScheduleResponse(schedule_ids=ids)


class DeleteResponse(BaseModel):
    deleted: int


@router.delete("/{store_id}/{schedule_date}/{day_part}", response_model=DeleteResponse)
async def delete_day_part_approval(
    store_id: int, schedule_date: date, day_part: str,
) -> DeleteResponse:
    """Wipe every approval row for one (store, date, day_part). The Reset
    button on an Adjusted card calls this so the AI forecast re-surfaces
    on next read. Idempotent — returns 200 with deleted=0 when nothing
    matches."""
    if day_part not in ALLOWED_DAY_PARTS:
        raise HTTPException(400, f"Invalid day_part: {day_part}")
    async with conn() as c:
        result = await c.execute(
            """
            DELETE FROM schedules
            WHERE store_id = $1 AND schedule_date = $2 AND day_part = $3
            """,
            store_id, schedule_date, day_part,
        )
    # asyncpg returns "DELETE <n>" for non-SELECTs
    n = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
    return DeleteResponse(deleted=n)
