-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Sales Forecast: predict sales by store × date × day-part
-- MAGIC
-- MAGIC Originally designed to use `ai_forecast()`, but that built-in is gated off
-- MAGIC in this workspace (`UNSUPPORTED_FEATURE.AI_FUNCTION_PREVIEW`). This notebook
-- MAGIC therefore produces a deterministic baseline forecast: historical mean revenue
-- MAGIC per store × day-of-week (last 90 days), projected forward 14 days, then split
-- MAGIC into day-parts using the historical labor share. Schema and outputs are
-- MAGIC identical to the ai_forecast version so downstream consumers don't change.
-- MAGIC Writes 14 days forward into `sales_forecasts`.

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

-- Wipe before re-populating (idempotent)
DELETE FROM jdub_demo.panda.sales_forecasts;

-- COMMAND ----------

-- Historical mean daily revenue per store × DOW.
-- Uses the most-recent 180 days of revenue we actually have (data spans 2023-2024
-- in this demo, while "today" floats forward), so we anchor to MAX(sale_date)
-- rather than current_date().
CREATE OR REPLACE TEMP VIEW daily_forecast AS
WITH bounds AS (
  SELECT MAX(sale_date) AS max_d FROM jdub_demo.panda.daily_store_revenue
)
SELECT
  d.store_id,
  DAYOFWEEK(d.sale_date) AS dow,
  AVG(d.total_revenue) AS y_forecast
FROM jdub_demo.panda.daily_store_revenue d, bounds
WHERE d.sale_date >= DATE_SUB(bounds.max_d, 180)
GROUP BY d.store_id, DAYOFWEEK(d.sale_date);

-- Future date dimension: next 14 days
CREATE OR REPLACE TEMP VIEW future_dates AS
SELECT
  CAST(DATE_ADD(current_date(), n + 1) AS DATE) AS ds,
  DAYOFWEEK(DATE_ADD(current_date(), n + 1)) AS dow
FROM (SELECT EXPLODE(SEQUENCE(0, 13)) AS n);

-- Day-part labor share by store × DOW (used to apportion daily revenue)
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
  fd.ds AS forecast_date,
  s.day_part,
  ROUND(f.y_forecast * COALESCE(s.share, 0.25), 2) AS predicted_revenue,
  CAST(ROUND(f.y_forecast * COALESCE(s.share, 0.25) / 12.50) AS BIGINT) AS predicted_transactions,
  current_timestamp() AS forecast_ts,
  'baseline_mean_v1' AS model_version
FROM daily_forecast f
JOIN future_dates fd
  ON fd.dow = f.dow
JOIN dayparts_share s
  ON s.store_id = f.store_id AND s.dow = f.dow;

-- Sanity
SELECT COUNT(*) AS forecast_rows,
       MIN(forecast_date) AS first_day,
       MAX(forecast_date) AS last_day
FROM jdub_demo.panda.sales_forecasts
WHERE forecast_ts >= current_timestamp() - INTERVAL 1 HOUR;
