# ─────────────────────────────────────────────────────────────────────────────
# verify_market_pulse.py — reproduces the Market Pulse boards against live data.
#
# Mirrors MarketPulseView.jsx: the same stitching, the same window anchoring,
# the same "Mixed is not a sector" exclusion and the same equal-weighted
# grouping. Prints what the UI should render, so the numbers on screen can be
# checked without a browser (there is no Node on this machine).
#
#   python scripts/verify_market_pulse.py [3m|6m|ytd|1y]
# ─────────────────────────────────────────────────────────────────────────────

import csv
import datetime as dt
import io
import statistics
import sys
import urllib.request
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_"
        "I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub")
STOCKS = f"{BASE}?gid=0&single=true&output=csv"
DAILY = f"{BASE}?gid=689728688&single=true&output=csv"

# Mirrors NON_SECTORS in MarketPulseView.jsx.
NON_SECTORS = {"mixed", "unclassified", "n/a", ""}


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read().decode("utf-8-sig")


def rows(text):
    return [{(k or "").strip(): (v or "").strip() for k, v in r.items()}
            for r in csv.DictReader(io.StringIO(text))]


def stitch(prices, threshold=3.0):
    """Port of stitchDiscontinuities() — repairs Yahoo re-denominations."""
    out = list(prices)
    for i in range(len(out) - 1, 0, -1):
        prev, cur = out[i - 1], out[i]
        if prev > 0 and cur > 0:
            ratio = cur / prev
            if ratio > threshold or ratio < 1 / threshold:
                for j in range(i):
                    if out[j] > 0:
                        out[j] *= ratio
    return out


def window_start(end, key):
    if key == "ytd":
        return dt.date(end.year, 1, 1)
    if key == "3m":
        return subtract_months(end, 3)
    if key == "6m":
        return subtract_months(end, 6)
    return dt.date(end.year - 1, end.month, min(end.day, 28))


def subtract_months(d, months):
    month = d.month - months
    year = d.year
    while month <= 0:
        month += 12
        year -= 1
    return dt.date(year, month, min(d.day, 28))


def return_from(dates, prices, key):
    if len(dates) < 2:
        return None
    start = window_start(dates[-1], key)
    base = None
    for d, p in zip(dates, prices):
        if d <= start:
            base = p
        else:
            break
    if base is None:
        base = next((p for p in prices if p > 0), None)
    last = prices[-1]
    if not base or base <= 0 or last <= 0:
        return None
    return (last / base - 1) * 100


def group_performance(items, field, ):
    buckets = defaultdict(list)
    for it in items:
        buckets[it[field] or "Unclassified"].append(it)
    out = []
    for group, members in buckets.items():
        vals = sorted(m["v"] for m in members)
        best = max(members, key=lambda m: m["v"])
        worst = min(members, key=lambda m: m["v"])
        out.append({
            "group": group, "n": len(vals),
            "mean": statistics.mean(vals), "median": statistics.median(vals),
            "best": best, "worst": worst,
        })
    return sorted(out, key=lambda r: -r["mean"])


def main():
    key = sys.argv[1] if len(sys.argv) > 1 else "ytd"
    print(f"Timeframe: {key.upper()}\n")

    stocks = rows(fetch(STOCKS))
    history = defaultdict(list)
    for r in csv.DictReader(io.StringIO(fetch(DAILY))):
        t = (r.get("Ticker") or "").strip().upper()
        try:
            m, d, y = (r.get("Date") or "").split("/")
            history[t].append((dt.date(int(y), int(m), int(d)), float(r["Price"])))
        except (ValueError, KeyError):
            continue
    for t in history:
        history[t].sort()

    items = []
    for s in stocks:
        t = (s.get("Ticker") or "").strip().upper()
        series = history.get(t)
        if not t or not series:
            continue
        dates = [d for d, _ in series]
        prices = stitch([p for _, p in series])
        v = return_from(dates, prices, key)
        if v is None:
            continue
        items.append({
            "ticker": t, "name": s.get("Name", ""), "v": v,
            "currency": s.get("Currency", ""),
            "sector": s.get("Sector", "") or "Unclassified",
            "region": s.get("Region", "") or "Global",
        })

    print(f"{len(items)} assets priced with history "
          f"(currencies: {dict(Counter(i['currency'] for i in items))})\n")

    ranked = sorted(items, key=lambda i: -i["v"])
    print("── Movers ticker: top 10 winners ──")
    for i in ranked[:10]:
        print(f"   {i['v']:+7.1f}%  {i['ticker']:<12} {i['name'][:40]:<40} {i['currency']}")
    print("── Movers ticker: top 10 losers ──")
    for i in list(reversed(ranked[-10:])):
        print(f"   {i['v']:+7.1f}%  {i['ticker']:<12} {i['name'][:40]:<40} {i['currency']}")

    sector_items = [i for i in items if i["sector"].lower() not in NON_SECTORS]
    excluded = len(items) - len(sector_items)
    print(f"\n── Sector board ({len(sector_items)} single-company holdings; "
          f"{excluded} funds/ETFs excluded) ──")
    for r in group_performance(sector_items, "sector"):
        flag = "  <- n<3" if r["n"] < 3 else ""
        print(f"   {r['group']:<18} n={r['n']:>3}  mean {r['mean']:+7.2f}%  "
              f"median {r['median']:+7.2f}%  best {r['best']['ticker']} {r['best']['v']:+.1f}%{flag}")

    print(f"\n── Country / region board ({len(items)} assets) ──")
    for r in group_performance(items, "region"):
        flag = "  <- n<3" if r["n"] < 3 else ""
        print(f"   {r['group']:<18} n={r['n']:>3}  mean {r['mean']:+7.2f}%  "
              f"median {r['median']:+7.2f}%  best {r['best']['ticker']} {r['best']['v']:+.1f}%{flag}")

    # Currency filter sanity: every currency should yield a usable board.
    print("\n── Per-currency asset counts (the new filter) ──")
    for ccy, n in sorted(Counter(i["currency"] for i in items).items(), key=lambda kv: -kv[1]):
        secs = len({i["sector"] for i in items
                    if i["currency"] == ccy and i["sector"].lower() not in NON_SECTORS})
        regs = len({i["region"] for i in items if i["currency"] == ccy})
        print(f"   {ccy:<5} {n:>3} assets · {secs} sectors · {regs} regions")


if __name__ == "__main__":
    main()
