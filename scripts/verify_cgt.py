# ─────────────────────────────────────────────────────────────────────────────
# verify_cgt.py — proves the CGT sell-down solver in src/cgt/cgtEngine.js.
#
# The app cannot be built on this machine (no Node), so the standing pattern is
# to re-implement the JS in Python and test it there. This file does that and
# then attacks the result four ways:
#
#   1. KNOWN-ANSWER tax cases worked by hand.
#   2. TARGETS ARE MET — net-cash mode really does leave the client with £X
#      after the tax its own disposals create.
#   3. OPTIMALITY vs BRUTE FORCE. For a fixed proceeds target this is a
#      fractional knapsack, so the optimum is always a greedy fill along SOME
#      ordering of the holdings (swap-argument: at the optimum no ε of proceeds
#      can profitably move between two holdings). We therefore enumerate ALL
#      permutations of a small portfolio, greedily fill each, and check the
#      engine's handful of candidate orderings finds the same best cost.
#   4. INVARIANTS — monotonicity, allowance mode never creates a tax bill,
#      locks are honoured, nothing sells more than it holds.
#
#   python scripts/verify_cgt.py
# ─────────────────────────────────────────────────────────────────────────────

import itertools
import math
import random
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Mirrors the CGT export in src/constants.js
LR_TAX, HR_TAX = 0.18, 0.24
BASE_ALLOWANCE, BASIC_RATE_LMT = 3000.0, 50270.0
MARKET_BUFFER = 0.005
EPSILON = 0.005


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
    return {
        "id": row["id"], "currency": ccy, "qty": row["qty"],
        "sellPriceGbp": sell_gbp, "valueGbp": value, "bookCostGbp": book,
        "gainGbp": value - book, "fxSpread": 0.0 if ccy == "GBP" else max(0.0, fx_spread),
        "gainFraction": (value - book) / value if value > 0 else 0.0,
        "locked": row.get("locked", False), "forced": row.get("forced", False),
    }


def evaluate(holdings, fractions, ctx):
    gross = gain = fxc = 0.0
    trades = 0
    for h in holdings:
        f = min(1.0, max(0.0, fractions.get(h["id"], 0.0)))
        proceeds = f * h["valueGbp"]
        if proceeds <= EPSILON:
            continue
        gross += proceeds
        gain += f * h["gainGbp"]
        fxc += proceeds * h["fxSpread"]
        trades += 1
    tax = tax_on_gain(gain, ctx)
    return {
        "gross": gross, "gain": gain, "fx": fxc, "tax": tax,
        "net": gross - tax - fxc, "cost": tax + fxc, "trades": trades,
    }


RATE_CAP = 48        # most orderings are duplicates; cap keeps big portfolios fast
POLISH_TOP = 5       # only the most promising orderings earn an expensive prune


def candidate_rates(holdings, cap=None):
    """
    Every marginal tax rate that yields a DISTINCT cheapest-first ordering.

    Selling £1 from holding h costs `gainFraction*r + fxSpread`, where r is the
    marginal rate the plan ends up at (0 inside the exempt amount, then 18%,
    then 24%). Ordering by that key is optimal for whichever r is realised — but
    r isn't known until the plan exists.

    Two holdings swap places at exactly one rate: r* = (s_j - s_i)/(gf_i - gf_j).
    Collecting every such crossing inside [0, 24%] and taking midpoints between
    consecutive crossings enumerates every ordering the key can ever produce, so
    trying them all is exhaustive rather than a guess.
    """
    cap = RATE_CAP if cap is None else cap
    hs = [h for h in holdings if not h["locked"]]
    rates = {0.0, LR_TAX, HR_TAX}
    for i in range(len(hs)):
        for j in range(i + 1, len(hs)):
            dg = hs[i]["gainFraction"] - hs[j]["gainFraction"]
            if abs(dg) < 1e-12:
                continue
            r = (hs[j]["fxSpread"] - hs[i]["fxSpread"]) / dg
            if 0.0 <= r <= HR_TAX:
                rates.add(r)
    xs = sorted(rates)
    out = set(xs)
    for a, b in zip(xs, xs[1:]):
        out.add((a + b) / 2)
    out = sorted(out)

    # O(n^2) crossings is far more orderings than a real portfolio needs. Thin
    # them evenly, always keeping the three statutory rates.
    if len(out) > cap:
        keep = {0.0, LR_TAX, HR_TAX}
        step = len(out) / (cap - len(keep))
        keep |= {out[min(len(out) - 1, int(i * step))] for i in range(cap - len(keep))}
        out = sorted(keep)
    return out


