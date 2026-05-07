"""GET /api/forecast/{store_id}/{date}"""
from datetime import date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..lakebase import conn

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


class DayPartForecast(BaseModel):
    day_part: str
    predicted_revenue: float
    predicted_transactions: int


class ForecastResponse(BaseModel):
    store_id: int
    forecast_date: date
    day_parts: list[DayPartForecast]


@router.get("/{store_id}/{forecast_date}", response_model=ForecastResponse)
async def get_forecast(store_id: int, forecast_date: date) -> ForecastResponse:
    async with conn() as c:
        rows = await c.fetch(
            """
            SELECT day_part, predicted_revenue, predicted_transactions
            FROM sales_forecasts_synced
            WHERE store_id = $1 AND forecast_date = $2
            ORDER BY CASE day_part
                       WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2
                       WHEN 'dinner' THEN 3 ELSE 4 END
            """,
            store_id, forecast_date,
        )
    if not rows:
        raise HTTPException(404, f"No forecast for store {store_id} on {forecast_date}")
    return ForecastResponse(
        store_id=store_id, forecast_date=forecast_date,
        day_parts=[DayPartForecast(**dict(r)) for r in rows],
    )
