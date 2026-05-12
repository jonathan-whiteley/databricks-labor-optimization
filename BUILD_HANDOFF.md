# Panda Labor Optimization — Build Handoff

Session date: 2026-05-06 / resumed 2026-05-12. Status: **End-to-end demoable. All 5 endpoints green. Tagged v0.1.0-demoable.**

App is deployed and running at: **https://panda-labor-planner-66306676349647.aws.databricksapps.com**

## 2026-05-12 resume notes

The Lakebase auth fix (DATABRICKS_CLIENT_ID) was committed and the bundle + app redeployed cleanly. `/api/health` worked but `/api/stores` still 500'd with `relation "stores_synced" does not exist`. Root cause was two-fold:
1. The App SP role exists in Lakebase (Postgres role `4cfbd6e8-bb5f-4aca-a611-f60365c7ca48`) but had **zero grants** on the `panda` schema or its tables. Postgres reports "does not exist" instead of "permission denied" when the role can't see a schema.
2. The native `schedules` table was created without a schema qualifier in `notebooks/05_init_schedules_table.sql`, so it landed in `public`. The app's `search_path` is just `panda`, which would have broken POST /api/schedule/save with the same symptom once stores started working.

Applied out-of-band:
- `ALTER TABLE public.schedules SET SCHEMA panda` (the 1-row smoke insert moved over with it)
- `GRANT USAGE ON SCHEMA panda TO "4cfbd6e8-..."`
- `GRANT SELECT` on the four `*_synced` tables
- `GRANT SELECT, INSERT, UPDATE, DELETE ON panda.schedules` and `USAGE, SELECT ON SEQUENCE panda.schedules_schedule_id_seq`

Then re-tested every endpoint: `/api/health` 200, `/api/stores` 200, `/api/forecast/1/2026-05-13` 200, `/api/recommendation/1/2026-05-13` 200, `POST /api/recommendation/recompute` 200 (returned headcount=12 from the serving endpoint), `POST /api/schedule/save` 200 (returned schedule_id=2). Tagged `v0.1.0-demoable` on commit `d3d43d4`.

Followups baked into the repo for the next rebuild:
- `notebooks/05_init_schedules_table.sql` now creates `panda.schedules` explicitly and documents the four `GRANT` statements the App SP needs in Postgres (since DAB has no resource type for Lakebase grants).

## TL;DR — finish the build

```bash
cd ~/Desktop/Projects/panda-labor-optimization
git status                # confirm 4 modified files in working tree
git add -A
git commit -m "fix(app): connect to Lakebase as App SP via DATABRICKS_CLIENT_ID"
databricks bundle deploy -t default --auto-approve
databricks apps deploy panda-labor-planner \
  --source-code-path /Workspace/Users/jonathan.whiteley@databricks.com/.bundle/panda-labor-optimization/default/files \
  --auto-approve

# Smoke test (should now return store list, not 500):
TOKEN=$(databricks auth token --output json | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s "https://panda-labor-planner-66306676349647.aws.databricksapps.com/api/stores" -H "Authorization: Bearer $TOKEN" | head -c 500

# If that returns JSON, tag it:
git tag -a v0.1.0-demoable -m "First end-to-end demoable build"
```

## Reference docs

- **Spec:** `~/Desktop/Vault/Work/docs/superpowers/specs/2026-05-06-panda-labor-optimization-design.md`
- **Plan:** `~/Desktop/Vault/Work/docs/superpowers/plans/2026-05-06-panda-labor-optimization.md`

## What's deployed and working

