# ─────────────────────────────────────────────────────────────────────────────
# verify_cgt.py — proves the CGT sell-down solver in src/cgt/cgtEngine.js.
#
# The app cannot be built on this machine (no Node), so the standing pattern is
# to re-implement the JS in Python and test it there. Keep this port in step
# with the engine — it is the only test the project has.
#
# THE ORACLE IS AN EXACT LP (scipy.optimize.linprog), not brute force. An
# earlier version of this file enumerated every permutation of a small
# portfolio and greedily filled each, on the theory that the optimum is always
# such a fill. That theory was wrong: at a tax kink the optimum can need TWO
# partial sales (e.g. part of a big gain balanced against part of a loss so the
# gain lands exactly on the exempt amount), which no single greedy fill can
# produce. The old solver and the old brute force shared that blind spot, agreed
# with each other, and were both up to £434 off. Checking against an LP is what
# exposed it.
#
# Sections:
#   1. known-answer tax cases worked by hand
#   2. optimality vs the LP — with and without per-holding sliders, up to the
#      full 184-holding roster size
#   3. targets actually met, including after whole-unit rounding
#   4. invariants — sliders honoured, allowance mode never creates a bill, etc.
#   5. a worked example to sanity-check the UI against
#
#   pip install scipy        (once)
#   python scripts/verify_cgt.py
# ─────────────────────────────────────────────────────────────────────────────

import math
import random
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    from scipy.optimize import linprog
except ImportError:  # pragma: no cover
    sys.exit("scipy is required for the LP oracle:  pip install scipy")

# Mirrors the CGT export in src/constants.js
LR_TAX, HR_TAX = 0.18, 0.24
BASE_ALLOWANCE, BASIC_RATE_LMT = 3000.0, 50270.0
MARKET_BUFFER = 0.005
EPSILON = 0.005
RATE_BISECT_STEPS = 60


# ─── Engine port ─────────────────────────────────────────────────────────────

def tax_context(income=0.0, allowance_used=0.0, is_joint=False, brought_forward=0.0):
    mult = 2 if is_joint else 1
    return {
        "exempt": max(0.0, BASE_ALLOWANCE * mult - allowance_used),
        "band": max(0.0, BASIC_RATE_LMT * mult - max(0.0, income)),
        "losses": max(0.0, brought_forward),
    }


def tax_on_gain(net_gain, ctx):
    if net_gain <= 0:
        return 0.0
    exempt_used = min(net_gain, ctx["exempt"])
    after_exempt = net_gain - exempt_used
    losses_used = min(after_exempt, ctx["losses"])
    taxable = after_exempt - losses_used
    at_lr = min(taxable, ctx["band"])
    at_hr = max(0.0, taxable - at_lr)
    return at_lr * LR_TAX + at_hr * HR_TAX


def derive(row, fx, market_buffer=MARKET_BUFFER, fx_spread=0.0, avg_cost_native=False):
    ccy = row["currency"].upper()
    to_gbp = 1.0 if ccy == "GBP" else fx.get(ccy, 1.0)
    sell_gbp = row["price"] * (1 + market_buffer) * to_gbp
    cost_unit = row["avgCost"] * to_gbp if avg_cost_native else row["avgCost"]
    value = row["qty"] * sell_gbp
    book = row["qty"] * cost_unit
    pct = min(100.0, max(0.0, float(row.get("maxSellPct", 100.0))))
    return {
        "id": row["id"], "currency": ccy, "qty": row["qty"],
        "sellPriceGbp": sell_gbp, "valueGbp": value, "bookCostGbp": book,
        "gainGbp": value - book, "fxSpread": 0.0 if ccy == "GBP" else max(0.0, fx_spread),
        "gainFraction": (value - book) / value if value > 0 else 0.0,
        "sellCap": pct / 100.0, "availableGbp": value * pct / 100.0, "locked": pct <= 0,
    }


