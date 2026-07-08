---
name: portfolio-tracker-location
description: Where the standalone Dimensional USD portfolio-tracker.html lives and how it works
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d659cab-6fdc-4a00-b8e4-35638a197972
---

The standalone units→value portfolio tracker lives at `Web App/Alberto Portfolio/portfolio-tracker.html` (NOT in GSB-ToolBox — a duplicate there was removed on 2026-07-07). Work on it there going forward.

It is a single self-contained HTML file (no build step) that pulls the SAME live Google Sheets feed as GSB-ToolBox (Stocks gid=0 + Daily history gid=689728688). Tracks four Dimensional USD funds by ISIN/ticker: Global Core Equity IE00B2PC0153/0P0000J29S, World Equity IE00B3V7VL84/0P0000VA0A, Global Small Companies IE00B3MRDK01/0P0000TH0L, Global Value IE00B687H819/0P0000VA0N.

Behavior: downloads full price history up front on open (inputs disabled + "Downloading price history…" until ready); the ONLY user input is number of units per fund (persisted in localStorage key `gsb_tracker_units`); charts total portfolio value = Σ(units×price) over time, plotted only where all held funds have data. Timeframe buttons are a view control, kept deliberately.

Must be served over http:// (e.g. `python -m http.server`) — opening via file:// can hit CORS on the feed fetch.
