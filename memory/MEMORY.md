# Project Memory

- **START HERE:** `../DEVELOPMENT.md` (repo root) — full architecture, data pipeline, every feature, the analytics/IHT/charges engines, key decisions & caveats. Read before changing anything.

- [Local build env](local-build-env.md) — no Node/npm on this machine; verify via Python sims or Firebase CI
- [Sheet-driven presets](sheet-driven-presets.md) — portfolios come from the Google Sheet, no hard-coded fallback (deliberate)
- [DO NOT EDIT folder](do-not-edit-folder.md) — the folder name is intentional, not a real restriction
- [Sheet data quirks](sheet-data-quirks.md) — weekly "5Y" tab, empty dates, header drift, ticker typos
- [Portfolio tracker location](portfolio-tracker-location.md) — standalone units→value tracker lives in `Alberto Portfolio/`, not GSB-ToolBox
- [Completable documents](completable-documents.md) — the Documents tab: 4 compliance PDFs filled via pdf-lib, scoring decisions, field-mapping traps
