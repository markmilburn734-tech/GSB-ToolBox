---
name: sheet-data-quirks
description: Non-obvious quirks in the Google Sheet data tabs that affect Analytics/parsing
metadata:
  type: project
---

Quirks in the published Google Sheet (URLs/gids in `src/constants.js`), found 2026-06-29:

- **"Monthly_5Y" tab (gid 755116259) is actually WEEKLY data** (~260 pts/5y, dates step 7 days), NOT monthly. Analytics `TIMEFRAMES['5y']` is configured cadence `weekly`, points 260, periodsPerYear 52 to match. If it's ever switched to true monthly, revert to 60 / 12.
- The weekly tab's Date column was ~92% empty earlier; after a script re-run it is now **100% dated** (both daily and weekly).
- **Analytics is now DATE-ANCHORED** (since 2026-06-30): `processHistory` returns `{dates, prices}` parallel arrays; `PerformanceLogic` builds a shared date axis (union of holdings' dates within the window), forward-fills via `priceAsOf`, anchors each timeframe to a real start date (`windowStartMs`; YTD → 1 Jan), and applies a time-based TER drag. This replaced the old position-based alignment, fixing the ~0.9pp mixed-portfolio error (e.g. `0P…` funds lag exchange ETFs by ~1 day / fewer points) and giving real x-axis dates. The `points` field in `TIMEFRAMES` is now unused (kept for reference).
- **Yahoo denomination glitches**: some LSE tickers (e.g. SMEA.L) have a ×100 jump in Yahoo history (re-denomination). `stitchDiscontinuities` in `PerformanceLogic` rescales the earlier segment so it can't blow up the base-100 index (was showing +14,590%).
- **Portfolios tab (gid 1724094727)** column headers drift: the holding-name column has been "Cash GBP" and "Asset Name"; `TargetWeight` mixes "99" and "89.50%". Parser handles both via `col()` candidates + `%` strip. See [[sheet-driven-presets]].
- Known ticker typos in the Portfolios sheet (won't plot in Analytics): `0P000TH0M.F` (→`0P0000TH0M.F`), `0P000VA0P.F` (→`0P0000VA0P.F`), `GB00B83HGR24.L` (→`0P0000WGSZ.L`).
- Stocks tab (gid 0) has `Region ` (trailing space) and `Class` columns — now captured into `pricesData` as `region`/`assetClass` for the Portfolios detail tab.
