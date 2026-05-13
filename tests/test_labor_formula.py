"""Pure-Python mirror of the registered pyfunc model, exercised in unit
tests so future regressions of the role-allocation invariant fail fast.

If you change the formula in notebooks/03_register_labor_model.py, mirror
the change here too — these stay in lock-step on purpose.
"""
import math
import pytest


SALES_PER_LABOR_HOUR = 295.0
MULT = {"breakfast": 0.95, "lunch": 1.05, "dinner": 1.00, "late": 0.95}
AVG_RATE = 17.50
HOURS_PER_DP = 4.0


def labor_formula(projected_sales: float, day_part: str, store_id: int = 1) -> dict:
    if day_part not in MULT:
        raise ValueError(f"Unknown day_part: {day_part}")
    hc = max(1, math.ceil((projected_sales / SALES_PER_LABOR_HOUR) * MULT[day_part]))
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
    cost = round(hc * AVG_RATE * HOURS_PER_DP, 2)
    return {
        "headcount": hc,
        "role_mix": {"cook": cook, "cashier": cashier, "shift_lead": lead, "manager": mgr},
        "cost": cost,
    }


# Invariant: the role mix MUST sum to headcount, always. The UI relies on
# this so it can compute "the crew" totals and deltas consistently without
# defensive math. Cover edge cases AND a broad sweep.
@pytest.mark.parametrize("sales,dp", [
    (0, "breakfast"), (1, "lunch"), (100, "dinner"), (500, "late"),
    (1500, "breakfast"), (2500, "lunch"), (3500, "dinner"), (800, "late"),
    (8000, "lunch"), (12000, "dinner"), (25000, "lunch"),
])
def test_role_mix_sums_to_headcount(sales, dp):
    out = labor_formula(sales, dp)
    rm = out["role_mix"]
    assert rm["cook"] + rm["cashier"] + rm["shift_lead"] + rm["manager"] == out["headcount"], (
        f"role mix {rm} doesn't sum to headcount {out['headcount']} for sales={sales} dp={dp}"
    )


def test_sweep_role_mix_invariant():
    """Brute-force every plausible (sales, day_part) — catches off-by-ones in role allocation."""
    for sales in range(0, 30000, 250):
        for dp in MULT:
            out = labor_formula(sales, dp)
            rm = out["role_mix"]
            total = rm["cook"] + rm["cashier"] + rm["shift_lead"] + rm["manager"]
            assert total == out["headcount"], (
                f"sales={sales} dp={dp}: hc={out['headcount']} but roles sum to {total} ({rm})"
            )
            # All role counts non-negative
            assert all(v >= 0 for v in rm.values()), f"negative role count: {rm}"


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


def test_labor_pct_target_for_typical_store():
    """At realistic Panda revenue ranges, labor % should hover in 22-28%.
    Outside that band signals a formula regression."""
    cases = [(2000, "breakfast"), (3500, "lunch"), (3000, "dinner"), (800, "late")]
    for sales, dp in cases:
        out = labor_formula(sales, dp)
        pct = out["cost"] / sales
        assert 0.18 <= pct <= 0.32, f"labor % {pct:.2f} out of band for sales={sales} dp={dp}"