def set_slider(h, pct):
    """Test helper: move a derived holding's slider."""
    h["sellCap"] = pct / 100.0
    h["availableGbp"] = h["valueGbp"] * h["sellCap"]
    h["locked"] = pct <= 0


def evaluate(holdings, fractions, ctx):
    gross = gain = fxc = 0.0
    trades = 0
    for h in holdings:
        f = min(h["sellCap"], max(0.0, fractions.get(h["id"], 0.0)))
        proceeds = f * h["valueGbp"]
        if proceeds <= EPSILON:
            continue
        gross += proceeds
        gain += f * h["gainGbp"]
        fxc += proceeds * h["fxSpread"]
        trades += 1
    tax = tax_on_gain(gain, ctx)
    return {"gross": gross, "gain": gain, "fx": fxc, "tax": tax,
            "net": gross - tax - fxc, "cost": tax + fxc, "trades": trades}


def greedy_fill(holdings, rate, target, key=None):
    """Port of greedyFill(): cheapest-first at a fixed rate, each up to its slider."""
    key = key or (lambda h: (h["fxSpread"] + rate * h["gainFraction"], h["gainFraction"], -h["valueGbp"]))
    fractions, raised = {}, 0.0
    for h in sorted([x for x in holdings if not x["locked"] and x["valueGbp"] > EPSILON], key=key):
        if raised >= target - EPSILON:
            break
        take = min(h["sellCap"], (target - raised) / h["valueGbp"])
        fractions[h["id"]] = take
        raised += take * h["valueGbp"]
    return fractions


def gain_of(holdings, fractions):
    return sum(fractions.get(h["id"], 0.0) * h["gainGbp"] for h in holdings)


def blend(a, b, lam):
    return {i: lam * a.get(i, 0.0) + (1 - lam) * b.get(i, 0.0) for i in set(a) | set(b)}


def optimal_fractions(holdings, target, ctx):
    """Port of optimalFractions(): greedy at 0/18/24%, plus blends landing on each kink."""
    kink_exempt = ctx["exempt"] + ctx["losses"]
    kink_band = kink_exempt + ctx["band"]
    cands = [(greedy_fill(holdings, r, target), r, False) for r in (0.0, LR_TAX, HR_TAX)]

    for lo, hi, kink in ((0.0, LR_TAX, kink_exempt), (LR_TAX, HR_TAX, kink_band)):
        if not (gain_of(holdings, greedy_fill(holdings, lo, target)) > kink
                >= gain_of(holdings, greedy_fill(holdings, hi, target))):
            continue
        for _ in range(RATE_BISECT_STEPS):
            mid = (lo + hi) / 2
            if gain_of(holdings, greedy_fill(holdings, mid, target)) > kink:
                lo = mid
            else:
                hi = mid
        above, below = greedy_fill(holdings, lo, target), greedy_fill(holdings, hi, target)
        g_above, g_below = gain_of(holdings, above), gain_of(holdings, below)
        if g_above - g_below <= 1e-9:
            continue
        cands.append((blend(above, below, (kink - g_below) / (g_above - g_below)), hi, True))

    return min(cands, key=lambda c: evaluate(holdings, c[0], ctx)["cost"])


def round_to_whole_units(holdings, fractions, target, rate):
    """Port of roundToWholeUnits(): round DOWN within the slider, then top up."""
    by_id = {h["id"]: h for h in holdings}
    max_units = lambda h: math.floor(h["sellCap"] * h["qty"] + 1e-9)  # noqa: E731
    out, raised = {}, 0.0
    for hid, f in fractions.items():
        h = by_id.get(hid)
        if not h or h["qty"] <= 0:
            continue
        units = min(max_units(h), math.floor(f * h["qty"] + 1e-9))
        if units <= 0:
            continue
        out[hid] = units / h["qty"]
        raised += units * h["sellPriceGbp"]
    if raised >= target - EPSILON:
        return out
    queue = sorted([x for x in holdings if not x["locked"] and x["qty"] > 0],
                   key=lambda h: h["fxSpread"] + rate * h["gainFraction"])
    for h in queue:
        if raised >= target - EPSILON:
            break
        already = round(out.get(h["id"], 0.0) * h["qty"])
        spare = max_units(h) - already
        if spare <= 0:
            continue
        add = min(spare, math.ceil((target - raised) / h["sellPriceGbp"]))
        out[h["id"]] = (already + add) / h["qty"]
        raised += add * h["sellPriceGbp"]
    return out


