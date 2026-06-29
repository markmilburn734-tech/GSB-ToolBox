---
name: sheet-data-quirks
description: Non-obvious quirks in the Google Sheet data tabs that affect Analytics/parsing
metadata:
  type: project
---

Quirks in the published Google Sheet (URLs/gids in `src/constants.js`), found 2026-06-29:

- **"Monthly_5Y" tab (gid 755116259) is actually WEEKLY data** (~260 pts/5y, dates step 7 days), NOT monthly. Analytics `TIMEFRAMES['5y']` is configured cadence `weekly`, points 260, periodsPerYear 52 to match. If it's ever switched to true monthly, revert to 60 / 12.
- That weekly tab's **Date column is ~92% empty**; `processHistory` survives only because the date sort fails and leaves rows in CSV order. Weekly series therefore can't be date-aligned — positional only.
- **Daily tab (gid 689728688)**: `0P…` Morningstar fund series have ~1,225 pts ending one day earlier than the exchange ETFs (~1,260 pts). Mixed portfolios (e.g. Passive Value) get ~0.9pp error from positional (not date) alignment. Proper fix needs consistent dates/lengths in the sheet, or carrying dates through `processHistory` to date-align.
- **Portfolios tab (gid 1724094727)** column headers drift: the holding-name column has been "Cash GBP" and "Asset Name"; `TargetWeight` mixes "99" and "89.50%". Parser handles both via `col()` candidates + `%` strip. See [[sheet-driven-presets]].
- Known ticker typos in the Portfolios sheet (won't plot in Analytics): `0P000TH0M.F` (→`0P0000TH0M.F`), `0P000VA0P.F` (→`0P0000VA0P.F`), `GB00B83HGR24.L` (→`0P0000WGSZ.L`).
- Stocks tab (gid 0) has `Region ` (trailing space) and `Class` columns — now captured into `pricesData` as `region`/`assetClass` for the Portfolios detail tab.
