# Databricks notebook source
"""
Reads sales_forecasts, calls the labor-rec-v1 endpoint, writes labor_recommendations.
Runs as part of the Lakeflow refresh job after 02_ai_forecast.
"""
import requests
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, IntegerType, StringType, DoubleType, DateType,
)

CATALOG = "jdub_demo"
SCHEMA = "labor_optimization"
ENDPOINT = "dev_jonathan_whiteley_labor-rec-v1"

# COMMAND ----------

w = WorkspaceClient()
host = w.config.host
# Notebook context provides a token via the runtime; use the SDK to mint one if needed.
ctx = dbutils.notebook.entry_point.getDbutils().notebook().getContext()
token = ctx.apiToken().get()

# COMMAND ----------

forecasts = (
    spark.table(f"{CATALOG}.{SCHEMA}.sales_forecasts")
    .filter(F.col("forecast_date") > F.lit("1900-01-01"))  # all rows currently
    .select("store_id", "forecast_date", "day_part", "predicted_revenue")
    .collect()
)
print(f"Calling endpoint for {len(forecasts)} forecast rows")

# COMMAND ----------

def call_endpoint(rows):
    payload = {"dataframe_records": [
        {"store_id": int(r.store_id),
         "projected_sales": float(r.predicted_revenue),
         "day_part": r.day_part}
        for r in rows
    ]}
    resp = requests.post(
        f"{host}/serving-endpoints/{ENDPOINT}/invocations",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["predictions"]

results = []
batch = 200
for i in range(0, len(forecasts), batch):
    chunk = forecasts[i:i+batch]
    preds = call_endpoint(chunk)
    for r, p in zip(chunk, preds):
        results.append((
            int(r.store_id), r.forecast_date, r.day_part,
            int(p["recommended_headcount"]), float(p["recommended_cost"]),
            int(p["cook"]), int(p["cashier"]), int(p["shift_lead"]), int(p["manager"]),
        ))
    print(f"  batch {i//batch + 1}: {len(chunk)} rows")

# COMMAND ----------

schema = StructType([
    StructField("store_id", IntegerType()),
    StructField("forecast_date", DateType()),
    StructField("day_part", StringType()),
    StructField("recommended_headcount", IntegerType()),
    StructField("recommended_cost", DoubleType()),
    StructField("cook", IntegerType()),
    StructField("cashier", IntegerType()),
    StructField("shift_lead", IntegerType()),
    StructField("manager", IntegerType()),
])

raw = spark.createDataFrame(results, schema)
final = raw.select(
    "store_id", "forecast_date", "day_part",
    "recommended_headcount", "recommended_cost",
    F.struct(F.col("cook"), F.col("cashier"),
             F.col("shift_lead"), F.col("manager")).alias("recommended_role_mix"),
    F.lit("labor_rec_model:5").alias("model_version"),
    F.current_timestamp().alias("generated_ts"),
)

(final.write.mode("overwrite")
 .saveAsTable(f"{CATALOG}.{SCHEMA}.labor_recommendations"))
print(f"Wrote {final.count()} labor_recommendations")