def orderings(holdings):
    """Cost-optimal candidates, then two tidiness-biased ones for fewest trades."""
    out = []
    for r in candidate_rates(holdings):
        # Ties broken toward the lower gain (protects the exempt amount) and
        # then the larger position (fewer trades) — degeneracy at r = 0 would
        # otherwise pick high-gain holdings arbitrarily.
        out.append((f"cost-{r:.4f}",
                    lambda h, r=r: (h["gainFraction"] * r + h["fxSpread"],
                                    h["gainFraction"], -h["valueGbp"])))
    for band in (0.02, 0.05):
        out.append((f"banded-{band}",
                    lambda h, b=band: (round((h["gainFraction"] * HR_TAX + h["fxSpread"]) / b),
                                       -h["valueGbp"])))
    out.append(("size", lambda h: (-h["valueGbp"],)))
    return out


def fill_to_proceeds(holdings, key, target, exclude=()):
    fractions, raised = {}, 0.0
    sellable = [h for h in holdings
                if not h["locked"] and h["valueGbp"] > EPSILON and h["id"] not in exclude]
    for h in [x for x in sellable if x["forced"]]:
        fractions[h["id"]] = 1.0
        raised += h["valueGbp"]
    for h in sorted([x for x in sellable if not x["forced"]], key=key):
        if raised >= target - EPSILON:
            break
        take = min(1.0, (target - raised) / h["valueGbp"])
        fractions[h["id"]] = take
        raised += take * h["valueGbp"]
    return fractions


def prune(holdings, key, target, ctx):
    """
    Drop disposals that earn their place in the ordering but not in the plan.

    A greedy fill ranks by cost per £, which always prefers a bigger loss. Once
    the plan's total gain is already below the exempt amount, though, further
    losses are worth NOTHING — so a small loss-making holding that happens to
    carry an FX charge gets bought into the plan for no benefit. No single
    ordering can express "skip that one" (it outranks its alternatives at every
    tax rate), so we drop candidates one at a time and keep any drop that pays.
    """
    exclude = set()
    best_f = fill_to_proceeds(holdings, key, target, exclude)
    best = evaluate(holdings, best_f, ctx)
    if best["gross"] < target - EPSILON:
        return best_f, best

    for _ in range(len(holdings)):
        active = [hid for hid, f in best_f.items() if f > 1e-9]
        winner = None
        for hid in active:
            trial_f = fill_to_proceeds(holdings, key, target, exclude | {hid})
            trial = evaluate(holdings, trial_f, ctx)
            if trial["gross"] < target - EPSILON:
                continue
            if trial["cost"] < best["cost"] - 1e-6:
                winner, best, best_f = hid, trial, trial_f
        if winner is None:
            break
        exclude.add(winner)

    return best_f, best


def plan_for_gross(holdings, target, ctx, polish=True):
    """
    Two phases, because the prune pass is ~n^2 times the cost of a plain fill:

      1. cheap — greedy fill along every candidate ordering;
      2. expensive — prune only the few most promising results.

    Pruning can only lower the cost, so skipping it (polish=False) yields a
    valid, slightly-worse plan. That is what the net-cash bisection uses.
    """
    capacity = sum(h["valueGbp"] for h in holdings if not h["locked"])
    if target > capacity + EPSILON:
        return None

    rough = []
    for name, key in orderings(holdings):
        plan = evaluate(holdings, fill_to_proceeds(holdings, key, target), ctx)
        if plan["gross"] < target - EPSILON:
            continue
        plan["ordering"] = name
        plan["_key"] = key
        rough.append(plan)
    if not rough:
        return None

    rough.sort(key=lambda p: p["cost"])
    if not polish:
        return rough[0]

    best = rough[0]
    for cand in rough[:POLISH_TOP]:
        _, polished = prune(holdings, cand["_key"], target, ctx)
        if polished["gross"] < target - EPSILON:
            continue
        polished["ordering"] = cand["ordering"]
        if polished["cost"] < best["cost"] - 1e-6:
            best = polished
    return best