def capacity_of(holdings):
    return sum(h["availableGbp"] for h in holdings if not h["locked"])


def plan_for_gross(holdings, target, ctx, whole_units=False):
    if target > capacity_of(holdings) + EPSILON:
        return None
    fractions, rate, on_kink = optimal_fractions(holdings, target, ctx)
    if whole_units:
        fractions = round_to_whole_units(holdings, fractions, target, rate)
    plan = evaluate(holdings, fractions, ctx)
    plan.update(fractions=fractions, on_kink=on_kink)
    return plan


def solve_net(holdings, target_net, ctx, whole_units=False):
    capacity = capacity_of(holdings)
    if capacity <= EPSILON:
        return None
    ceiling = plan_for_gross(holdings, capacity, ctx, whole_units)
    if ceiling is None or ceiling["net"] < target_net - 1:
        return ceiling
    lo, hi = 0.0, capacity
    for _ in range(40):
        if hi - lo <= 0.5:
            break
        mid = (lo + hi) / 2
        if evaluate(holdings, optimal_fractions(holdings, mid, ctx)[0], ctx)["net"] >= target_net:
            hi = mid
        else:
            lo = mid
    return plan_for_gross(holdings, hi, ctx, whole_units)


def plan_within_allowance(holdings, ctx):
    fractions, gain = {}, 0.0
    queue = sorted([h for h in holdings if not h["locked"] and h["valueGbp"] > EPSILON],
                   key=lambda h: h["gainFraction"])
    for h in queue:
        remaining = ctx["exempt"] - gain
        if h["gainGbp"] <= 0:
            fractions[h["id"]] = h["sellCap"]
            gain += h["sellCap"] * h["gainGbp"]
            continue
        if remaining <= EPSILON:
            break
        take = min(h["sellCap"], remaining / h["gainGbp"])
        if take <= 0:
            break
        fractions[h["id"]] = take
        gain += take * h["gainGbp"]
    return evaluate(holdings, fractions, ctx)


# ─── The oracle ──────────────────────────────────────────────────────────────

def lp_optimum(holdings, target, ctx):
    """Exact least cost for `target` gross proceeds, by linear programming.

    minimise  sum x_i*spread_i + 18%*L + 24%*H
    s.t.      sum x_i = target
              sum x_i*gainFraction_i - L - H <= exempt + losses
              0 <= L <= band, H >= 0, 0 <= x_i <= value_i * cap_i
    """
    live = [h for h in holdings if not h["locked"] and h["valueGbp"] > EPSILON]
    if not live:
        return None
    c = [h["fxSpread"] for h in live] + [LR_TAX, HR_TAX]
    a_eq = [[1.0] * len(live) + [0.0, 0.0]]
    a_ub = [[h["gainFraction"] for h in live] + [-1.0, -1.0]]
    bounds = [(0.0, h["availableGbp"]) for h in live] + [(0.0, ctx["band"]), (0.0, None)]
    res = linprog(c, A_ub=a_ub, b_ub=[ctx["exempt"] + ctx["losses"]], A_eq=a_eq, b_eq=[target],
                  bounds=bounds, method="highs")
    if not res.success:
        return None
    fractions = {h["id"]: res.x[i] / h["valueGbp"] for i, h in enumerate(live)}
    return evaluate(holdings, fractions, ctx)["cost"]