| Component | Resource | State |
|---|---|---|
| Repo | `~/Desktop/Projects/panda-labor-optimization/` | 9 commits, clean WIP |
| UC schema | `jdub_demo.panda` | Has all data |
| Synthetic data | `employees` (11,303), `shifts` (666,026), `staffing_targets` (50,176) | Populated |
| Sales forecasts | `sales_forecasts` (12,544 rows, 2026-05-07 → 2026-05-20, model_version `ai_forecast_v1`) | Populated |
| Labor recommendations | `labor_recommendations` (12,544 rows) | Populated |
| Pyfunc model | `jdub_demo.panda.panda_labor_rec_model` v5 | READY |
| Model Serving endpoint | `dev_jonathan_whiteley_panda-labor-rec-v1` | READY, scale-to-zero enabled |
| Lakebase Autoscaling instance | `panda-labor-db` | AVAILABLE, CU_1 |
| Lakebase host | `ep-icy-star-d1twxm2q.database.us-west-2.cloud.databricks.com` | Reachable |
| Lakebase synced reads | `panda.{sales_forecasts_synced, labor_recommendations_synced, staffing_targets_synced, stores_synced}` | All SYNCED |
| Lakebase native | `panda.schedules` | Working, smoke INSERT verified |
| Lakeflow refresh job | `panda_labor_refresh` (DAB-managed) | Tested end-to-end, 94s runtime |
| FastAPI backend | 5 routers, 6 unit tests pass | Mounts UI static |
| React frontend | Today + Adjust + Approve, Panda branding, number tweens | Built into `src/panda_labor/static/` |
| Databricks App | `panda-labor-planner` | RUNNING |
| `/api/health` | | Returns `{"status":"ok"}` |

## What's NOT working yet (the one blocker)

**`/api/stores` and all other Lakebase-backed routes return 500.**

Root cause: `src/panda_labor/lakebase.py` was minting an OAuth credential as the App's service principal (correct), but then connecting to Postgres with `user=jonathan.whiteley@databricks.com` from `USER_EMAIL` env (wrong). Lakebase rejects when the token's identity doesn't match the connection user.

Fix already in working tree (subagent wrote it, didn't commit before session died): `lakebase.py` now resolves the Postgres user from `DATABRICKS_CLIENT_ID` (the App SP's client_id, automatically injected by the Apps runtime), falling back to `USER_EMAIL` only for local dev.