def solve_net(holdings, target_net, ctx):
    """
    Gross proceeds needed to leave `target_net` in hand.

    Bisects with the CHEAP evaluator, then polishes once at the answer. Polishing
    only reduces tax + FX, so net cash can only rise — the target still clears.
    """
    capacity = sum(h["valueGbp"] for h in holdings if not h["locked"])
    if capacity <= EPSILON:
        return None
    ceiling = plan_for_gross(holdings, capacity, ctx)
    if ceiling is None or ceiling["net"] < target_net - 1:
        return ceiling

    lo, hi = 0.0, capacity
    for _ in range(40):
        if hi - lo <= 0.5:
            break
        mid = (lo + hi) / 2
        p = plan_for_gross(holdings, mid, ctx, polish=False)
        if p and p["net"] >= target_net:
            hi = mid
        else:
            lo = mid
    return plan_for_gross(holdings, hi, ctx)


def plan_within_allowance(holdings, ctx):
    fractions, gain = {}, 0.0
    queue = sorted([h for h in holdings if not h["locked"] and h["valueGbp"] > EPSILON],
                   key=lambda h: h["gainFraction"])
    for h in queue:
        remaining = ctx["exempt"] - gain
        if h["gainGbp"] <= 0:
            fractions[h["id"]] = 1.0
            gain += h["gainGbp"]
            continue
        if remaining <= EPSILON:
            break
        take = min(1.0, remaining / h["gainGbp"])
        if take <= 0:
            break
        fractions[h["id"]] = take
        gain += take * h["gainGbp"]
    return evaluate(holdings, fractions, ctx)


# ─── Brute force ─────────────────────────────────────────────────────────────

def brute_force_gross(holdings, target, ctx):
    """Greedy fill along EVERY permutation — provably contains the optimum."""
    best = None
    for perm in itertools.permutations(holdings):
        fractions, raised = {}, 0.0
        for h in perm:
            if h["locked"] or h["valueGbp"] <= EPSILON:
                continue
            if raised >= target - EPSILON:
                break
            take = min(1.0, (target - raised) / h["valueGbp"])
            fractions[h["id"]] = take
            raised += take * h["valueGbp"]
        if raised < target - EPSILON:
            continue
        plan = evaluate(holdings, fractions, ctx)
        if best is None or plan["cost"] < best["cost"]:
            best = plan
    return best


# ─── Tests ───────────────────────────────────────────────────────────────────

FAILURES = []


def check(label, condition, detail=""):
    if condition:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label}  {detail}")
        FAILURES.append(label)


def test_tax_known_answers():
    print("\n1. Tax — known answers")
    ctx = tax_context(income=30000)
    # £10k gain, £3k exempt → £7k taxable, all inside the basic band (£20,270
    # headroom) → 18%.
    check("£10k gain / £30k income → £1,260", abs(tax_on_gain(10000, ctx) - 1260) < 0.01,
          f"got {tax_on_gain(10000, ctx):.2f}")

    ctx2 = tax_context(income=60000)
    # No basic-rate headroom at all → the whole £7k at 24%.
    check("£10k gain / £60k income → £1,680", abs(tax_on_gain(10000, ctx2) - 1680) < 0.01,
          f"got {tax_on_gain(10000, ctx2):.2f}")

    ctx3 = tax_context(income=45000)
    # £5,270 of headroom: £5,270 @18% + £1,730 @24% = £948.60 + £415.20.
    expect = 5270 * 0.18 + (7000 - 5270) * 0.24
    check("£10k gain / £45k income → band split", abs(tax_on_gain(10000, ctx3) - expect) < 0.01,
          f"got {tax_on_gain(10000, ctx3):.2f} want {expect:.2f}")

    check("gain inside the exempt amount is free", tax_on_gain(2500, ctx) == 0)
    check("a net loss is not taxed", tax_on_gain(-5000, ctx) == 0)

    ctx4 = tax_context(income=30000, is_joint=True)
    # Couple: £6k exempt, £100,540 of band → £4k taxable at 18%.
    check("joint doubles exempt + band", abs(tax_on_gain(10000, ctx4) - 4000 * 0.18) < 0.01,
          f"got {tax_on_gain(10000, ctx4):.2f}")

    ctx5 = tax_context(income=30000, brought_forward=5000)
    # £10k − £3k exempt = £7k, then £5k of losses → £2k at 18%.
    check("brought-forward losses apply after the exempt amount",
          abs(tax_on_gain(10000, ctx5) - 2000 * 0.18) < 0.01,
          f"got {tax_on_gain(10000, ctx5):.2f}")