def lp_allowance_max(holdings, ctx):
    """Most proceeds with realised gain inside the exempt amount (single-constraint LP)."""
    live = [h for h in holdings if not h["locked"] and h["valueGbp"] > EPSILON]
    if not live:
        return 0.0
    res = linprog([-1.0] * len(live), A_ub=[[h["gainFraction"] for h in live]], b_ub=[ctx["exempt"]],
                  bounds=[(0.0, h["availableGbp"]) for h in live], method="highs")
    return -res.fun if res.success else 0.0


# ─── Test harness ────────────────────────────────────────────────────────────

FAILURES = []
FX = {"USD": 0.7378, "EUR": 0.8560, "CHF": 0.9100}


def check(label, condition, detail=""):
    print(f"  {'ok  ' if condition else 'FAIL'} {label}" + ("" if condition else f"  {detail}"))
    if not condition:
        FAILURES.append(label)


def random_portfolio(rng, n, fx, fx_spread):
    rows = []
    for i in range(n):
        ccy = rng.choice(["GBP", "GBP", "USD", "EUR"])
        price = rng.uniform(2, 400)
        cost = price * fx.get(ccy, 1.0) * rng.uniform(0.35, 1.6)   # 40% loss .. 3x gain, GBP
        rows.append({"id": f"h{i}", "currency": ccy, "price": price,
                     "qty": float(rng.randint(20, 900)), "avgCost": cost})
    return [derive(r, fx, fx_spread=fx_spread) for r in rows]


def random_sliders(rng, holdings):
    for h in holdings:
        set_slider(h, rng.choice([0, 20, 35, 50, 75, 100, 100, 100]))


# ─── 1. Tax ──────────────────────────────────────────────────────────────────

def test_tax_known_answers():
    print("\n1. Tax — known answers")
    ctx = tax_context(income=30000)
    check("£10k gain / £30k income → £1,260", abs(tax_on_gain(10000, ctx) - 1260) < 0.01)
    check("£10k gain / £60k income → £1,680", abs(tax_on_gain(10000, tax_context(income=60000)) - 1680) < 0.01)
    expect = 5270 * 0.18 + (7000 - 5270) * 0.24
    check("£10k gain / £45k income → band split",
          abs(tax_on_gain(10000, tax_context(income=45000)) - expect) < 0.01)
    check("gain inside the exempt amount is free", tax_on_gain(2500, ctx) == 0)
    check("a net loss is not taxed", tax_on_gain(-5000, ctx) == 0)
    check("joint doubles exempt + band",
          abs(tax_on_gain(10000, tax_context(income=30000, is_joint=True)) - 4000 * 0.18) < 0.01)
    check("brought-forward losses apply after the exempt amount",
          abs(tax_on_gain(10000, tax_context(income=30000, brought_forward=5000)) - 2000 * 0.18) < 0.01)


# ─── 2. Optimality vs the LP ─────────────────────────────────────────────────

def optimality_run(label, seed, n, trials, sliders):
    rng = random.Random(seed)
    ran = beaten = 0
    worst = 0.0
    kinks = 0
    for _ in range(trials):
        holdings = random_portfolio(rng, n, FX, fx_spread=rng.choice([0.0, 0.0025, 0.005]))
        if sliders:
            random_sliders(rng, holdings)
        ctx = tax_context(income=rng.choice([20000, 45000, 60000]),
                          is_joint=rng.random() < 0.2,
                          brought_forward=rng.choice([0, 0, 0, 5000]))
        capacity = capacity_of(holdings)
        if capacity <= 1:
            continue
        target = capacity * rng.uniform(0.05, 0.98)
        mine = plan_for_gross(holdings, target, ctx)
        best = lp_optimum(holdings, target, ctx)
        if mine is None or best is None:
            continue
        ran += 1
        kinks += mine["on_kink"]
        gap = mine["cost"] - best
        worst = max(worst, gap)
        beaten += gap > 0.01
    check(f"{label}: matches the LP optimum on {ran} portfolios", beaten == 0,
          f"worse on {beaten}, worst gap £{worst:.2f}")
    print(f"       worst gap £{worst:.4f} · {kinks} optimal plans were two-partial kink blends")