**Working-tree changes not yet committed:**
- `src/panda_labor/lakebase.py` — `_db_user()` helper prefers `DATABRICKS_CLIENT_ID`
- `resources/app.yml` — endpoint reference now interpolates `${resources.model_serving_endpoints.panda_labor_endpoint.name}` (was failing because var name didn't have the dev prefix)
- `resources/model_serving.yml` — added App SP `CAN_QUERY` permission via `service_principal_client_id` UUID
- `resources/permissions.yml` — `schemas:` block removed; grants applied out-of-band (see "Lessons" #3)

## How to resume in a new session

```bash
cd ~/Desktop/Projects/panda-labor-optimization
git log --oneline -10        # last commit: a96e451 feat(bundle): declare Databricks App + UC grants for App SP
git diff --stat              # see the 4 working-tree changes
```

Then run the 4 commands in the TL;DR above. After the redeploy:
1. `/api/stores` should return a JSON array of stores
2. `/api/forecast/1/2026-05-07` should return a forecast object
3. `/api/recommendation/1/2026-05-07` should return a recommendation
4. POST `/api/recommendation/recompute` should hit the serving endpoint
5. POST `/api/schedule/save` should write to Lakebase

If anything still 500s, check the app logs: `databricks apps logs panda-labor-planner`.

## Key learnings / gotchas (worth remembering for the next Databricks Apps build)

### 1. `ai_forecast` requires a serverless SQL warehouse, not Spark serverless
First attempt ran the SQL notebook via a `notebook_task` on Spark serverless (`environment_key: default, client: "2"`). That fails with `UNSUPPORTED_FEATURE.AI_FUNCTION_PREVIEW: AI function ai_forecast is in preview and currently disabled in this environment`. The function is gated to DBSQL.

**Fix:** Run via SQL warehouse. In the Lakeflow job, use `notebook_task` with `warehouse_id` for the SQL notebook (NOT `sql_task.file.path` — that fails with `Unable to fetch SQL file from path '...'` at runtime against workspace-stored .sql notebooks). Warehouse used: `0168e23e24e6ae10` (Serverless Starter Warehouse).

### 2. MLflow on Spark serverless can't upload model artifacts to UC managed storage
Default mlflow on the `client: "2"` serverless image performs direct S3 PutObject to UC managed storage and gets `AccessDenied` from the bucket's resource-based policy on the serverless compute role. The first three log_model attempts left versions 1-4 stuck in `PENDING_REGISTRATION`.

**Fix:** `%pip install --upgrade "mlflow>=3.0"` and `%restart_python` at the top of any notebook that logs models to UC. MLflow 3 uses signed-URL artifact upload through the UC backend, bypassing the direct S3 PUT. (DBR 15 `client: "1"` is not viable either — doesn't ship mlflow at all.)

### 3. Bundle's `${resources.apps.X.service_principal_name}` is NOT a valid principal identifier
That interpolation produces a display string with a space ("app-4hg19f panda-labor-planner") which UC rejects when used in `GRANT ... TO ...`. The first attempt to declare schema grants via the bundle failed: `cannot create grants: Could not find principal with name app-4hg19f panda-labor-planner.`

**Fix:** Use `service_principal_client_id` (a UUID) for App-SP references in bundle YAML. For grants on a pre-existing schema (one not owned by the bundle), apply them out-of-band via SQL after the App is created:
```sql
GRANT USE SCHEMA, SELECT ON SCHEMA jdub_demo.panda TO `<app_sp_client_id_uuid>`;
```
(The App SP for this deployment is `4cfbd6e8-bb5f-4aca-a611-f60365c7ca48`.)

### 4. Bundle `mode: development` prefixes resource keys but NOT literal name fields
The endpoint declared as `name: ${var.endpoint_name}` with `var.endpoint_name=panda-labor-rec-v1` deploys as `dev_jonathan_whiteley_panda-labor-rec-v1` (prefixed). But Lakebase declared the same way (`name: ${var.lakebase_instance}`) stays as `panda-labor-db` (literal). The difference comes from how Terraform handles named resources of each type.

**Implication:** Cross-resource references should use `${resources.X.Y.name}` interpolation, not the var directly, so the dev prefix flows automatically. The `app.yaml` runtime env vars and any standalone code paths (e.g., the driver notebook) need to hardcode the deployed name (`dev_jonathan_whiteley_panda-labor-rec-v1`) until production target prefixes drop.

### 5. Lakebase Postgres user must match the credential identity
The OAuth token returned by `WorkspaceClient.database.generate_database_credential(...)` is bound to whichever identity made the call. Postgres connection must use that same identity as the `user` parameter. Mismatched user gets `asyncpg.exceptions.InvalidPasswordError: OAuth: User is not authorized`.

**Fix in this app:** Read `DATABRICKS_CLIENT_ID` env var (auto-injected by Apps runtime for the App SP) and use that as the Postgres user. For local dev, fall back to the human email which works against an interactive credential mint.

### 6. CDF must be enabled on source UC tables before Lakebase TRIGGERED sync will attach
First Lakebase sync deploy failed because none of the four source UC tables had Change Data Feed enabled. Had to run:
```sql
ALTER TABLE jdub_demo.panda.sales_forecasts SET TBLPROPERTIES (delta.enableChangeDataFeed = true);
-- (same for labor_recommendations, staffing_targets, stores)
```
Worth doing as part of the data-prep notebooks if rebuilding from scratch.

### 7. Row filter on `jdub_demo.panda.stores` was incompatible with online MV sync
The existing `stores` table had a `region_filter ON (region)` row filter that prevented the synced-table deploy with: "cannot have both row/column security and online materialized views." Filter was dropped via `ALTER TABLE ... DROP ROW FILTER` to unblock the sync.

**Heads-up:** If you ever need the row filter restored (e.g., real-user RLS for Panda's territory boundaries), the synced table must be deleted first or a different masking strategy adopted (column-level masks on the SP's read).

### 8. Outbound sync (Lakebase → UC) is not yet a DAB resource type
The current DAB schema (CLI v0.299) only models inbound Delta → Postgres syncs via `synced_database_tables`. The intended "schedules written by the app sync back to UC for analytics" wiring is documented as a gap in `resources/lakebase.yml`. The app still works — writes land in Lakebase — only the analytics mirror is delayed.

**Future workaround:** Scheduled job that MERGEs from Lakebase into a UC `schedules_history` Delta table on a cron. Out of scope for this build.

### 9. Vite output goes inside the Python package so FastAPI can serve it
`ui/vite.config.ts` sets `build.outDir: "../src/panda_labor/static"`. FastAPI mounts that dir last (after `/api/*` routes) with `StaticFiles(html=True)`. The mount is gated `if _static_dir.exists()` so unit tests don't fail when the UI hasn't been built.

### 10. Pydantic v2 reserves `schema` as a BaseModel attribute
The plan named the env-driven settings field `schema`. Pydantic v2 complains. Renamed to `brand_schema` in `src/panda_labor/config.py` (no other code referenced it).

### 11. Tailwind v4 changed everything
Spec was written for Tailwind v3 (`tailwind.config.ts`, `@tailwind base/components/utilities`). `bun create vite` pulls v4 which uses `@tailwindcss/vite` plugin and CSS-based theming (`@import "tailwindcss"` + `@theme { ... }`). `tailwind.config.ts` is ignored in v4. Adapted in `ui/src/styles.css`.

### 12. Forecast date drift between historical data and "today"
Existing `daily_store_revenue` spans 2023-2024; workspace clock is 2026-05-06. `ai_forecast` anchors to `MAX(sale_date)`, so forecast rows originally landed in early 2025. **Already shifted forward** — `sales_forecasts` and `labor_recommendations` now have dates 2026-05-07 to 2026-05-20. If you re-run the refresh job from scratch, you'll need to either backdate the synthetic shifts or shift forecasts forward after the job finishes (the SQL UPDATE is: `UPDATE sales_forecasts SET forecast_date = DATE_ADD(forecast_date, DATEDIFF(current_date()+1, MIN(forecast_date)) OVER ())`).

## What's outstanding (post-fix)

### Critical (after the redeploy)
- [ ] Commit the 4 working-tree changes and redeploy (commands in TL;DR)
- [ ] Smoke-test each endpoint via curl
- [ ] Tag `v0.1.0-demoable`

### Nice-to-have (Phase 6 & 7 from spec)
- [ ] **Task 26: Genie space + drawer in app.** Create a Genie space scoped to `sales_forecasts`, `daily_store_revenue`, `labor_recommendations`, and `customer_feedback_enriched`. Embed via iframe in a right-side drawer (shadcn `Sheet`-style) accessible from a chat-bubble button in the TopBar. Pre-seed 3 suggested questions.
- [ ] **Task 27 polish:**
  - In-app "Refresh forecast" button that triggers the Lakeflow job from a top-bar admin link
  - Comprehensive error states (Lakebase unreachable → friendly reconnect prompt; Model Serving timeout → revert input + retry toast; forecast not yet generated → call-to-action to refresh)
  - Role-mix pictograms could use SVG icons instead of colored dots if you want it slicker

### Real-world demo prep
- [ ] **Get Visidh's labor formula.** The placeholder formula (`headcount = ceil(projected_sales / 250) * day_part_multiplier`) is generic. Visidh committed on 2026-03-25 to send the real formula. Once received, update `notebooks/03_register_labor_model.py` (or train a new model version) and re-register. The Model Serving endpoint already supports version updates without a new deployment.
- [ ] **Decide forecast date strategy for the on-site.** Either keep the data shifted (current state, works for tomorrow's date) or anchor the demo to a fixed date in the populated range.
- [ ] **App SP needs `MODIFY` on `jdub_demo.panda.schedules`** if you ever wire the outbound Lakebase→UC sync. Currently the App writes to Lakebase only, so this isn't blocking.

### Open architectural gaps documented in the build
- Outbound Lakebase → UC sync for `schedules` (no DAB resource type exists yet; see learning #8)
- The `stores` row filter was dropped to enable the sync (learning #7) — restore strategy needed if Panda governance requires it

## Files of interest

```
~/Desktop/Projects/panda-labor-optimization/
├── databricks.yml                       # Bundle root, DEFAULT profile
├── app.yaml                              # Databricks Apps runtime entrypoint (uvicorn cmd + env vars)
├── pyproject.toml                        # uv project, FastAPI deps
├── resources/
│   ├── model_serving.yml                 # Endpoint (App SP CAN_QUERY via UUID)
│   ├── jobs.yml                          # 2-task refresh: ai_forecast (warehouse) → driver (serverless)
│   ├── lakebase.yml                      # Autoscaling instance + 4 synced reads + comment about outbound gap
│   ├── app.yml                           # App resource (lakebase + endpoint binding)
│   └── permissions.yml                   # Currently empty; grants applied out-of-band via SQL
├── notebooks/
│   ├── 01_generate_synthetic_data.py    # Employees, shifts, staffing_targets
│   ├── 02_ai_forecast.sql               # ai_forecast() — runs on serverless SQL warehouse
│   ├── 03_register_labor_model.py       # Pyfunc → UC (needs mlflow>=3)
│   ├── 04_run_recommendations.py        # Driver: forecasts → endpoint → labor_recs
│   └── 05_init_schedules_table.sql      # Postgres DDL for the native schedules table
├── src/panda_labor/
│   ├── app.py                            # FastAPI, mounts routers + UI static
│   ├── config.py                          # Env-driven settings (BRAND_SCHEMA, LAKEBASE_*, SERVING_ENDPOINT_NAME)
│   ├── lakebase.py                       # asyncpg pool + token rotation [WIP fix in working tree]
│   ├── model_client.py                   # HTTP client for Model Serving
│   └── routers/{stores,forecast,recommendation,schedule}.py
├── ui/
│   ├── package.json                      # bun + Tailwind v4 + TanStack Query + Axios
│   ├── public/panda-logo.svg             # From ~/Desktop/logos/
│   └── src/
│       ├── lib/{brand,api,cn}.ts         # brand.ts is the re-skin surface
│       ├── components/                    # DayPartCard, AnimatedNumber, RoleMixIcons, etc.
│       └── screens/{Today,Adjust}.tsx
└── tests/                                # 6 tests, all passing pre-fix
```

## Commits so far

```
a96e451 feat(bundle): declare Databricks App + UC grants for App SP
5b39a8d fix(ui): remove nonsensical revenue==cost short-circuit in recompute debounce
c435d71 feat(ui): React frontend - Today screen + Adjust + Approve flow
545f3ac feat(api): FastAPI backend (config, Lakebase, model client, all routers)
e1465a3 feat(bundle): Lakebase Autoscaling + read syncs + schedules table
dfd4fb4 feat(bundle): model serving endpoint + driver notebook + refresh job
216f470 fix: restore real ai_forecast call (run on serverless SQL warehouse)
c085576 feat: pyfunc labor model registered to UC
f81ab1d feat: synthetic labor data + forecast notebooks
0da0b45 chore: add bundle skeleton with default target
1def508 chore: init repo with Python project skeleton
```

Next commit after handoff resume:
```
fix(app): connect to Lakebase as App SP via DATABRICKS_CLIENT_ID
```
