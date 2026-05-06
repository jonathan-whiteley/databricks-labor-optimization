"""Test the labor formula in isolation (pure Python)."""
import pytest


def labor_formula(projected_sales: float, day_part: str, store_id: int = 1) -> dict:
    """Mirrors PandaLaborModel.predict() logic for unit testing without MLflow."""
    import math
    SALES_PER_LABOR_HOUR = 250.0
    MULT = {"breakfast": 0.8, "lunch": 1.2, "dinner": 1.1, "late": 0.7}
    if day_part not in MULT:
        raise ValueError(f"Unknown day_part: {day_part}")
    headcount = max(1, math.ceil((projected_sales / SALES_PER_LABOR_HOUR) * MULT[day_part]))
    role_mix = {
        "cook": max(1, int(headcount * 0.45)),
        "cashier": max(1, int(headcount * 0.35)),
        "shift_lead": max(0, int(headcount * 0.15)) or (1 if headcount > 4 else 0),
        "manager": 1 if headcount >= 5 else 0,
    }
    avg_rate = 17.50
    hours_per_dp = 4.0
    cost = round(headcount * avg_rate * hours_per_dp, 2)
    return {"headcount": headcount, "role_mix": role_mix, "cost": cost}


def test_lunch_high_sales_returns_substantial_headcount():
    out = labor_formula(8000, "lunch")
    assert out["headcount"] >= 8
    assert out["role_mix"]["manager"] == 1


def test_late_low_sales_returns_minimum_crew():
    out = labor_formula(400, "late")
    assert out["headcount"] >= 1
    assert out["role_mix"]["cook"] >= 1


def test_unknown_day_part_raises():
    with pytest.raises(ValueError):
        labor_formula(1000, "midnight")


def test_cost_scales_with_headcount():
    low = labor_formula(500, "breakfast")
    high = labor_formula(8000, "lunch")
    assert high["cost"] > low["cost"]