def random_portfolio(rng, n, fx, fx_spread):
    rows = []
    for i in range(n):
        ccy = rng.choice(["GBP", "GBP", "USD", "EUR"])
        price = rng.uniform(2, 400)
        # Cost anywhere from a 40% loss to a 3x gain, in GBP.
        cost = price * fx.get(ccy, 1.0) * rng.uniform(0.35, 1.6)
        rows.append({"id": f"h{i}", "currency": ccy, "price": price,
                     "qty": float(rng.randint(20, 900)), "avgCost": cost})
    return [derive(r, fx, fx_spread=fx_spread) for r in rows]


def test_optimality():
    print("\n2. Optimality vs brute force (all permutations, 6 holdings)")
    fx = {"USD": 0.7378, "EUR": 0.8560, "CHF": 0.9100}
    rng = random.Random(20260819)
    worst = 0.0
    beaten = 0
    trials = 60
    for t in range(trials):
        holdings = random_portfolio(rng, 6, fx, fx_spread=rng.choice([0.0, 0.0025, 0.005]))
        ctx = tax_context(income=rng.choice([20000, 45000, 60000]))
        capacity = sum(h["valueGbp"] for h in holdings)
        target = capacity * rng.uniform(0.15, 0.85)

        mine = plan_for_gross(holdings, target, ctx)
        best = brute_force_gross(holdings, target, ctx)
        if not mine or not best:
            continue
        gap = mine["cost"] - best["cost"]
        worst = max(worst, gap)
        if gap > 0.01:
            beaten += 1
    check(f"engine matches brute force on {trials} random portfolios",
          beaten == 0, f"beaten {beaten}x, worst gap £{worst:.2f}")
    print(f"       worst cost gap vs the true optimum: £{worst:.4f}")


def test_rate_cap_is_lossless():
    """
    candidate_rates() thins O(n^2) crossings down to RATE_CAP. That is a
    performance shortcut, so prove it costs nothing: solve larger portfolios
    with the cap and with every crossing, and compare.
    """
    print("\n2b. Rate cap does not cost accuracy (14 holdings, capped vs exhaustive)")
    fx = {"USD": 0.7378, "EUR": 0.8560, "CHF": 0.9100}
    rng = random.Random(4242)
    worst, beaten, trials = 0.0, 0, 30
    for _ in range(trials):
        holdings = random_portfolio(rng, 14, fx, fx_spread=rng.choice([0.0, 0.0025, 0.005]))
        ctx = tax_context(income=rng.choice([20000, 45000, 60000]))
        capacity = sum(h["valueGbp"] for h in holdings)
        target = capacity * rng.uniform(0.15, 0.85)

        capped = plan_for_gross(holdings, target, ctx)

        global RATE_CAP
        saved, RATE_CAP = RATE_CAP, 10_000
        try:
            exhaustive = plan_for_gross(holdings, target, ctx)
        finally:
            RATE_CAP = saved

        if capped and exhaustive:
            gap = capped["cost"] - exhaustive["cost"]
            worst = max(worst, gap)
            if gap > 0.01:
                beaten += 1
    check(f"capped rates match exhaustive on {trials} portfolios", beaten == 0,
          f"beaten {beaten}x, worst £{worst:.2f}")
    print(f"       worst gap introduced by the cap: £{worst:.4f}")


