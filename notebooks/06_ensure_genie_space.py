# Databricks notebook source
"""
Ensures the Panda Labor Planner Genie space exists and is up-to-date.

Idempotent:
  - If `space_id` widget is set (or env var GENIE_SPACE_ID is non-empty),
    PATCHes that space with the spec defined below.
  - Otherwise CREATEs a new space and prints the new ID. Capture the ID
    and pin it as bundle var `var.genie_space_id` (databricks.yml) so
    future deploys are idempotent.

DAB has no first-class `resources.GenieSpace` yet, so this notebook is the
artifact that keeps the space declarative. Run it after `databricks bundle
deploy` whenever the spec changes:

    databricks jobs submit-run \\
      --json '{"run_name":"ensure_genie_space",
               "tasks":[{"task_key":"r",
                         "notebook_task":{"notebook_path":
                           "/Workspace/Users/jonathan.whiteley@databricks.com/.bundle/panda-labor-optimization/default/files/notebooks/06_ensure_genie_space"}}]}'

The resulting URL feeds the React app's `VITE_GENIE_SPACE_URL` at build
time so the Ask Genie panel renders this space in an iframe.
"""

# COMMAND ----------
# MAGIC %pip install --quiet --upgrade "databricks-sdk>=0.40"

# COMMAND ----------
# MAGIC %restart_python

# COMMAND ----------

import json
from uuid import uuid4
from databricks.sdk import WorkspaceClient

CATALOG = "jdub_demo"
SCHEMA = "panda"
WAREHOUSE_ID = "0168e23e24e6ae10"
TITLE = "Panda Labor Planner"
DESCRIPTION = (
    "Natural-language access to Panda Express's daily store revenue, "
    "AI labor recommendations, and tomorrow's sales forecasts. Powers the "
    "Ask Genie panel inside the Labor Planner app."
)

INSTRUCTIONS = (
    "You are answering questions from a Panda Express General Manager "
    "planning tomorrow's labor schedule. They care about: predicted vs. "
    "actual sales, labor cost as a percent of revenue (target 22-26%), "
    "recommended headcount by day-part (breakfast, lunch, dinner, late), "
    "how their store compares to their region and Panda overall, and "
    "whether any day-parts are overstaffed. Day-parts are always one of: "
    "breakfast, lunch, dinner, late. Labor% is "
    "labor_recommendations.recommended_cost / "
    "sales_forecasts.predicted_revenue for forecasted days, OR "
    "(labor cost / daily_store_revenue.total_revenue) for historical days. "
    "Region values include 'West', 'Midwest', 'Southeast', 'Southwest', "
    "'Northeast'. When the user says 'my store' without an ID, ask which "
    "store_id, defaulting to comparison-friendly answers if they decline."
)

SAMPLE_QUESTIONS = [
    "What's tomorrow's total predicted revenue across all stores?",
    "Show predicted revenue by day-part for tomorrow",
    "Which 5 stores have the highest forecasted labor % for tomorrow?",
    "What's the chain-wide labor cost % forecast for each of the next 7 days?",
    "Which regions have the highest forecasted labor cost % for tomorrow?",
]

