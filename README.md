# Databricks RCT Labor Optimization

[![Deploy with DABS](https://img.shields.io/badge/Deploy%20with-Databricks%20Asset%20Bundles-FF3621?logo=databricks&logoColor=white)](https://docs.databricks.com/aws/en/dev-tools/bundles/)
[![ai_forecast](https://img.shields.io/badge/Forecasting-ai__forecast-FF3621?logo=databricks&logoColor=white)](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_forecast)
[![Model Serving](https://img.shields.io/badge/Serving-Model%20Serving%20(pyfunc)-FF3621?logo=databricks&logoColor=white)](https://docs.databricks.com/aws/en/machine-learning/model-serving/)
[![Lakebase](https://img.shields.io/badge/OLTP-Lakebase%20Postgres-336791?logo=postgresql&logoColor=white)](https://docs.databricks.com/aws/en/oltp/)
[![Genie](https://img.shields.io/badge/Ad--hoc-Genie%20Space-FF3621?logo=databricks&logoColor=white)](https://docs.databricks.com/aws/en/genie/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

> A demo-ready labor planning app for retail, restaurant, and hospitality (RCT) operators on Databricks. Forecast sales by day-part with `ai_forecast`, recommend store-level staffing from a custom pyfunc, let managers override forecasts and pin headcount with live recompute, and persist approved schedules to Lakebase. One bundle deploys the job, the model endpoint, the app, the Lakebase instance, and the Genie space.

## What's Inside

| Layer | Tech | Purpose |
|---|---|---|
| Forecasting | `ai_forecast` SQL | Day-part sales forecasts per store, no notebook needed |
| Recommendations | Custom pyfunc on Model Serving | Headcount + hours + labor% from forecast revenue |
| Serving | Lakebase Provisioned (Postgres) | 4 UC→PG synced tables for reads, 1 native PG table for app writes |
| App | FastAPI + React 19 + shadcn/ui | Manager workflow: override forecast, pin headcount, approve schedule |
| Ad-hoc | Genie Space | "Ask Genie" panel embedded in the app for natural-language Q&A |
| Orchestration | Databricks Asset Bundles | One `bundle deploy` provisions every resource above |

## Why Databricks

| Capability | What you get |
|---|---|
| `ai_forecast` | Day-part sales forecasts in SQL on a warehouse. No model training, no notebook |
| Model Serving (pyfunc) | The labor formula lives in MLflow; the app gets a versioned, scale-to-zero endpoint |
| Lakebase Provisioned | Managed Postgres with TRIGGERED UC→PG synced tables for sub-100ms reads, plus a native PG `schedules` table the app writes to |
| Databricks Apps | Hosted React + FastAPI with OAuth and a service principal. No separate infra |
| Asset Bundles | Single `databricks bundle deploy` provisions the job, endpoint, app, Lakebase, synced tables, and grants |
| Genie | Embed an analyst-grade NL→SQL surface in the same app, sharing the user's SSO session |

## Quick Start

You need: a Databricks workspace, the [Databricks CLI](https://docs.databricks.com/aws/en/dev-tools/cli/install) (v0.220+), [uv](https://docs.astral.sh/uv/getting-started/installation/), and [bun](https://bun.com/docs/installation).

### 1. Clone

```bash
git clone https://github.com/jonathan-whiteley/databricks-labor-optimization.git
cd databricks-labor-optimization
```

### 2. Create a Lakebase instance (one-time)

```bash
databricks database create-database-instance my-labor-db --capacity CU_1
```

Pick any name; just keep it consistent in the next step.

### 3. Configure

Edit `databricks.yml` variables to point at your workspace:

```yaml
variables:
  catalog:           { default: <your_catalog> }
  schema:            { default: <your_schema> }
  lakebase_instance: { default: <your_instance_name> }
  user_email:        { default: <you@example.com> }
  genie_space_id:    { default: "" }   # leave blank on first run
```

The default resource names (`panda_labor_refresh` job, `panda-labor-rec-v1` endpoint, `panda-labor-planner` app) are bundle variables you can override the same way.

### 4. Build the UI and deploy

```bash
cd ui && bun install && bun run build && cd ..
databricks bundle deploy
```

The single deploy provisions the Lakeflow job, the Model Serving endpoint, the Databricks App, the Lakebase instance binding, four UC→Lakebase synced tables, and all required grants.

### 5. Generate data and train the model (first run only)

```bash
databricks workspace import-dir notebooks /Workspace/Users/<you>/labor
# In the workspace: run 01_generate_synthetic_data.py and 03_register_labor_model.py once
```

`01` writes synthetic stores, day-part sales, and staffing targets into UC. `03` registers the labor pyfunc and stamps a version on the serving endpoint.

### 6. Initialize the native `schedules` table (one-time)

The app writes approved schedules to a native Lakebase Postgres table. DABs can't declare native PG DDL today, so apply it manually with `psql` against the Lakebase instance:

```bash
psql "$LAKEBASE_URI" -f notebooks/05_init_schedules_table.sql
```

### 7. Run the refresh job

```bash
databricks bundle run panda_labor_refresh
```

Three tasks run in sequence: `ai_forecast` (SQL on a warehouse), `run_recommendations` (notebook on serverless that hits the model endpoint), and `ensure_genie_space` (idempotent CREATE/PATCH). On the first run, the Genie task prints a new space ID: paste it into `databricks.yml` under `genie_space_id` and redeploy so the iframe in the app picks it up.

### 8. Launch the app

```bash
databricks apps get <your-app-name>
```

Open the URL in your browser. The bundle wires the App's service principal with `CAN_QUERY` on the endpoint and `CAN_CONNECT_AND_CREATE` on Lakebase, so it works out of the box.

## Local Development

```bash
uv sync                                                # Python deps
cd ui && bun install && cd ..                          # Frontend deps
LAKEBASE_INSTANCE_NAME=<your-instance> \
  uvicorn panda_labor.app:app --reload --port 8000     # FastAPI
cd ui && bun run dev                                   # Vite dev server with HMR
```

The local backend uses your Databricks CLI profile to mint short-lived Lakebase OAuth tokens. Token rotation lives in `src/panda_labor/lakebase.py`.

## Architecture

```
                    databricks.yml + resources/*.yml
                                  |
                                  v
        +-------------------------------------------------+
        |       Bundle: panda-labor-optimization          |
        +-------------------------------------------------+
          |             |             |            |
          v             v             v            v
   +-----------+ +-----------+ +-----------+ +----------------+
   | Refresh   | | Model     | | Databricks| | Lakebase DB    |
   | Job       | | Serving   | | App       | | Instance + 4   |
   | (3 tasks) | | Endpoint  | | (FastAPI  | | synced tables  |
   |           | | (pyfunc)  | |  + React) | |                |
   +-----------+ +-----------+ +-----------+ +----------------+
        |             ^             |              ^
        | 02 ai_forecast (SQL) -----+              |
        | 04 run_recommendations ---+              |
        | 06 ensure_genie_space ----------> Genie Space
        |
        v
   +----------------+                  +-------------------+
   | Unity Catalog  | --- TRIGGERED -->| Lakebase Postgres |
   |  sales_forecasts                  |  sales_forecasts_synced
   |  labor_recommendations            |  labor_recommendations_synced
   |  staffing_targets                 |  staffing_targets_synced
   |  stores                           |  stores_synced
   +----------------+                  |  schedules  (native, app writes)
                                       +-------------------+
```

Reads in the app go to the four `*_synced` tables. Manager-approved schedules write to the native `schedules` table.

## What the Bundle Creates

| Resource | Type | Notes |
|---|---|---|
| `panda_labor_refresh` | Job | 3 tasks: `ai_forecast` (SQL warehouse), `run_recommendations` (serverless), `ensure_genie_space` (serverless) |
| `panda_labor_endpoint` | Model Serving | Pyfunc labor model, `Small` workload, scale-to-zero |
| `panda_app` | Databricks App | FastAPI + React, OAuth, service principal |
| `panda_labor_db` | Lakebase Database Instance | `CU_1` capacity |
| `*_synced` | Synced Database Tables (×4) | `sales_forecasts`, `labor_recommendations`, `staffing_targets`, `stores` |

Resource names default to `panda_*` (the original demo customer). Override them with bundle variables — see `databricks.yml`.

<details>
<summary><strong>Manager Workflow</strong></summary>

1. Pick a store and a date in the app
2. See the AI sales forecast and recommended headcount by day-part
3. Override the forecast (e.g. promo day, weather) — recommendations recompute live against the endpoint
4. Pin headcount directly if you disagree with the formula
5. Approve — the schedule is written to the native PG `schedules` table, with the overridden revenue persisted alongside so the approval reconciles cleanly
6. Reset reverts both the forecast override and any pinned headcount back to the AI baseline
</details>

<details>
<summary><strong>The Labor Model</strong></summary>

A custom MLflow pyfunc. Inputs: `(store_id, day_part, forecast_revenue)`. Outputs: `(recommended_headcount, recommended_hours, labor_pct, labor_cost)`. The formula is calibrated to target ~22-26% labor cost as a percentage of revenue and is documented inline in `notebooks/03_register_labor_model.py`.

The forecast itself is the SQL `ai_forecast` function in `notebooks/02_ai_forecast.sql`, running on a SQL warehouse. No training step, no MLflow run for the forecast itself.
</details>

<details>
<summary><strong>Genie Space</strong></summary>

`notebooks/06_ensure_genie_space.py` is idempotent: PATCH when `genie_space_id` is set in `databricks.yml`, CREATE otherwise (and print the new ID). DABs don't yet have a resource type for Genie spaces, so this notebook is the artifact. The app embeds the space as an iframe and inherits the user's SSO session from the parent Databricks App auth.
</details>

<details>
<summary><strong>Lakebase Outbound Sync Gap</strong></summary>

Only UC→PG synced tables are declarative in DABs today. There is no GA outbound (PG→UC) sync from Lakebase Provisioned. The app still works end-to-end: writes land in Lakebase first for low-latency reads. For analytics access to the schedules table, either (a) add a scheduled job that reads Lakebase via psycopg and MERGEs into a UC Delta table, or (b) adopt outbound sync when it ships. Tracked as a known gap, not a blocker.
</details>

<details>
<summary><strong>Project Layout</strong></summary>

```
.
├── databricks.yml              # Bundle variables + targets
├── app.yaml                    # App runtime command + env
├── resources/
│   ├── app.yml                 # App + resource bindings (Lakebase, endpoint)
│   ├── jobs.yml                # Refresh job
│   ├── lakebase.yml            # DB instance + 4 synced tables
│   ├── model_serving.yml       # Pyfunc endpoint + SP grants
│   └── permissions.yml         # UC schema grants
├── notebooks/
│   ├── 01_generate_synthetic_data.py
│   ├── 02_ai_forecast.sql
│   ├── 03_register_labor_model.py
│   ├── 04_run_recommendations.py
│   ├── 05_init_schedules_table.sql
│   └── 06_ensure_genie_space.py
├── src/panda_labor/            # FastAPI backend
│   ├── app.py
│   ├── lakebase.py             # asyncpg pool + OAuth token rotation
│   └── model_client.py         # Serving endpoint client
├── ui/                         # React 19 + shadcn (Vite)
└── tests/
```
</details>

## Troubleshooting

| Symptom | Fix |
|---|---|
| `bundle deploy` fails on Lakebase | Confirm the instance exists and the name matches `var.lakebase_instance` in `databricks.yml` |
| App returns 401 from Lakebase | Connection user must match the identity that minted the OAuth token. See `src/panda_labor/lakebase.py` |
| App returns 403 calling the endpoint | The bundle wires `CAN_QUERY` for the App's SP; redeploy if you renamed the endpoint |
| `ai_forecast` returns no rows | Confirm the SQL warehouse referenced in `resources/jobs.yml` exists and you have permission |
| Genie iframe is blank | Run the `ensure_genie_space` task, pin the printed ID into `databricks.yml`, redeploy |

## License

Internal accelerator. Use within your Databricks engagement.
