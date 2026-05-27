"""Smoke tests for the FastAPI app - no Lakebase, no endpoint."""
from fastapi.testclient import TestClient
from labor_iq.app import app


def test_health_endpoint_exists():
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_routes_mounted():
    paths = {r.path for r in app.routes}
    assert "/api/health" in paths
    assert "/api/stores" in paths
    assert "/api/forecast/{store_id}/{forecast_date}" in paths
    assert "/api/recommendation/{store_id}/{forecast_date}" in paths
    assert "/api/recommendation/recompute" in paths
    assert "/api/schedule/save" in paths