def test_optimality():
    print("\n2. Optimality vs an exact LP")
    optimality_run("6 holdings, no sliders", 11, 6, 400, False)
    optimality_run("6 holdings, sliders", 12, 6, 400, True)
    optimality_run("15 holdings, sliders", 13, 15, 400, True)
    optimality_run("60 holdings, sliders", 14, 60, 60, True)
    optimality_run("184 holdings (full roster), sliders", 15, 184, 30, True)


def test_kink_blend_regression():
    """The exact shape that broke the old solver: two partials on the exempt kink."""
    print("\n2b. Regression — the optimum needs TWO partial sales on a tax threshold")
    rows = [
        # GBP, big gain, no FX cost:  £100.50 sale vs £63 cost  → gain fraction +0.37
        {"id": "gain", "currency": "GBP", "price": 100.0, "qty": 1000, "avgCost": 63.0},
        # USD at a loss, carries FX:  $100 ≈ £74.15 sale vs £90 cost → gain fraction −0.21
        {"id": "loss", "currency": "USD", "price": 100.0, "qty": 1000, "avgCost": 90.0},
    ]
    # Selling only the loss-maker pays £115 FX; selling only the gain pays ~£3,400 CGT.
    # The optimum sells ~£22k of the gain and ~£24k of the loss, so the net gain is
    # exactly £3,000 (tax-free) and FX is paid on half as much: ~£60.
    holdings = [derive(r, {"USD": 0.7378}, fx_spread=0.0025) for r in rows]
    ctx = tax_context(income=60000)                     # no basic-rate headroom: straight to 24%
    target = 46000.0
    plan = plan_for_gross(holdings, target, ctx)
    best = lp_optimum(holdings, target, ctx)
    partials = sum(1 for f in plan["fractions"].values() if 1e-6 < f < 1 - 1e-6)
    print(f"       gain £{plan['gain']:,.2f} · tax £{plan['tax']:.2f} · fx £{plan['fx']:.2f}"
          f" · cost £{plan['cost']:.2f} (LP £{best:.2f})")
    check("lands the realised gain exactly on the £3,000 exempt amount", abs(plan["gain"] - 3000) < 0.5)
    check("uses two partial sales", partials == 2, f"got {partials}")
    check("matches the LP", abs(plan["cost"] - best) < 0.01)
    all_loss = evaluate(holdings, greedy_fill(holdings, HR_TAX, target), ctx)["cost"]
    all_gain = evaluate(holdings, greedy_fill(holdings, 0.0, target), ctx)["cost"]
    check("beats both single-sided plans",
          plan["cost"] < min(all_loss, all_gain) - 1,
          f"blend £{plan['cost']:.2f} vs loss-only £{all_loss:.2f}, gain-only £{all_gain:.2f}")


def test_allowance_optimal():
    print("\n2c. Allowance mode raises the most the exempt amount permits")
    rng = random.Random(21)
    worst, ran = 0.0, 0
    for _ in range(150):
        holdings = random_portfolio(rng, 12, FX, fx_spread=0.0)
        random_sliders(rng, holdings)
        ctx = tax_context(income=rng.choice([30000, 60000]))
        got = plan_within_allowance(holdings, ctx)["gross"]
        best = lp_allowance_max(holdings, ctx)
        worst = max(worst, best - got)
        ran += 1
    check(f"allowance harvest matches the LP maximum on {ran} portfolios", worst < 0.5,
          f"worst shortfall £{worst:.2f}")


# ─── 3. Targets ──────────────────────────────────────────────────────────────

