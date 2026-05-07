"""HTTP client for the Model Serving endpoint."""
import httpx
from databricks.sdk import WorkspaceClient
from .config import settings

_w = WorkspaceClient()


def _auth_headers() -> dict[str, str]:
    """Return SDK-derived auth headers, falling back to a bearer token."""
    try:
        authenticate = _w.config.authenticate
        headers = authenticate()
        if headers:
            return dict(headers)
    except Exception:
        pass
    return {"Authorization": f"Bearer {_w.config.token}"}


async def call_labor_endpoint(
    store_id: int, projected_sales: float, day_part: str
) -> dict:
    s = settings()
    host = _w.config.host
    url = f"{host}/serving-endpoints/{s.serving_endpoint}/invocations"
    payload = {
        "dataframe_records": [
            {
                "store_id": store_id,
                "projected_sales": projected_sales,
                "day_part": day_part,
            }
        ]
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, json=payload, headers=_auth_headers())
        r.raise_for_status()
        return r.json()["predictions"][0]


async def warm() -> None:
    """Ping endpoint on boot so first user click doesn't hit cold-start."""
    try:
        await call_labor_endpoint(1, 4500.0, "lunch")
    except Exception:
        pass
