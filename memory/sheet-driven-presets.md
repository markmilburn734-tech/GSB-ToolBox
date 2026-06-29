---
name: sheet-driven-presets
description: Portfolio presets load from the Google Sheet Portfolios tab; no hard-coded fallback by deliberate choice
metadata:
  type: project
---

Portfolio presets are sourced from the Google Sheet "Portfolios" tab (gid=1724094727), parsed by `processPortfolios` in `src/api.js` into `{ strategy: { currency: { profile: [holdings] } } }`, stored in App state, and passed to RebalancerView and PerformanceAnalyticsView.

**Why:** the user chose "Sheet only" — if the tab fails to load, the preset pickers are intentionally empty. Do NOT add a fallback to `INITIAL_PRESETS` thinking it's a bug. `INITIAL_PRESETS` is kept in `src/constants.js` only as dormant reference, unused.

Sheet column quirks: the holding-name column header is literally "Cash GBP" (not "Name"); `TargetWeight` is mixed format ("99" and "89.50%"). The `AllocationTier` column is the profile/risk name. The Analytics default selection seeds from the first available preset on load (no hard-coded profile name). See [[local-build-env]] for how to validate the parser.
