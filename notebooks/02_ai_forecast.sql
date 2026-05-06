-- Databricks notebook source
-- MAGIC %md
-- MAGIC # AI Forecast: predict sales by store × date × day-part
-- MAGIC
-- MAGIC Uses `ai_forecast()` on `daily_store_revenue`. Must run on a **serverless SQL
-- MAGIC warehouse** (the function is not available on Spark serverless compute).
-- MAGIC
-- MAGIC The historical revenue table spans 2023-2024 in this demo; the workspace
-- MAGIC clock is later. We anchor the forecast horizon to `MAX(sale_date) + 14 days`
-- MAGIC (not `current_date()`) so we forecast forward from the data's actual edge.
-- MAGIC Writes per-day-part rows into `sales_forecasts`.

-- COMMAND ----------

CREATE TABLE IF NOT EXISTS jdub_demo.panda.sales_forecasts (
  store_id INT,
  forecast_date DATE,
  day_part STRING,
  predicted_revenue DOUBLE,
  predicted_transactions BIGINT,
  forecast_ts TIMESTAMP,
  model_version STRING
);

DELETE FROM jdub_demo.panda.sales_forecasts;

-- COMMAND ----------

-- Anchor to the latest date we have revenue for; ai_forecast extrapolates from there.
CREATE OR REPLACE TEMP VIEW input_series AS
WITH bounds AS (SELECT MAX(sale_date) AS max_d FROM jdub_demo.panda.daily_store_revenue)
SELECT d.store_id, d.sale_date AS ds, d.total_revenue AS y
FROM jdub_demo.panda.daily_store_revenue d, bounds
WHERE d.sale_date >= DATE_SUB(bounds.max_d, 180);

-- Forecast 14 days past the data edge.
CREATE OR REPLACE TEMP VIEW daily_forecast AS
WITH bounds AS (SELECT MAX(sale_date) AS max_d FROM jdub_demo.panda.daily_store_revenue)
SELECT *
FROM ai_forecast(
  TABLE(input_series),
  horizon => (SELECT DATE_ADD(max_d, 14) FROM bounds),
  time_col => 'ds',
  value_col => 'y',
  group_col => ARRAY('store_id'),
  prediction_interval_width => 0.95
);

-- Day-part split derived from synthetic labor history.
CREATE OR REPLACE TEMP VIEW dayparts_share AS
WITH dp_totals AS (
  SELECT s.store_id, DAYOFWEEK(s.shift_date) AS dow, s.day_part,
         SUM(s.labor_cost) AS dp_labor
  FROM jdub_demo.panda.shifts s
  GROUP BY s.store_id, DAYOFWEEK(s.shift_date), s.day_part
),
day_totals AS (
  SELECT store_id, dow, SUM(dp_labor) AS day_labor FROM dp_totals GROUP BY store_id, dow
)
SELECT t.store_id, t.dow, t.day_part,
       t.dp_labor / NULLIF(d.day_labor, 0) AS share
FROM dp_totals t JOIN day_totals d USING (store_id, dow);

INSERT INTO jdub_demo.panda.sales_forecasts
SELECT
  f.store_id,
  CAST(f.ds AS DATE) AS forecast_date,
  s.day_part,
  ROUND(f.y_forecast * COALESCE(s.share, 0.25), 2) AS predicted_revenue,
  CAST(ROUND(f.y_forecast * COALESCE(s.share, 0.25) / 12.50) AS BIGINT) AS predicted_transactions,
  current_timestamp() AS forecast_ts,
  'ai_forecast_v1' AS model_version
FROM daily_forecast f
JOIN dayparts_share s
  ON f.store_id = s.store_id AND DAYOFWEEK(CAST(f.ds AS DATE)) = s.dow
WHERE CAST(f.ds AS DATE) > (SELECT MAX(sale_date) FROM jdub_demo.panda.daily_store_revenue);

SELECT COUNT(*) AS forecast_rows,
       MIN(forecast_date) AS first_day,
       MAX(forecast_date) AS last_day,
       COUNT(DISTINCT store_id) AS n_stores
FROM jdub_demo.panda.sales_forecasts
WHERE forecast_ts >= current_timestamp() - INTERVAL 1 HOUR;
