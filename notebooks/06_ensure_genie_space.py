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
    "How did my labor % compare to my region last week?",
    "Which day-parts have the highest labor cost as a share of sales this month?",
    "Top 5 stores by labor variance in LA Metro this week.",
    "What was last Friday's predicted vs. actual revenue at Store #0001?",
    "Show forecasted lunch revenue for tomorrow across all California stores.",
    "Which stores ran above the 26% labor target last week?",
    "Compare actual revenue trend for Store #0007 over the last 14 days.",
]

EXAMPLE_SQLS = [
    {
        "title": "Tomorrow's labor% by day-part for one store",
        "sql": (
            "SELECT r.day_part, r.recommended_cost AS labor_cost, "
            "f.predicted_revenue AS forecast_revenue, "
            "ROUND(100.0 * r.recommended_cost / f.predicted_revenue, 1) AS labor_pct "
            f"FROM {CATALOG}.{SCHEMA}.labor_recommendations r "
            f"JOIN {CATALOG}.{SCHEMA}.sales_forecasts f "
            "USING (store_id, forecast_date, day_part) "
            "WHERE r.store_id = 1 AND r.forecast_date = current_date() + 1 "
            "ORDER BY CASE r.day_part WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 "
            "WHEN 'dinner' THEN 3 ELSE 4 END"
        ),
    },
    {
        "title": "Top 5 stores by labor variance this week (West region)",
        "sql": (
            "WITH joined AS ("
            "SELECT d.store_id, d.store_name, d.region, "
            "SUM(d.total_revenue) AS actual_rev, "
            "SUM(r.recommended_cost) AS planned_labor "
            f"FROM {CATALOG}.{SCHEMA}.daily_store_revenue d "
            f"JOIN {CATALOG}.{SCHEMA}.labor_recommendations r "
            "ON r.store_id = d.store_id AND r.forecast_date = d.sale_date "
            "WHERE d.sale_date >= current_date() - INTERVAL 7 DAYS "
            "AND d.region = 'West' "
            "GROUP BY d.store_id, d.store_name, d.region) "
            "SELECT store_id, store_name, "
            "ROUND(100.0 * planned_labor / actual_rev, 1) AS labor_pct, "
            "ROUND(actual_rev, 0) AS revenue "
            "FROM joined ORDER BY labor_pct DESC LIMIT 5"
        ),
    },
]

TABLES = [
    f"{CATALOG}.{SCHEMA}.sales_forecasts",
    f"{CATALOG}.{SCHEMA}.labor_recommendations",
    f"{CATALOG}.{SCHEMA}.daily_store_revenue",
]


def build_serialized_space() -> dict:
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
            "example_question_sqls": [
                {"id": uuid4().hex, "question": [e["title"]], "sql": [e["sql"]]}
                for e in EXAMPLE_SQLS
            ],
        },
        "config": {
            "sample_questions": [
                {"id": uuid4().hex, "question": [q]} for q in SAMPLE_QUESTIONS
            ]
        },
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
