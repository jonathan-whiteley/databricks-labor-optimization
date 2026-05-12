-- Panda Labor Optimization: native Postgres `schedules` table.
--
-- The app writes approved schedules here (low-latency from the FastAPI
-- backend). Reads of forecasts / recommendations / targets / stores come from
-- the four `*_synced` tables that Lakebase populates from Unity Catalog.
--
-- Apply via psql against the `panda_labor` database on the Lakebase
-- instance `panda-labor-db`. Mint a credential with
-- `databricks database generate-database-credential` and connect with
-- `sslmode=require`.
--
-- The table is created in the `panda` schema so the FastAPI search_path
-- (panda) resolves it without a qualifier. The four `*_synced` read tables
-- also live in `panda`, populated by the synced_database_tables resources
-- in resources/lakebase.yml.

CREATE TABLE IF NOT EXISTS panda.schedules (
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
  ON panda.schedules (store_id, schedule_date);

-- App SP needs Postgres grants on the panda schema. The bundle cannot
-- declare these (no DAB resource type for Lakebase grants), so apply them
-- after the App and synced tables exist:
--
--   GRANT USAGE ON SCHEMA panda TO "<app_sp_client_id_uuid>";
--   GRANT SELECT ON panda.stores_synced,
--                   panda.sales_forecasts_synced,
--                   panda.labor_recommendations_synced,
--                   panda.staffing_targets_synced
--     TO "<app_sp_client_id_uuid>";
--   GRANT SELECT, INSERT, UPDATE, DELETE ON panda.schedules
--     TO "<app_sp_client_id_uuid>";
--   GRANT USAGE, SELECT ON SEQUENCE panda.schedules_schedule_id_seq
--     TO "<app_sp_client_id_uuid>";
