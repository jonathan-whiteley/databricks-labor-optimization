# Labor IQ Demo Script

A 10-15 minute demo of the **Labor IQ** app (Lakehouse Market branding) showing how a multi-unit retail / restaurant operator can plan tomorrow's labor on Databricks: AI sales forecasts, model-served headcount recommendations, manager overrides with live recompute, audit-trail writes to Lakebase, and a natural-language "Ask Genie" panel.

**App URL:** https://labor-iq-66306676349647.aws.databricksapps.com

**Audience:** Account Executive demoing to a multi-unit retail / restaurant / hospitality customer. No code needed during the demo.

---

## Before You Demo (5-minute preflight)

Do this **the morning of the demo**, not the night before.

### 1. Confirm forecasts exist

The app defaults to **tomorrow's date** if a forecast for tomorrow exists; otherwise it clamps to the most recent forecasted day and the chip in the banner reads **"Latest available plan"** instead of **"Tomorrow's plan"**. Either way you have numbers on screen.

**Quick check:** open the app and pick any store. If you see numbers, you are good. If the page shows no forecast data at all, run the refresh job (next step).

If you want the demo to actually say "Tomorrow's plan" (i.e. the forecast window covers tomorrow), run the refresh job.

### 2. Run the refresh job (if you want a fresh "Tomorrow's plan")

