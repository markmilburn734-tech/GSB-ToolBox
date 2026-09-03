# ─────────────────────────────────────────────────────────────────────────────
# make_sample_portfolio.py — builds scripts/sample-portfolio.csv.
#
# Takes the real roster from Holdings.xlsx, joins today's prices off the live
# Stocks tab, and invents plausible quantities and average costs so there is a
# realistic file to drop into the CGT sell-down planner. Deterministic (fixed
# seed), so the sample doesn't churn between runs.
#
# It then runs the verified solver from verify_cgt.py over the result, which
# doubles as an end-to-end check that the import format and the engine agree.
#
#   python scripts/make_sample_portfolio.py
# ─────────────────────────────────────────────────────────────────────────────

import csv
import io
import pathlib
import random
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import verify_cgt as engine  # noqa: E402  (path set above)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "sample-portfolio.csv"

STOCKS_CSV = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_"
    "I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=0&single=true&output=csv"
)
FX_CSV = STOCKS_CSV.replace("gid=0", "gid=161616036")


def fetch_rows(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        text = r.read().decode("utf-8-sig")
    return [{(k or "").strip(): (v or "").strip() for k, v in row.items()}
            for row in csv.DictReader(io.StringIO(text))]


def main():
    stocks = fetch_rows(STOCKS_CSV)
    fx_rows = fetch_rows(FX_CSV)

    # Live FX → GBP, direct or inverted, exactly as resolveRate() does.
    pairs = {}
    for r in fx_rows:
        try:
            pairs[(r["Base Currency"], r["Target Currency"])] = float(r["Exchange Rate"])
        except (KeyError, ValueError):
            continue

    def to_gbp(ccy):
        if ccy == "GBP":
            return 1.0
        if (ccy, "GBP") in pairs:
            return pairs[(ccy, "GBP")]
        if ("GBP", ccy) in pairs:
            return 1.0 / pairs[("GBP", ccy)]
        return 1.0

    rng = random.Random(20260819)
    rows, holdings = [], []

    for i, s in enumerate(stocks):
        name, ccy = s.get("Name", ""), (s.get("Currency") or "GBP").upper()
        try:
            price = float(s.get("Price") or "")
        except ValueError:
            continue
        if not name or price <= 0:
            continue
        if len(rows) >= 18:                       # a believable client portfolio
            break

        # Position size around £15k-£90k, rounded to whole units.
        target_value = rng.uniform(15000, 90000)
        qty = max(1, round(target_value / (price * to_gbp(ccy))))
        # Cost anywhere from a 35% loss to a 2.2x gain, expressed in GBP.
        avg_cost_gbp = round(price * to_gbp(ccy) * rng.uniform(0.45, 1.35), 4)

        rows.append([name, ccy, round(price, 4), qty, avg_cost_gbp,
                     s.get("ISIN", ""), s.get("Ticker", "")])
        holdings.append(engine.derive(
            {"id": f"s{i}", "currency": ccy, "price": price, "qty": float(qty),
             "avgCost": avg_cost_gbp},
            {c: to_gbp(c) for c in ("USD", "EUR", "CHF", "AUD", "CAD", "HKD", "DKK")},
            fx_spread=0.0025,
        ))

    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Name", "Currency", "Price", "Qty", "Avg Price", "ISIN", "Ticker"])
        w.writerows(rows)
    print(f"wrote {OUT.relative_to(ROOT)} — {len(rows)} holdings")

    # ── End-to-end: run the verified solver over the sample ─────────────────
    total = sum(h["valueGbp"] for h in holdings)
    gain = sum(h["gainGbp"] for h in holdings)
    print(f"\nPortfolio: {engine_money(total)} value, {engine_money(gain)} unrealised gain")

    ctx = engine.tax_context(income=60000)
    for label, target in (("£100,000 net cash", 100000), ("£250,000 net cash", 250000)):
        plan = engine.solve_net(holdings, target, ctx)
        print(f"\n  {label}")
        print(f"    gross {engine_money(plan['gross'])} · gain {engine_money(plan['gain'])}"
              f" · CGT {engine_money(plan['tax'])} · FX {engine_money(plan['fx'])}"
              f" · net {engine_money(plan['net'])} · {plan['trades']} trades")

    harvest = engine.plan_within_allowance(holdings, ctx)
    print(f"\n  Allowance harvest")
    print(f"    gross {engine_money(harvest['gross'])} · gain {engine_money(harvest['gain'])}"
          f" · CGT {engine_money(harvest['tax'])} · {harvest['trades']} trades")


def engine_money(v):
    return f"£{v:,.0f}"


if __name__ == "__main__":
    main()