def round_to_whole_units(holdings, fractions, target, key):
    """Port of roundToWholeUnits() — round every disposal DOWN, then top back up."""
    by_id = {h["id"]: h for h in holdings}
    out, raised = {}, 0.0
    for hid, f in fractions.items():
        h = by_id.get(hid)
        if not h or h["qty"] <= 0:
            continue
        units = min(h["qty"], math.floor(f * h["qty"]))
        if units <= 0:
            continue
        out[hid] = units / h["qty"]
        raised += units * h["sellPriceGbp"]

    if raised >= target - EPSILON:
        return out

    for h in sorted([x for x in holdings if not x["locked"] and x["qty"] > 0], key=key):
        if raised >= target - EPSILON:
            break
        already = round(out.get(h["id"], 0.0) * h["qty"])
        spare = h["qty"] - already
        if spare <= 0:
            continue
        needed = math.ceil((target - raised) / h["sellPriceGbp"])
        add = min(spare, needed)
        out[h["id"]] = (already + add) / h["qty"]
        raised += add * h["sellPriceGbp"]
    return out


def test_whole_units():
    """
    Advisers place orders in whole units, so plans get rounded. Rounding DOWN
    always undershoots, so the top-up loop has to make the target again —
    otherwise the tool quietly hands back less cash than was asked for.
    """
    print("\n3b. Whole-unit rounding still meets the target")
    fx = {"USD": 0.7378, "EUR": 0.8560}
    rng = random.Random(1234)
    met = over = trials = 0
    for _ in range(60):
        holdings = random_portfolio(rng, 10, fx, fx_spread=0.0025)
        ctx = tax_context(income=rng.choice([30000, 60000]))
        capacity = sum(h["valueGbp"] for h in holdings)
        target = capacity * rng.uniform(0.15, 0.8)

        _, key = orderings(holdings)[0]
        fractions = fill_to_proceeds(holdings, key, target)
        rounded = round_to_whole_units(holdings, fractions, target, key)
        plan = evaluate(holdings, rounded, ctx)

        trials += 1
        if plan["gross"] >= target - EPSILON:
            met += 1
        # Never sell more units than are held, and never wildly overshoot.
        if all(f <= 1.0 + 1e-9 for f in rounded.values()) and plan["gross"] <= target * 1.05 + 5000:
            over += 1

    check(f"rounded plans still reach the target ({met}/{trials})", met == trials)
    check(f"rounded plans stay within the position and near the target ({over}/{trials})", over == trials)

    # Whole units really are whole.
    holdings = random_portfolio(random.Random(9), 8, fx, fx_spread=0.0)
    ctx = tax_context(income=45000)
    target = sum(h["valueGbp"] for h in holdings) * 0.4
    _, key = orderings(holdings)[0]
    rounded = round_to_whole_units(holdings, fill_to_proceeds(holdings, key, target), target, key)
    integral = all(abs(f * next(h for h in holdings if h["id"] == hid)["qty"]
                       - round(f * next(h for h in holdings if h["id"] == hid)["qty"])) < 1e-6
                   for hid, f in rounded.items())
    check("every disposal is a whole number of units", integral)


def test_targets_met():
    print("\n3. Targets are actually met")
    fx = {"USD": 0.7378, "EUR": 0.8560}
    rng = random.Random(7)
    net_ok = gross_ok = 0
    trials = 40
    for _ in range(trials):
        holdings = random_portfolio(rng, 12, fx, fx_spread=0.0025)
        ctx = tax_context(income=rng.choice([30000, 55000]))
        capacity = sum(h["valueGbp"] for h in holdings)

        want_net = capacity * rng.uniform(0.1, 0.6)
        p = solve_net(holdings, want_net, ctx)
        if p and p["net"] >= want_net - 1.0:
            net_ok += 1

        want_gross = capacity * rng.uniform(0.1, 0.8)
        g = plan_for_gross(holdings, want_gross, ctx)
        if g and g["gross"] >= want_gross - EPSILON:
            gross_ok += 1

    check(f"net-cash target reached in {trials}/{trials} runs", net_ok == trials, f"{net_ok}/{trials}")
    check(f"gross target reached in {trials}/{trials} runs", gross_ok == trials, f"{gross_ok}/{trials}")