EXAMPLE_SQLS = [
    {
        "title": "Total predicted revenue across all stores tomorrow",
        "sql": (
            "SELECT SUM(predicted_revenue) AS total_predicted_revenue "
            f"FROM {CATALOG}.{SCHEMA}.sales_forecasts "
            "WHERE forecast_date = current_date() + 1"
        ),
    },
    {
        "title": "Predicted revenue by day-part for tomorrow",
        "sql": (
            "SELECT day_part, SUM(predicted_revenue) AS predicted_revenue "
            f"FROM {CATALOG}.{SCHEMA}.sales_forecasts "
            "WHERE forecast_date = current_date() + 1 "
            "GROUP BY day_part "
            "ORDER BY CASE day_part WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 "
            "WHEN 'dinner' THEN 3 ELSE 4 END"
        ),
    },
    {
        "title": "Top 5 stores by forecasted labor % tomorrow",
        "sql": (
            "WITH joined AS ("
            "SELECT r.store_id, "
            "SUM(r.recommended_cost) AS labor_cost, "
            "SUM(f.predicted_revenue) AS forecast_revenue "
            f"FROM {CATALOG}.{SCHEMA}.labor_recommendations r "
            f"JOIN {CATALOG}.{SCHEMA}.sales_forecasts f "
            "USING (store_id, forecast_date, day_part) "
            "WHERE r.forecast_date = current_date() + 1 "
            "GROUP BY r.store_id) "
            "SELECT store_id, "
            "ROUND(100.0 * labor_cost / forecast_revenue, 2) AS labor_pct, "
            "ROUND(forecast_revenue, 0) AS forecast_revenue "
            "FROM joined "
            "ORDER BY labor_pct DESC "
            "LIMIT 5"
        ),
    },
    {
        "title": "Chain-wide labor cost % for each of the next 7 days",
        "sql": (
            "SELECT r.forecast_date, "
            "ROUND(100.0 * SUM(r.recommended_cost) / NULLIF(SUM(f.predicted_revenue), 0), 2) "
            "AS labor_pct "
            f"FROM {CATALOG}.{SCHEMA}.labor_recommendations r "
            f"JOIN {CATALOG}.{SCHEMA}.sales_forecasts f "
            "USING (store_id, forecast_date, day_part) "
            "WHERE r.forecast_date BETWEEN current_date() AND current_date() + 7 "
            "GROUP BY r.forecast_date "
            "ORDER BY r.forecast_date"
        ),
    },
    {
        "title": "Region labor % tomorrow (DISTINCT store-region join to avoid duplication)",
        "sql": (
            "WITH store_region AS ("
            "SELECT DISTINCT store_id, region "
            f"FROM {CATALOG}.{SCHEMA}.daily_store_revenue "
            "WHERE region IS NOT NULL), "
            "joined AS ("
            "SELECT sr.region, "
            "SUM(r.recommended_cost) AS labor_cost, "
            "SUM(f.predicted_revenue) AS forecast_revenue "
            f"FROM {CATALOG}.{SCHEMA}.labor_recommendations r "
            f"JOIN {CATALOG}.{SCHEMA}.sales_forecasts f "
            "USING (store_id, forecast_date, day_part) "
            "JOIN store_region sr ON sr.store_id = r.store_id "
            "WHERE r.forecast_date = current_date() + 1 "
            "GROUP BY sr.region) "
            "SELECT region, "
            "ROUND(100.0 * labor_cost / forecast_revenue, 2) AS labor_pct, "
            "ROUND(forecast_revenue, 0) AS forecast_revenue "
            "FROM joined "
            "ORDER BY labor_pct DESC"
        ),
    },
]

TABLES = [
    f"{CATALOG}.{SCHEMA}.sales_forecasts",
    f"{CATALOG}.{SCHEMA}.labor_recommendations",
    f"{CATALOG}.{SCHEMA}.daily_store_revenue",
]


def build_serialized_space() -> dict:
    # The Genie export proto rejects unsorted id lists, so generate ids then
    # sort each collection by id before serializing.
    example_sqls = sorted(
        [
            {"id": uuid4().hex, "question": [e["title"]], "sql": [e["sql"]]}
            for e in EXAMPLE_SQLS
        ],
        key=lambda x: x["id"],
    )
    sample_qs = sorted(
        [{"id": uuid4().hex, "question": [q]} for q in SAMPLE_QUESTIONS],
        key=lambda x: x["id"],
    )
    return {
        "version": 2,
        "data_sources": {
            "tables": sorted(
                [{"identifier": t} for t in TABLES],
                key=lambda x: x["identifier"],
            )
        },
        "instructions": {
            "text_instructions": [{"id": uuid4().hex, "content": [INSTRUCTIONS]}],
            "example_question_sqls": example_sqls,
        },
        "config": {"sample_questions": sample_qs},
    }


# COMMAND ----------

try:
    dbutils.widgets.text("space_id", "", "Existing space ID (leave blank to create)")
except NameError:
    pass

import os
space_id = ""
try:
    space_id = dbutils.widgets.get("space_id").strip()
except Exception:
    pass
if not space_id:
    space_id = os.getenv("GENIE_SPACE_ID", "").strip()

w = WorkspaceClient()
payload = {
    "title": TITLE,
    "description": DESCRIPTION,
    "warehouse_id": WAREHOUSE_ID,
    "serialized_space": json.dumps(build_serialized_space()),
}

if space_id:
    print(f"Patching existing Genie space {space_id} ...")
    resp = w.api_client.do(
        "PATCH",
        f"/api/2.0/genie/spaces/{space_id}",
        body=payload,
    )
    print(f"Patched: {resp.get('title')} ({resp.get('space_id')})")
else:
    print("Creating new Genie space ...")
    resp = w.api_client.do("POST", "/api/2.0/genie/spaces", body=payload)
    new_id = resp.get("space_id")
    print(f"Created: {resp.get('title')} ({new_id})")
    print()
    print(f"  Pin this in databricks.yml as var.genie_space_id: {new_id}")
    print(f"  URL: {w.config.host}/genie/rooms/{new_id}")