def test_targets_met():
    print("\n3. Targets are actually met")
    rng = random.Random(7)
    net_ok = gross_ok = 0
    trials = 40
    for _ in range(trials):
        holdings = random_portfolio(rng, 12, FX, fx_spread=0.0025)
        random_sliders(rng, holdings)
        ctx = tax_context(income=rng.choice([30000, 55000]))
        capacity = capacity_of(holdings)
        want_net = capacity * rng.uniform(0.1, 0.6)
        p = solve_net(holdings, want_net, ctx)
        net_ok += bool(p and p["net"] >= want_net - 1.0)
        want_gross = capacity * rng.uniform(0.1, 0.8)
        g = plan_for_gross(holdings, want_gross, ctx)
        gross_ok += bool(g and g["gross"] >= want_gross - EPSILON)
    check(f"net-cash target reached ({net_ok}/{trials})", net_ok == trials)
    check(f"gross target reached ({gross_ok}/{trials})", gross_ok == trials)


def test_whole_units():
    print("\n3b. Whole-unit rounding keeps the target and the sliders")
    rng = random.Random(1234)
    met = within = whole = 0
    trials = 80
    for _ in range(trials):
        holdings = random_portfolio(rng, 10, FX, fx_spread=0.0025)
        random_sliders(rng, holdings)
        ctx = tax_context(income=rng.choice([30000, 60000]))
        capacity = capacity_of(holdings)
        target = capacity * rng.uniform(0.15, 0.8)
        plan = plan_for_gross(holdings, target, ctx, whole_units=True)
        if plan is None:
            met += 1; within += 1; whole += 1        # noqa: E702  (nothing to round)
            continue
        by_id = {h["id"]: h for h in holdings}
        met += plan["gross"] >= target - EPSILON
        within += all(f <= by_id[i]["sellCap"] + 1e-9 for i, f in plan["fractions"].items())
        whole += all(abs(f * by_id[i]["qty"] - round(f * by_id[i]["qty"])) < 1e-6
                     for i, f in plan["fractions"].items())
    # A cap can leave too few whole units to reach a target that fits only
    # fractionally — reaching it in most runs is the check; never breaching a
    # slider or selling a fraction of a unit is absolute.
    check(f"rounded plans reach the target ({met}/{trials})", met >= trials - 2)
    check(f"no rounded plan exceeds a slider ({within}/{trials})", within == trials)
    check(f"every disposal is a whole number of units ({whole}/{trials})", whole == trials)


# ─── 4. Invariants ───────────────────────────────────────────────────────────

