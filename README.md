# Panda Labor Optimization Demo

Databricks-native labor planning app for Panda Express stores. Forecasts sales by day-part using `ai_forecast`, generates staffing recommendations from a served pyfunc model, lets store managers override forecasts with live recompute, and writes approved schedules to Lakebase with sync back to Unity Catalog.

## Stack
- Databricks Asset Bundles (deployment)
- Unity Catalog (`jdub_demo.panda`)
- Lakebase Autoscaling (OLTP serving layer)
- Model Serving (pyfunc: Panda's labor formula)
- Lakeflow Jobs (manual-trigger refresh)
- Databricks App: FastAPI + React + shadcn/ui

## Deploy
```bash
databricks bundle deploy -t default
```

## Spec
See `docs/superpowers/specs/2026-05-06-panda-labor-optimization-design.md` (in the Vault).
