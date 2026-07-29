# Databricks notebook source
"""
Generates synthetic labor data for the Labor Optimization demo.

Tables produced (in jdub_demo.labor_optimization):
  - employees:        ~50 per store, role-distributed
  - shifts:           90 days of historical labor with realistic hours/cost tracking sales
  - staffing_targets: Labor optimization formula encoded as a lookup

Idempotent: overwrites each table.
"""

import math
import random
from datetime import date, datetime, timedelta
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, LongType, IntegerType, StringType,
    DoubleType, DateType, TimestampType, BooleanType,
)

CATALOG = "jdub_demo"
SCHEMA = "labor_optimization"
random.seed(42)

ROLES = ["cook", "cashier", "shift_lead", "manager"]
ROLE_RATES = {"cook": 16.50, "cashier": 15.00, "shift_lead": 19.50, "manager": 26.00}
ROLE_DISTRIBUTION = {"cook": 0.40, "cashier": 0.40, "shift_lead": 0.15, "manager": 0.05}
DAY_PARTS = ["breakfast", "lunch", "dinner", "late"]
DAY_PART_HOURS = {
    "breakfast": (6, 10), "lunch": (10, 14),
    "dinner": (16, 21), "late": (21, 23),
}
DAY_PART_MULTIPLIERS = {"breakfast": 0.8, "lunch": 1.2, "dinner": 1.1, "late": 0.7}
SALES_PER_LABOR_HOUR = 250.0

# COMMAND ----------

stores_df = spark.table(f"{CATALOG}.{SCHEMA}.stores")
store_ids = [r.store_id for r in stores_df.select("store_id").collect()]
print(f"Generating data for {len(store_ids)} stores")

# COMMAND ----------
# EMPLOYEES

employees = []
employee_id = 1
for store_id in store_ids:
    n_employees = random.randint(40, 60)
    for _ in range(n_employees):
        role = random.choices(list(ROLE_DISTRIBUTION.keys()),
                              weights=list(ROLE_DISTRIBUTION.values()))[0]
        rate = ROLE_RATES[role] + random.uniform(-1.0, 2.0)
        hire = date.today() - timedelta(days=random.randint(30, 1825))
        employees.append((employee_id, int(store_id), f"Emp_{employee_id}", role,
                          round(rate, 2), hire, True))
        employee_id += 1

emp_schema = StructType([
    StructField("employee_id", LongType()),
    StructField("store_id", IntegerType()),
    StructField("full_name", StringType()),
    StructField("role", StringType()),
    StructField("hourly_rate", DoubleType()),
    StructField("hire_date", DateType()),
    StructField("active", BooleanType()),
])
emp_df = spark.createDataFrame(employees, emp_schema)
emp_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.employees")
print(f"Wrote {emp_df.count()} employees")

# COMMAND ----------
# SHIFTS

emp_by_store = {}
for r in emp_df.collect():
    emp_by_store.setdefault(r.store_id, []).append(r)

shifts = []
shift_id = 1
end_date = date.today()
start_date = end_date - timedelta(days=90)
day_count = (end_date - start_date).days

for store_id in store_ids:
    emps = emp_by_store.get(int(store_id), [])
    if not emps:
        continue
    for d_offset in range(day_count):
        d = start_date + timedelta(days=d_offset)
        dow = d.weekday()
        weekend_boost = 1.3 if dow >= 5 else 1.0
        for dp in DAY_PARTS:
            mult = DAY_PART_MULTIPLIERS[dp]
            n_shifts = max(2, int(round(8 * mult * weekend_boost * random.uniform(0.85, 1.15))))
            chosen = random.sample(emps, min(n_shifts, len(emps)))
            start_h, end_h = DAY_PART_HOURS[dp]
            for emp in chosen:
                start_ts = datetime.combine(d, datetime.min.time()).replace(hour=start_h)
                end_ts = datetime.combine(d, datetime.min.time()).replace(hour=end_h)
                hours = (end_ts - start_ts).total_seconds() / 3600.0
                cost = round(hours * emp.hourly_rate, 2)
                shifts.append((shift_id, emp.employee_id, int(store_id), d, dp,
                               start_ts, end_ts, hours, cost))
                shift_id += 1

shift_schema = StructType([
    StructField("shift_id", LongType()),
    StructField("employee_id", LongType()),
    StructField("store_id", IntegerType()),
    StructField("shift_date", DateType()),
    StructField("day_part", StringType()),
    StructField("start_ts", TimestampType()),
    StructField("end_ts", TimestampType()),
    StructField("hours_worked", DoubleType()),
    StructField("labor_cost", DoubleType()),
])
shifts_df = spark.createDataFrame(shifts, shift_schema)
shifts_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.shifts")
print(f"Wrote {shifts_df.count()} shifts")

# COMMAND ----------
# STAFFING_TARGETS

bands = [
    (0, 1000), (1000, 2000), (2000, 3000), (3000, 4000),
    (4000, 5500), (5500, 7000), (7000, 9000), (9000, 999999),
]
target_rows = []
for store_id in store_ids:
    for dow in range(7):
        for dp in DAY_PARTS:
            mult = DAY_PART_MULTIPLIERS[dp]
            for low, high in bands:
                mid = (low + (high if high < 999999 else low + 2000)) / 2.0
                hc = max(1, math.ceil((mid / SALES_PER_LABOR_HOUR) * mult))
                role_mix = {
                    "cook": max(1, int(hc * 0.45)),
                    "cashier": max(1, int(hc * 0.35)),
                    "shift_lead": max(0, int(hc * 0.15)) or (1 if hc > 4 else 0),
                    "manager": 1 if hc >= 5 else 0,
                }
                target_rows.append((int(store_id), dow, dp, float(low), float(high), hc, role_mix))

target_schema = StructType([
    StructField("store_id", IntegerType()),
    StructField("day_of_week", IntegerType()),
    StructField("day_part", StringType()),
    StructField("sales_band_low", DoubleType()),
    StructField("sales_band_high", DoubleType()),
    StructField("ideal_headcount", IntegerType()),
    StructField("role_mix", StructType([
        StructField("cook", IntegerType()),
        StructField("cashier", IntegerType()),
        StructField("shift_lead", IntegerType()),
        StructField("manager", IntegerType()),
    ])),
])
targets_df = spark.createDataFrame(target_rows, target_schema)
targets_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.staffing_targets")
print(f"Wrote {targets_df.count()} staffing target rows")

# COMMAND ----------
# Sanity check
sanity = spark.sql(f"""
    SELECT s.shift_date AS d, SUM(s.labor_cost) AS labor, SUM(r.total_revenue) AS rev
    FROM {CATALOG}.{SCHEMA}.shifts s
    LEFT JOIN {CATALOG}.{SCHEMA}.daily_store_revenue r
      ON s.shift_date = r.sale_date AND s.store_id = r.store_id
    GROUP BY s.shift_date ORDER BY d DESC LIMIT 10
""")
sanity.display()
print("Done.")