def test_invariants():
    print("\n4. Invariants")
    rng = random.Random(99)

    clean = all(plan_within_allowance(random_portfolio(rng, 10, FX, 0.0), tax_context(income=40000))["tax"] <= 0.01
                for _ in range(40))
    check("allowance mode never creates a tax bill", clean)

    holdings = random_portfolio(rng, 8, FX, fx_spread=0.0025)
    random_sliders(rng, holdings)
    ctx = tax_context(income=45000)
    capacity = capacity_of(holdings)
    nets = [(plan_for_gross(holdings, capacity * i / 20, ctx) or {"net": 0})["net"] for i in range(1, 21)]
    check("net cash increases with gross proceeds", all(b >= a - 0.5 for a, b in zip(nets, nets[1:])))

    holdings = random_portfolio(rng, 8, FX, fx_spread=0.0)
    for h, pct in zip(holdings, [0, 0, 25, 40, 60, 100, 100, 10]):
        set_slider(h, pct)
    capacity = capacity_of(holdings)
    plan = plan_for_gross(holdings, capacity * 0.95, ctx)
    zero_ids = {h["id"] for h in holdings if h["locked"]}
    check("a 0% slider is never sold", plan is not None and not any(
        plan["fractions"].get(i, 0) > 0 for i in zero_ids))
    over = [i for i, f in plan["fractions"].items()
            if f > next(h for h in holdings if h["id"] == i)["sellCap"] + 1e-9]
    check("no holding is sold beyond its slider", not over, str(over))
    check("a target above what the sliders release is refused",
          plan_for_gross(holdings, capacity * 1.5, ctx) is None)

    base = random_portfolio(random.Random(3), 5, FX, fx_spread=0.0)
    for h in base:
        h["gainGbp"] = abs(h["gainGbp"])
        h["gainFraction"] = h["gainGbp"] / h["valueGbp"]
    ctx = tax_context(income=60000)
    target = capacity_of(base) * 0.4
    without = plan_for_gross(base, target, ctx)["cost"]
    with_loss = [dict(h) for h in base]
    with_loss[0]["gainGbp"] = -abs(with_loss[0]["gainGbp"])
    with_loss[0]["gainFraction"] = with_loss[0]["gainGbp"] / with_loss[0]["valueGbp"]
    check("a loss-making holding never increases the bill",
          plan_for_gross(with_loss, target, ctx)["cost"] <= without + 1e-6)

    # Raising a slider can only make the plan cheaper or equal — more choice, never worse.
    holdings = random_portfolio(random.Random(8), 10, FX, fx_spread=0.0025)
    random_sliders(random.Random(8), holdings)
    ctx = tax_context(income=50000)
    target = capacity_of(holdings) * 0.5
    before = plan_for_gross(holdings, target, ctx)["cost"]
    loosened = [dict(h) for h in holdings]
    for h in loosened:
        set_slider(h, min(100, h["sellCap"] * 100 + 25))
    check("loosening sliders never raises the cost", plan_for_gross(loosened, target, ctx)["cost"] <= before + 1e-6)


# ─── 5. Worked example ───────────────────────────────────────────────────────

def test_worked_example():
    print("\n5. Worked example (sanity-check the UI against these)")
    rows = [
        {"id": "A", "currency": "GBP", "price": 100.0, "qty": 1000, "avgCost": 40.0},
        {"id": "B", "currency": "GBP", "price": 50.0, "qty": 1000, "avgCost": 48.0},
        {"id": "C", "currency": "USD", "price": 80.0, "qty": 500, "avgCost": 70.0},
        {"id": "D", "currency": "GBP", "price": 20.0, "qty": 2000, "avgCost": 30.0},
    ]
    holdings = [derive(r, {"USD": 0.7378}, fx_spread=0.0025) for r in rows]
    ctx = tax_context(income=60000)
    plan = solve_net(holdings, 50000, ctx)
    print(f"     £50,000 net → gross £{plan['gross']:,.0f}  gain £{plan['gain']:,.0f}  tax £{plan['tax']:,.0f}"
          f"  fx £{plan['fx']:,.0f}  net £{plan['net']:,.0f}  trades {plan['trades']}")
    check("nets the target", abs(plan["net"] - 50000) < 1.0)

    set_slider(holdings[3], 25)   # only a quarter of the loss-maker D may go
    capped = solve_net(holdings, 50000, ctx)
    print(f"     same, D capped at 25% → gross £{capped['gross']:,.0f}  tax £{capped['tax']:,.0f}"
          f"  trades {capped['trades']}  D sold {capped['fractions'].get('D', 0):.0%}")
    check("the D slider is respected", capped["fractions"].get("D", 0) <= 0.25 + 1e-9)
    check("capping the loss-maker costs at least as much", capped["cost"] >= plan["cost"] - 1e-6)


if __name__ == "__main__":
    test_tax_known_answers()
    test_optimality()
    test_kink_blend_regression()
    test_allowance_optimal()
    test_targets_met()
    test_whole_units()
    test_invariants()
    test_worked_example()

    print("\n" + "=" * 70)
    if FAILURES:
        print("FAILURES:")
        for f in FAILURES:
            print("  •", f)
        sys.exit(1)
    print("CGT engine verified: tax correct, sliders honoured, plans match an exact LP.")