In the Databricks workspace (https://fe-vm-jdub-vm-serverless.cloud.databricks.com):

1. Workflows -> Jobs -> search **`panda_labor_refresh`** (the job is shared by both apps)
2. Click **Run now**
3. Wait ~3 minutes for the three tasks to finish (ai_forecast -> run_recommendations -> ensure_genie_space)

> Note: this job extends the forecast window by 14 days from the latest historical sales date. If the historical table has not been padded forward recently, you may also need to re-run `01_generate_synthetic_data` first to push the data edge to today. See "Keeping the demo evergreen" at the bottom.

### 3. Have these two URLs open in tabs

- Labor IQ app: https://labor-iq-66306676349647.aws.databricksapps.com
- (Optional) Architecture diagram if you have one queued up

### 4. Pick a "story store" before you start

In the store dropdown, **pick one store** (e.g. Store #0042) and stick with it for the demo. Avoid hopping stores: the story is cleaner.

---

## The Talk Track (3 acts, ~12 minutes)

### Act 1: The problem (1 min, no clicks)

> *"Every multi-unit operator I talk to runs labor planning in a spreadsheet. The GM at each location wakes up, guesses tomorrow's traffic from last week, picks a headcount, and hopes labor % lands in the 22-26% range. Some days they're 18% (understaffed, lost sales). Some days they're 32% (overstaffed, margin gone). And there is no audit trail of what was promised vs. what was scheduled."*

> *"Here is what that GM's morning looks like on Databricks."*

---

### Act 2: The app (8 min, lots of clicks)

#### Step 1: Open Labor IQ

Open the app. Point out:

- The store picker (top of page)
- The day strip showing **tomorrow's date**
- The four day-part cards: **Breakfast, Lunch, Dinner, Late**

> *"This is the GM's daily planner. The default view is tomorrow. Every number you see was produced overnight by a Databricks job: an AI sales forecast, then a labor recommendation from a model running on Model Serving."*

#### Step 2: Walk one day-part card

Pick **Lunch** (the peak rush). Point to:

- **Predicted revenue** for lunch
- **Recommended headcount** (crew count + role mix)
- **Labor % donut**: should be in the 22-26% band; if not, the donut flags it

> *"The forecast comes from `ai_forecast`, a SQL function Databricks ships in the warehouse. No notebook, no model training: a single SQL call on the daily revenue table gives us day-part-level forecasts for the next two weeks. The labor recommendation is a custom pyfunc model registered in Unity Catalog and served behind a scale-to-zero endpoint."*

#### Step 3: Override the forecast

This is the headline interaction. On the lunch card:

1. Click the predicted revenue number
2. Bump it up by 25-30% (simulate a busier-than-expected day: "Friday Night Lights at the local stadium")
3. Watch the headcount and labor % **recompute live**

> *"GMs know things models don't. There's a high-school graduation across the street, or the regional manager called and asked for extra coverage. The forecast is the starting point, not the answer. The GM can override it, and the model recomputes the headcount in real time."*

#### Step 4: Pin headcount

On the same lunch card:

1. Manually adjust the crew count (e.g. add 1-2 more team members)
2. Watch labor % recompute (it goes up since you added cost without adding revenue)

> *"They can also override the headcount directly. Maybe payroll says we have to give a senior team member a shift this week. Pin it, see the labor % impact, decide."*

#### Step 5: Reset

Click **Reset** on the card.

> *"Reset reverts cleanly to the AI forecast. Nothing is destructive."*

#### Step 6: Approve the schedule

Find the **Approve** button (or equivalent at the page level).

1. Click Approve
2. Mention that this writes to Lakebase (managed Postgres)

> *"When the GM hits Approve, the schedule is written to Lakebase: that's Databricks' managed Postgres for OLTP workloads. So this app reads from synced tables (Unity Catalog -> Postgres in sub-100ms) and writes overrides and approvals back to a native Postgres table. One database, one auth, one audit trail."*

#### Step 7: Ask Genie (the wow moment)

Open the **Ask Genie** panel (right side or however the UI presents it).

Try one of these:

- *"Which 5 stores have the highest forecasted labor % tomorrow?"*
- *"What's the chain-wide labor cost % for each of the next 7 days?"*
- *"Which regions have the highest forecasted labor % for tomorrow?"*

Let Genie return a table or chart. Then click **Show SQL** if available.

> *"Genie is Databricks' natural-language analytics surface. It's embedded in the app and shares the user's SSO session. The GM asks a question, Genie writes the SQL, runs it on the same warehouse, and brings the answer back. If audit asks, you can show the SQL it ran."*

> **AE heads-up:** if you click **Show SQL** in the Ask Genie panel today, the table references will read `jdub_demo.panda.*`. The row content is generic ("Store #0001", region "West") and won't read as customer-specific. If the customer is Panda Express themselves, lean into it. If they're a different brand and you want to be safe, **don't open Show SQL** during the demo. See [Phase 2: Full Schema Genericization](#phase-2-full-schema-genericization) below.

---

### Act 3: The architecture (3 min, one slide or whiteboard)

Tell this in 6 beats:

1. **`ai_forecast`**: Databricks SQL function on the warehouse. Day-part forecasts for the next 14 days. No model training notebook.
2. **Model Serving (pyfunc)**: The labor formula is a registered MLflow model, versioned in UC, served on a scale-to-zero endpoint.
3. **Lakebase Provisioned (Postgres)**: Managed Postgres. Four UC -> Postgres TRIGGERED synced tables feed the app at sub-100ms; one native Postgres table holds overrides and approvals.
4. **Databricks Apps**: The whole front-end runs as a Databricks App: FastAPI + React + Tailwind, hosted by Databricks, OAuth and a service principal out of the box.
5. **Genie Space**: Same warehouse, same UC tables, embedded in the app. NL -> SQL with SSO carry-through.
6. **Asset Bundles (DABs)**: One `databricks bundle deploy` provisions the refresh job, the model endpoint, the app, the Lakebase instance binding, the four synced tables, and the grants. Reproducible from a Git repo.

> *"That's six product areas (`ai_forecast`, MLflow + Model Serving, Lakebase, Databricks Apps, Genie, Asset Bundles) wired together in a single deployable bundle. Every one of these landed in 2024 or 2025. Two years ago this would have been a half-million-dollar SI engagement; today it's one repo."*

---

## After the Demo: Likely Customer Questions

| Question | One-line answer |
|---|---|
| "Can it use our real POS data?" | Yes; swap the source table behind `daily_store_revenue`. The forecast function is data-agnostic. |
| "What's the labor formula?" | Visible in the MLflow registered model. Custom pyfunc, easily replaced with the customer's own formula. |
| "Does Genie hallucinate?" | Genie writes SQL against governed tables only. Show SQL is always available. |
| "How is auth handled?" | The app uses the user's SSO session; the model endpoint and Lakebase are scoped to the app's service principal. |
| "Can the GM see only their store?" | Yes; row filters in Unity Catalog. (We removed one for the demo so all stores show.) |
| "Cost?" | Warehouse for forecasts (serverless, scale-to-zero), Model Serving (scale-to-zero), Lakebase (CU_1), Apps (small compute). Easily under $1K/month for a 50-store pilot. |
| "Source code?" | Databricks Asset Bundle in a Git repo. Single `databricks bundle deploy`. |

---

## Keeping the Demo Evergreen (read this once)

**Why this matters:** the forecast horizon is `MAX(sale_date) + 14 days`, where `sale_date` is the latest day in `jdub_demo.panda.daily_store_revenue`. If the historical data is not refreshed, the forecast window stops advancing and the app starts showing the "forecast not yet generated" banner.

**Three ways to keep the demo evergreen:**

### A. Schedule the refresh job (easy, fixes ~14 days at a time)

Add a daily schedule to `panda_labor_refresh` in Workflows.

```
Schedule: every day at 5:00 AM PT
```

This is enough **IF** the historical data already covers up to today. If the data anchor is fixed in 2024, this alone won't help.

### B. Pad historical data forward, then run the refresh job (best for demos)

Run `notebooks/01_generate_synthetic_data.py` once: it writes daily revenue rows up to `date.today()`. Then run `panda_labor_refresh`. You're good for ~14 days.

Repeat every two weeks (or schedule both notebooks daily).

### C. Anchor the forecast to `current_date()` instead of `MAX(sale_date)`

Edit `notebooks/02_ai_forecast.sql`: change the horizon anchor from `MAX(sale_date) + 14 days` to `current_date() + 14 days`. This requires the historical data to extend close to `current_date()`, otherwise `ai_forecast` will extrapolate too far and quality drops.

**Recommended for ongoing demoability:** option B with a daily schedule on both notebooks.

---

## Phase 2: Full Schema Genericization (follow-up)

Today, the labor-iq app shows **Lakehouse Market** branding everywhere a customer can see it (logo, title, theme, browser tab, FastAPI /docs page, Genie space title). The only Panda mentions left are in backend names that **only leak via "Show SQL" in Ask Genie**:

| Where | What | Visible to customer? |
|---|---|---|
| UC schema name | `jdub_demo.panda.*` | Yes, in Ask Genie -> Show SQL |
| Lakebase PG schema | `panda` | No |
| Lakebase instance | `panda-labor-db` | No |
| Python module | `panda_labor` | No |
| Model endpoint | `dev_jonathan_whiteley_panda-labor-rec-v1` | No |
| Refresh job | `panda_labor_refresh` | No |
| Bundle name | `panda-labor-optimization` | No |

**To remove the last visible leak (Show SQL in Genie):**

1. Create a UC schema `jdub_demo.lakehouse_market`.
2. Create views in that schema: `CREATE VIEW jdub_demo.lakehouse_market.sales_forecasts AS SELECT * FROM jdub_demo.panda.sales_forecasts` (and the same for `labor_recommendations` and `daily_store_revenue`).
3. Update the Labor IQ Genie space (id `01f15a1f81f61d139129cc802fc0f2ad`) to reference the new view names.
4. Grant the labor-iq app SP `USE SCHEMA, SELECT` on the new schema.

That's a 20-minute change. The app itself does not need to change because it reads from Lakebase, not UC.

If you want me to do this, ask: **"do Phase 2 for labor-iq."**

---

## Quick Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Banner says "Latest available plan" instead of "Tomorrow's plan" | Forecast window does not yet reach tomorrow | Optional: run `panda_labor_refresh` to push the window forward. Demo still works as-is. |
| No data at all in the day-part cards | `sales_forecasts` table is empty | Run `panda_labor_refresh` (and `01_generate_synthetic_data` first if the historical table is also empty) |
| 500 on `/api/stores` | Lakebase auth or grant issue | Check `databricks apps logs labor-iq` |
| Ask Genie returns no data | Genie space points at empty tables | Run the refresh job |
| App slow on first request | Lakebase pool warm-up | First click is slow; subsequent are fast |

---

*Generated by Isaac. App URL: https://labor-iq-66306676349647.aws.databricksapps.com*
