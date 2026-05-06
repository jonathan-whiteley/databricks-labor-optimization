-- Panda Labor Optimization: native Postgres `schedules` table.
--
-- The app writes approved schedules here (low-latency from the FastAPI
-- backend). Reads of forecasts / recommendations / targets / stores come from
-- the four `*_synced` tables that Lakebase populates from Unity Catalog.
--
-- Apply via psql against the `panda_labor` database on the Lakebase
-- instance `dev_jonathan_whiteley_panda-labor-db`. Mint a credential with
-- `databricks database generate-database-credential` and connect with
-- `sslmode=require`.

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id              BIGSERIAL PRIMARY KEY,
  store_id                 INTEGER NOT NULL,
  schedule_date            DATE NOT NULL,
  day_part                 TEXT NOT NULL CHECK (day_part IN ('breakfast','lunch','dinner','late')),
  approved_headcount       INTEGER NOT NULL,
  approved_cost            DOUBLE PRECISION NOT NULL,
  approved_role_cook       INTEGER NOT NULL,
  approved_role_cashier    INTEGER NOT NULL,
  approved_role_shift_lead INTEGER NOT NULL,
  approved_role_manager    INTEGER NOT NULL,
  approved_by              TEXT NOT NULL,
  approved_ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_recommendation_ts TIMESTAMPTZ,
  override_reason          TEXT
);

CREATE INDEX IF NOT EXISTS schedules_store_date_idx
  ON schedules (store_id, schedule_date);
