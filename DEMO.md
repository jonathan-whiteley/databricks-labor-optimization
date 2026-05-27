# Labor IQ Demo Script (5 min)

**App URL:** https://labor-iq-66306676349647.aws.databricksapps.com

## Who this is for

**Multi-unit retail, restaurant, and hospitality operators with 50+ locations.** The decision-maker is the **COO or VP of Operations**; the hands-on user is the **store-level GM**. They run labor planning in spreadsheets today, with no AI, no audit trail, and no chain-wide visibility.

## The business case (your hook)

> *"On a 50-store chain doing $250K weekly revenue per store, every 1% miss on labor cost is roughly $650K of margin per year. Most operators run labor planning in Excel and miss by 2-4% routinely. Labor IQ is what that planning looks like when you put Databricks underneath it: AI forecasts, GM overrides with live recompute, every decision written back to a governed database, and natural-language Q&A across the whole chain."*

## The 5-minute demo (4 beats)

### Beat 1: The GM's morning (60 sec)

1. Open the app, pick a store.
2. Point to the four day-part cards (Breakfast, Lunch, Dinner, Late) and the labor % donut.
3. Click the predicted revenue on **Lunch**, bump it up 25%, watch headcount and labor % recompute live.

> *"This is the GM's daily planner. Tomorrow's forecast is already computed; they override what the model can't see, like a graduation across the street, and the recommendation updates in real time."*

### Beat 2: Lakebase, the audit trail (90 sec) [priority]

1. Click **Approve** on the schedule.
2. Mention: *"That write just landed in Lakebase, Databricks' managed Postgres."*
3. Reload the page. The override is still there.

> *"Two years ago, building this meant Postgres on RDS, a separate auth system, a separate network, a separate ops team. Lakebase is Databricks' managed Postgres: same workspace, same SSO, same governance. The app reads from synced tables (Unity Catalog data mirrored to Postgres in sub-100ms) and writes overrides to a native Postgres table. One database, one auth model, one audit trail across the whole chain. When the CFO asks why labor was 28% last Tuesday, the answer is in this database."*

**Why this matters for the customer:** OLTP next to the lakehouse means no more "the analytics data is right but the operational data is somewhere else." Lakebase is the answer to "how do we serve an app from our data platform without spinning up a separate Postgres."

### Beat 3: Genie, chain-wide Q&A in plain English (90 sec) [priority]

1. Open the **Ask Genie** panel.
2. Type: *"Which 5 stores have the highest forecasted labor % tomorrow?"*
3. Let Genie return a table.
4. Follow up in the same conversation: *"Now show me the chain-wide labor % for each of the next 7 days."*

> *"Genie is Databricks' natural-language analytics surface. It's embedded in the app, scoped to the labor data, and runs governed SQL under the hood. The GM asks a question, gets an answer in seconds, and if compliance asks where the number came from, we can show the exact SQL. No analyst ticket, no week-long wait, no risk of hallucinated numbers."*

**Why this matters for the customer:** the COO can ask the same questions the GM does, across all stores at once, without going through BI. This is the chain-wide visibility layer that spreadsheets cannot provide.

### Beat 4: One bundle, ship it (60 sec)

> *"Behind this app: `ai_forecast` (SQL function on the warehouse, no model training), MLflow + Model Serving (the labor formula as a pyfunc), Lakebase Provisioned (the Postgres you just saw), Databricks Apps (FastAPI + React, hosted by Databricks), Genie, and Asset Bundles. Six product areas, all on the platform you already have. A single `databricks bundle deploy` provisions every resource from a Git repo. This whole thing was built in one engagement; you can have your version running in two weeks."*

## Demo prep checklist (5 min the morning of)

1. Open the app, pick a store, confirm cards have numbers. If the banner reads **"Latest available plan"** instead of **"Tomorrow's plan"**, that's fine: the app clamps to the latest forecasted day. Demo still works.
2. Want it to actually say "Tomorrow's plan"? Run the **`panda_labor_refresh`** job in Workflows (3 minutes). Same job serves both apps.
3. Have these tabs open: the app, and one architecture slide.
4. Pick a story store and stick with it.

## Likely customer questions

| Question | One-line answer |
|---|---|
| Can it use our real POS data? | Yes. Swap the source table behind `daily_store_revenue`. |
| Does Genie hallucinate? | No. It writes SQL against governed UC tables and shows the SQL on request. |
| How is auth handled? | App uses the user's SSO. The model endpoint and Lakebase are scoped to the app's service principal. |
| Can a GM see only their store? | Yes, via UC row filters. |
| What's it cost? | Serverless warehouse + scale-to-zero serving + CU_1 Lakebase + small Apps compute. Comfortably under $1K/month for a 50-store pilot. |
| What's the labor formula? | A custom pyfunc in MLflow. Replace with the customer's own model in one notebook. |

## If something breaks

| Symptom | Fix |
|---|---|
| Banner says "Latest available plan" | Optional: run `panda_labor_refresh` to push the window forward. Demo still works as-is. |
| No data in cards at all | `sales_forecasts` is empty. Run `01_generate_synthetic_data` then `panda_labor_refresh`. |
| 500 on `/api/stores` | `databricks apps logs labor-iq` |
| First click is slow | Lakebase pool warm-up. Second click is fast. |

---

*Heads-up: if you click **Show SQL** in Ask Genie, table references read `jdub_demo.panda.*`. Row content is generic; if the customer is not Panda Express, just don't open Show SQL during the demo. Ask if you want the schema renamed.*
