# Databricks notebook source
"""
Wraps Panda's labor formula in an MLflow pyfunc and registers it to UC.
The Model Serving endpoint (declared in resources/model_serving.yml) consumes this version.
"""

# COMMAND ----------
# MAGIC %pip install --quiet --upgrade "mlflow>=3.0"

# COMMAND ----------
# MAGIC %restart_python

# COMMAND ----------

import math
import mlflow
import pandas as pd
from mlflow.models.signature import infer_signature

print("mlflow version:", mlflow.__version__)

CATALOG = "jdub_demo"
SCHEMA = "panda"
MODEL_NAME = f"{CATALOG}.{SCHEMA}.panda_labor_rec_model"

# COMMAND ----------

class PandaLaborModel(mlflow.pyfunc.PythonModel):
    # Tuned to land most stores at ~24% labor% (within the 22-26% goal).
    # labor_pct ≈ (HOURS_PER_DP * AVG_RATE * MULT[dp]) / SALES_PER_LABOR_HOUR
    # With AVG_RATE=17.50, HOURS_PER_DP=4 → labor_pct ≈ 70 * MULT / SALES_PER_LH.
    # MULT differentiates intensity by day-part; ceil() rounding will push
    # smaller-volume stores slightly above target (those are the outliers
    # store managers should review).
    SALES_PER_LABOR_HOUR = 295.0
    MULT = {"breakfast": 0.95, "lunch": 1.05, "dinner": 1.00, "late": 0.95}
    AVG_RATE = 17.50
    HOURS_PER_DP = 4.0

    def predict(self, context, model_input: pd.DataFrame) -> pd.DataFrame:
        rows = []
        for _, r in model_input.iterrows():
            sales = float(r["projected_sales"])
            dp = str(r["day_part"]).lower()
            if dp not in self.MULT:
                raise ValueError(f"Unknown day_part: {dp}")
            hc = max(1, math.ceil((sales / self.SALES_PER_LABOR_HOUR) * self.MULT[dp]))
            # Floor allocation by total crew size, then split the remainder
            # 55/45 between cooks and cashiers. Sum always equals hc.
            if hc >= 6:
                cook, cashier, lead, mgr = 1, 1, 1, 1
            elif hc >= 4:
                cook, cashier, lead, mgr = 1, 1, 1, 0
            elif hc >= 2:
                cook, cashier, lead, mgr = 1, 1, 0, 0
            else:
                cook, cashier, lead, mgr = 1, 0, 0, 0
            remaining = hc - (cook + cashier + lead + mgr)
            add_cook = round(remaining * 0.55)
            cook += add_cook
            cashier += (remaining - add_cook)
            # Invariant the UI relies on (and tests/test_labor_formula.py pins):
            # cook + cashier + shift_lead + manager == recommended_headcount.
            assert cook + cashier + lead + mgr == hc, (
                f"role mix breaks the headcount invariant: hc={hc}, "
                f"cook={cook}, cashier={cashier}, lead={lead}, mgr={mgr}"
            )
            cost = round(hc * self.AVG_RATE * self.HOURS_PER_DP, 2)
            rows.append({
                "recommended_headcount": hc,
                "recommended_cost": cost,
                "cook": cook, "cashier": cashier,
                "shift_lead": lead, "manager": mgr,
            })
        return pd.DataFrame(rows)


# COMMAND ----------
mlflow.set_registry_uri("databricks-uc")

example = pd.DataFrame([
    {"store_id": 1, "projected_sales": 4500.0, "day_part": "lunch"},
    {"store_id": 2, "projected_sales": 1200.0, "day_part": "breakfast"},
])
output = PandaLaborModel().predict(None, example)
print(output)

with mlflow.start_run(run_name="panda-labor-rec") as run:
    info = mlflow.pyfunc.log_model(
        artifact_path="model",
        python_model=PandaLaborModel(),
        input_example=example,
        signature=infer_signature(example, output),
    )
    run_id = run.info.run_id
    model_uri = f"runs:/{run_id}/model"
    print(f"Logged model at {model_uri}")

# Split the register call so artifact upload to UC has a fresh credential context
mv = mlflow.register_model(model_uri=model_uri, name=MODEL_NAME)
print(f"Registered model: {MODEL_NAME} version {mv.version}")