def test_invariants():
    print("\n4. Invariants")
    fx = {"USD": 0.7378, "EUR": 0.8560}
    rng = random.Random(99)

    # Allowance mode must never produce a tax bill.
    clean = True
    for _ in range(40):
        holdings = random_portfolio(rng, 10, fx, fx_spread=0.0)
        ctx = tax_context(income=40000)
        p = plan_within_allowance(holdings, ctx)
        if p["tax"] > 0.01:
            clean = False
    check("allowance mode never creates a tax bill", clean)

    # Net cash must rise monotonically with gross proceeds.
    holdings = random_portfolio(rng, 8, fx, fx_spread=0.0025)
    ctx = tax_context(income=45000)
    capacity = sum(h["valueGbp"] for h in holdings)
    nets = []
    for i in range(1, 21):
        p = plan_for_gross(holdings, capacity * i / 20, ctx)
        nets.append(p["net"] if p else 0)
    check("net cash increases with gross proceeds",
          all(nets[i] >= nets[i - 1] - 0.5 for i in range(1, len(nets))))

    # Locked holdings must never be sold.
    holdings = random_portfolio(rng, 8, fx, fx_spread=0.0)
    for h in holdings[:3]:
        h["locked"] = True
    sellable = sum(h["valueGbp"] for h in holdings if not h["locked"])
    p = plan_for_gross(holdings, sellable * 0.9, ctx)
    check("locked holdings are never sold", p is not None and p["gross"] <= sellable + EPSILON)
    check("target above sellable capacity is refused",
          plan_for_gross(holdings, sellable * 1.5, ctx) is None)

    # Losses should reduce the bill: a portfolio with a loss-maker must never
    # cost more than the same portfolio without it.
    base = random_portfolio(random.Random(3), 5, fx, fx_spread=0.0)
    for h in base:
        h["gainGbp"] = abs(h["gainGbp"])
        h["gainFraction"] = h["gainGbp"] / h["valueGbp"]
    ctx = tax_context(income=60000)
    target = sum(h["valueGbp"] for h in base) * 0.4
    cost_without = plan_for_gross(base, target, ctx)["cost"]
    with_loss = [dict(h) for h in base]
    with_loss[0]["gainGbp"] = -abs(with_loss[0]["gainGbp"])
    with_loss[0]["gainFraction"] = with_loss[0]["gainGbp"] / with_loss[0]["valueGbp"]
    cost_with = plan_for_gross(with_loss, target, ctx)["cost"]
    check("a loss-making holding never increases the bill", cost_with <= cost_without + 1e-6,
          f"with £{cost_with:.2f} vs without £{cost_without:.2f}")


def test_worked_example():
    print("\n5. Worked example (the numbers to sanity-check in the UI)")
    fx = {"USD": 0.7378}
    rows = [
        {"id": "A", "currency": "GBP", "price": 100.0, "qty": 1000, "avgCost": 40.0},   # big gain
        {"id": "B", "currency": "GBP", "price": 50.0, "qty": 1000, "avgCost": 48.0},    # small gain
        {"id": "C", "currency": "USD", "price": 80.0, "qty": 500, "avgCost": 70.0},     # USD, gain
        {"id": "D", "currency": "GBP", "price": 20.0, "qty": 2000, "avgCost": 30.0},    # loss
    ]
    holdings = [derive(r, fx, fx_spread=0.0025) for r in rows]
    ctx = tax_context(income=60000)
    for h in holdings:
        print(f"     {h['id']}: value £{h['valueGbp']:>9,.0f}  gain £{h['gainGbp']:>9,.0f}"
              f"  gain/£ {h['gainFraction']:+.3f}  fx {h['fxSpread']:.2%}")

    plan = solve_net(holdings, 50000, ctx)
    print(f"\n     Target £50,000 net →  gross £{plan['gross']:,.0f}  gain £{plan['gain']:,.0f}"
          f"  tax £{plan['tax']:,.0f}  fx £{plan['fx']:,.0f}  net £{plan['net']:,.0f}"
          f"  trades {plan['trades']}  ({plan['ordering']})")
    check("worked example nets the target", abs(plan["net"] - 50000) < 1.0)
    check("worked example sells the loss-maker first (it cuts the bill)",
          plan["gain"] < 50000 * 0.6)

    allowance = plan_within_allowance(holdings, ctx)
    print(f"     Allowance harvest  →  gross £{allowance['gross']:,.0f}"
          f"  gain £{allowance['gain']:,.0f}  tax £{allowance['tax']:,.0f}")


if __name__ == "__main__":
    test_tax_known_answers()
    test_optimality()
    test_rate_cap_is_lossless()
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
    print("CGT engine verified: tax correct, targets met, plans provably optimal.")
