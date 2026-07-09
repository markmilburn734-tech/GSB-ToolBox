# GSB ToolBox — Development & Handoff Notes

A single-page React app of financial-adviser tools for GSB. Data is driven live from a
published Google Sheet workbook. This doc is the context a future dev (human or model)
needs before changing anything. Read it fully first.

---

## 1. Stack & environment

- **React 18 + Vite**, Tailwind CSS, Recharts, PapaParse, lucide-react. No TypeScript.
- **Hosting:** Firebase App Hosting (`apphosting.yaml` runs `npm run start` → serves `dist`). The build happens in CI, not locally.
- **Folder name is "DO NOT EDIT"** — this is the owner's personal "toys" naming, NOT a real restriction. Edit freely.
- ⚠️ **No Node/npm on the dev machine.** You cannot run `npm run build`/`dev` here. **Verify logic with Python + curl instead** — the data tabs are public CSVs, so you can replicate any calculation against the live data in Python. After changes, ask the user to run `npm run dev` for the visual check.
- Python 3 and `curl` ARE available. Windows console is cp1252 — avoid non-ASCII in Python `print` (use `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`).

### Editing gotcha
Many files have **trailing spaces on blank lines** (App.jsx, api.js, RebalancerView, IHT view). The `Edit` tool matches exactly, so a multi-line `old_string` spanning a blank line often fails. Fix: anchor on contiguous non-blank lines, or split into smaller edits.

---

## 2. Data backend — the Google Sheet

One published workbook, base URL in `src/constants.js` → `GOOGLE_SHEETS_CSV_URLS`. Tabs by gid:

| gid | Tab | Shape | Parsed by (`api.js`) |
|---|---|---|---|
| 0 | **Stocks** | Name,Currency,ISIN,Ticker,Price,Date,52W H/L,% Off High,Region,Class,TER/OCR,Volatility | `processStocks` → `pricesData` (keyed by ticker) |
| 689728688 | **Daily_1Y** | Ticker,Date,Price (dates `M/D/YYYY`) | `processHistory` |
| 755116259 | **"Monthly_5Y"** | Ticker,Date,Price — **actually WEEKLY** (~260 pts/5y) | `processHistory` |
| 161616036 | **Currencies** | Base Currency,Target Currency,Exchange Rate | `processCurrencies` → `liveRates` |
| 1724094727 | **Portfolios** | Strategy,Currency,AllocationTier,Asset Name,ISIN,Ticker,TargetWeight (wide-ish; % or plain) | `processPortfolios` → `presets` |
| 1211950497 | **Charges** | Bank,Asset Type,Currency,Charge Minimum,(Tier,Percent)×5 | `processCharges` → `charges` |

- `fetchPortfolioData(onComplete)` fetches all 6 in parallel via `Promise.allSettled`, so one failing tab never blocks the UI; returns `{ newPrices, historyMap, liveRates, presets, charges, errors }`.
- `parseSheetPromise` uses `transformHeader: h => h.trim()` (some headers have trailing spaces, e.g. `Region `, and the whole Charges tab).
- **Historic prices are TOTAL RETURN** (the owner's Apps Script fetches Yahoo `adjclose`, not `close`) — so distributing funds include income. Do NOT re-apply fund TER anywhere.
- **History shape:** `processHistory` returns `{ [ticker]: { Daily_1Y|Monthly_5Y: { dates:number[], prices:number[] } } }` (epoch-ms parallel arrays, chronological). This replaced the old `"p;p;p"` string so analytics can align by real date.

### Key sheet quirks (see also memory `sheet-data-quirks.md`)
- "Monthly_5Y" is **weekly** → Analytics `TIMEFRAMES['5y']` = cadence weekly, 260 pts, periodsPerYear 52.
- `0P…` Morningstar fund series lag the exchange ETFs by ~1 day / fewer points → handled by **date-based** alignment.
- Some Yahoo tickers have a **denomination glitch** (e.g. SMEA.L jumps ×100 in Nov-2023) → `stitchDiscontinuities` repairs it.
- Portfolios cash rows use **synthetic `Cash`** (ISIN/Ticker = "Cash"); real money-market funds keep their tickers.
- A few Portfolios ticker typos exist (`0P000TH0M.F` etc.) — data issue, not code.

---

## 3. `constants.js` — shared logic (not just constants)

- `resolveRate(base, target, liveRates)` — live FX with **inverse fallback** (`1/rate`) then static fallback. The sheet only stores one direction; the inverse is derived. CHF is present (needed by PB charges).
- `isCash(value)` — true when ticker/ISIN === "CASH".
- **Private bank charges:** `PB_CHARGES` (fallback schedule), `mapBankClass(ourClass, availableClasses)` (keyword-maps our Class → the bank's fee category), `computeTransactionFee(value, ccy, bankClass, bank, liveRates, schedule)` → `{ fee, rate, minFee, appliedMin }`. Trade value → CHF (live) picks the tier; charges `max(value×rate, CHF-min×live)`.
- **IHT:** `IHT` consts, `residenceNilRateBand(estate, joint, claim)` (£2m taper, threshold NOT doubled for couples), `estimateIHT(estate, {joint, claimRNRB})`, `giftTaperMultiplier(yearsAgo)`.
- `CURRENCY_SYMBOLS`, `INITIAL_PRESETS` (dormant — presets are sheet-only, no fallback by owner's choice).

---

## 4. Navigation (`App.jsx`)

Two-level grouped nav. Primary tabs → sub-tabs; each group remembers its last sub-tab:
- **Rebalancer**: Standard (`rebalancer`) · Private Bank (`pbrebalancer`)
- **Analytics**: Analytics (`analytics`) · Portfolios (`portfolios`) · Pulse (`market`)
- **Calculators**: CGT (`tax`) · IHT (`IHT`) · Cash Planner (`cashcal`, tab label "Cash Planner")

- **All views stay mounted once visited** (each in a `hidden` div when inactive), so every tab's inputs persist across tab switches — **in-memory only; a full refresh clears everything** (no localStorage, by request). Driven by a `visited` map in `App.jsx`.
- **Code-split:** each view is `React.lazy(() => import(...))` inside its own per-view `<Suspense>`, so only the visited tab's chunk downloads (initial load = Rebalancer only). Per-view Suspense (not one global) prevents a first-visit load from unmounting already-mounted tabs.
- Global **currency selector** (top-right `<select>` dropdown) drives investment tabs. **CGT & IHT are GBP-locked** (UK statutory) — App passes them `gbpMarketData` + `currency="GBP"`.

### Design system (theme in `tailwind.config.js`)
- **Brand:** `brand`/`brand2` `#573960` (purple), `brand3–5` `#ff3154` (accent), `brand6` `#816a88`, `brand-tint` `#f4f1f5` (light wash). `shadow-brand` = soft purple shadow.
- **Fonts — two families only:** `font-sans` = **IBM Plex Sans** for *all* text (headings share the body font, differing by weight/size — the serif page-title experiment was removed for consistency). `font-mono` = **Consolas** (native) for *all* figures/codes/ISINs — chosen for its **plain zero** (Cascadia Code and IBM Plex Mono both render a dotted/slashed 0, which the owner disliked). Only IBM Plex Sans is web-loaded (`index.html`); Consolas is native. Don't reintroduce a mono with a dotted zero.
- **Squared corners:** the `borderRadius` scale is overridden small (2xl ≈ 6px, 3xl ≈ 8px) so all cards read crisp; `rounded-full` (pills/avatars) unaffected. Sharpen further by lowering these values.
- **Header:** dark-purple (`#2e1c34`) sticky nav with the brand-gradient accent line along its bottom edge; the sub-tab bar below is **white**. Wordmark white, GSB mark in pink (`brand3`, no tile). Currency is a **custom branded dropdown** — transparent trigger with a **white border** + white text; the menu is **light purple** (`bg-brand-tint`, items highlight `brand6` on active/hover). Not a native `<select>`.
- **GSB watermark:** a fixed, **centred**, low-opacity (`0.11`) very-dark-purple (`#1f1226`) `<GSB>` logo with a drop-shadow sits behind content (`App.jsx`, `z-0`); `main` is `z-10`. `Icon`/`GSB` take a `strokeWidth` prop (watermark uses `0.7`). Centred behind the `max-w-7xl` column, so it's mostly visible in the side gutters.
- **Tabs (text-only, no icons):** primary tabs (`TabButton`) = white text + **pink** (`brand3`) active underline on the dark banner; **active sub-tab is "attached" to the banner** — full-height dark-purple (`#2e1c34`) block with `rounded-b-lg` and pink text, flush to the top of the white sub-bar so it reads as a tab hanging off the banner (the banner accent line was removed so they connect). Inactive sub-tabs grey.
- **Translucent glass everywhere:** every card/box/panel is `bg-white/75 backdrop-blur-sm` so the centred watermark shows through (≈58 surfaces). **Form controls stay solid** (`bg-white`, distinguished by `outline-none`) — never frost a typing/selecting area. Data-table cards additionally carry a **dark-purple outline** (`border-brand`). Print paths carry `print:bg-white`. (Sweep is `bg-white ` → `bg-white/75 backdrop-blur-sm ` — keep the trailing space or classes merge.)
- ⚠️ **`backdrop-blur` gotcha:** it creates a **stacking context** AND makes descendant `position:fixed` resolve to that box (not the viewport). So a card with `backdrop-blur` that contains a **dropdown menu** traps the menu behind later sibling cards and breaks the full-screen click-outside overlay. Fix applied: the two rebalancer **toolbars use `bg-white/75` WITHOUT blur**, and their Add menus are solid `bg-white`. Don't add `backdrop-blur` to any card containing a popover/menu.

### Rebalancers — trade gating & Add menu
- **No trades until target weights total 100%** (both rebalancers): the directives memo returns `[]` and the trades panel is hidden below 100%; an amber hint shows the running total. PB also unlocks when the **Equity/Bond ratio optimiser** is on (it drives its own targets). Standard uses `weightsBalanced = |Σtarget − 100| < 0.01`.
- Standard **"Add Asset"** menu is now **searchable** (name/ticker/ISIN text box → `addPoolHits`), matching the PB add menu.
- **Unified boxless view headers:** every view leads with the same pattern — `text-2xl font-bold text-gray-900 tracking-tight` title + `text-sm text-gray-500` subtitle, **on the page background (no white card)**. Analytics and the PB toolbar were un-boxed (title pulled out above the controls); old icon tiles all removed. Add a title in this style to any new view.

---

## 5. Features (file → what it does → key logic)

### RebalancerView.jsx (Standard)
Multi-asset rebalancer in one display currency. Prices via `getLivePrice` (ISIN match, live FX). **Cash valued at par 1** (`isCash`). Loading a preset **merges** (keeps entered units by ISIN, zeros dropped holdings). Shows Current % + drift vs target.
- One shared `directives` memo feeds the on-screen cards, CSV and print so they can't diverge.
- **CSV columns:** `Fund Name, ISIN, Ticker, BUY/SELL, Units, Amount (<ccy>)` — ticker is reverse-looked-up from `pricesData` by ISIN.
- **Print** opens a clean trades-only receipt window (not `window.print()` on the page).
- **Rounding modes:** Fractional · Whole · **Margin** (ported from PB: buys round down, sells up, price-banded step >100→1 / 50–100→2 / <50→5).

### PrivateBankRebalancerView.jsx (Private Bank)
The most feature-rich. Built on `computeTransactionFee`.
- **Multi-currency holdings** (native + base value side by side); base currency selector.
- **Models as expandable wrappers**: add a whole preset; it carries one overall % of the portfolio, constituents show within-model weight → effective % (`overall × weight/100`). Searchable add menu (models + individual assets).
- **Bank selector** (from `charges` keys); per-holding fee category (auto-mapped, overridable).
- **Charges per trade**; **cash (`Cash`) is charge-free**, real MMFs are charged.
- **Loans** (Lombard): liability and/or drawable (adds investable capital).
- **Rounding:** `Margin` mode — buys round DOWN, sells UP; step by price band (>£100→1, £50–100→2, <£50→5). `Exact` mode = fractional.
- Directives show **Before / Charge / After** in base currency + total cost.
- **Print trades** (opens a clean receipt window → print/PDF) + **CSV export**. CSV columns: `Fund Name, ISIN, Ticker, BUY/SELL, Units, Model, Currency, Trade (native), Price Before Charges (base), Charges (base), Amount After (base)` — native trade + base Before/Charge/After.
- **Model 100% badge:** each model header shows its constituent-weight sum (green ✓ at 100%, amber ✗ otherwise). Target inputs accept 2 dp (`step=0.01`).
- **Equity/Bond ratio optimiser** (toggle in its own card): set overall equity% (bond = 100−eq) + a drift%. Rebalances to that split with fewest/cheapest trades — deploys free cash first, trades pure equity/bond lines most-under/over-weight first (up to model weight ± drift), holds **locked** lines and **mixed funds** fixed. Per-row **lock** toggle (skips the line from all trading) and **Eq/Bd/Csh/Auto** bucket override (shown when ratio mode on).
  - Classification: `classifyEB(cls, vol, bucket)` → `[eqFrac, bdFrac]`. Bond Funds→(0,1); Equity Funds & Equities/ETFs→(1,0); Money Market & synthetic Cash→(0,0); generic **"Funds"** tiered by risk (`VOL_TIER`): Low 20/80 · Below Avg 40/60 · Avg 60/40 · Above Avg 80/20 · High 100/0 (confirmed against the fund names). Override via the bucket selector (e.g. *Vanguard Total World Stock* is Avg-vol but 100% equity).
  - The `opt` memo returns per-leaf target % (fed into the existing directive engine as an effTarget override) + projected split + uninvested-cash %. **Trade math verified in Python** against live data: hits target, conserves cash, cash-first, respects locks. (Re-verify by replicating `opt`/`classifyEB` against the live Stocks CSV — the standing no-Node workflow.)

### PerformanceAnalyticsView.jsx + PerformanceLogic.js
See §6 — the analytics engine, the most-iterated part.

### PortfoliosView.jsx
Read-only model browser: pick Strategy/Currency/Profile → holdings, live prices (converted), blended TER, allocation-by-class and by-region bars. Cash valued at par.

### MarketPulseView.jsx
Asset explorer: search/filter (class/region)/sort; detail panel with TER, vol, class, region, 52-wk pulse, and **multi-timeframe returns** (3M/6M/YTD/1Y) computed from history.

### TaxCalculatorView.jsx (CGT)
UK CGT estimator, GBP-locked. 2024/25 rates (18/24%), £3k allowance, joint doubling, market buffer.
- **Unused basic-rate band = `max(0, basicRateLimit − GROSS income)`** (limit £50,270 is a gross threshold). Earlier it subtracted *taxable* income, double-counting the personal allowance and over-granting the 18% band (a £60k earner wrongly blended to ~22.3% instead of the correct 24%). Verified in Python.
- ⚠️ Rates/bands are a local `TAX_CONSTANTS` in the component, **not** in `constants.js` — annual updates need editing here (candidate to centralise).

### IHTCalculatorView.jsx
See §7.

### CashCalView.jsx
Multi-asset cash-flow / longevity planner: editable assets (category quick-add), assumptions (age/inflation/spending), **drag-and-drop Events timeline** (Retirement, State Pension, Inheritance, Lump Expense, Forecast End — HTML5 DnD, desktop only), stacked-bar projection with drawdown. **Estate & IHT card**: `estimateIHT` on the projected estate + **life cover** (term policies lapse if the term ends before the forecast age; in-trust offsets, non-trust adds to estate).

---

## 6. The Analytics engine (PerformanceLogic.js) — read before touching

This has been rewritten several times to fix correctness. Current model:

1. **Return-weighted, not price-weighted.** Each holding is rebased to its own price at the window start *before* applying weight (`weightᵢ × priceᵢ/baseᵢ`). The old price-weighted sum let a £600 S&P holding dominate a £1 cash holding and inverted 30/70 → 70/30. **Do not revert to summing `price × weight`.**
2. **Total return.** History is `adjclose` (income included). **No fund TER drag** — the price is already net of the fund's own charge; re-applying it double-counts.
3. **Date-anchored windows.** `processHistory` carries real dates; `chartData` builds a shared date axis (union of holdings' dates in the window), forward-fills via `priceAsOf`, anchors each timeframe to a real start (`windowStartMs`; YTD → 1 Jan). Fixes ~0.9pp mixed-portfolio alignment error + gives real x-axis dates.
4. **`stitchDiscontinuities`** repairs ×N denomination glitches so a bad early value can't blow the base-100 index to +14,000%.
5. **Cost adjustments (advice fees).** `costs = {advisor, platform, trustee}` (% p.a.); `totalDrag` is applied as a compounding time-based drag in `computeNetIndex(inputs, axis, startMs, dragPct)`. These are legit ADDITIONAL costs (not in fund price), unlike fund TER.
6. **Chart x-key is the unique timestamp `t`**, not the label. Long timeframes repeat "MMM YY" labels; using the label as the category **broke drag-to-cross-slice on 1Y/3Y/5Y**. XAxis `dataKey="t"` with a `tickFormatter`; all drag lookups match on `d.t`. The display label is still `name` (used by the tooltip). **Don't switch the x-axis back to `name`.**
7. Y-axis shows **% return** (`(v-100)%`) via tickFormatter; the data is still the base-100 index. Drag shows a **live badge** + purple band.

**Known data artifact (not a code bug):** the *Dimensional Core · Risk Averse (10/90)* series shows a ~3% single-step drop each **late November** (e.g. 2025-11-28, also 2024-11-27). Traced to the distributing Morningstar share class **`0P0000VA1M.F`** (Global Short Fixed Income) going ex-distribution without a full total-return adjustment — the sister `.L` class only moves ~1.6% on the same date. Fix is data-side (point the model at the accumulating class in the sheet) or a code-side distribution/outlier smoother; `stitchDiscontinuities` ignores it because it's below the ×N glitch threshold.

Verification pattern: replicate the exact JS in Python against the live daily CSV. Reference numbers that have been validated: CSPX YTD ≈ +7.5% (≈ Yahoo), Dim Core 60/40 5Y ≈ +36%, SMEA 3Y ≈ +33% (post-stitch).

---

## 7. The IHT engine (IHTCalculatorView.jsx) — validated model

Snapshot ("if death now"). Order and rules:
- **Bands:** NRB 325k; RNRB 175k with **£2m taper** (−£1 per £2 over; threshold is per-estate, NOT doubled for couples). Married toggle adds **transferable** NRB/RNRB by % (default 100).
- **Assets:** status Subject/Business Relief/**Pension**/Exempt. Pension is exempt unless the **"pensions in estate (Apr 2027)"** toggle is on.
- **Gifts (PETs <7y):** net of a per-gift exemption; oldest-first consume NRB; **taper relief on the tax** (3–7y: 20/40/60/80%); 7y+ falls out.
- **Charity:** legacy is exempt; if ≥10% of the baseline, estate rate drops to **36%**.
- **Life assurance:** in-trust pays outside the estate (offsets IHT); non-trust adds to the estate.
Validated in Python: £2.5m single → RNRB £0, £870k; £500k gift @4y → £42k; charity £60k on £1m → 36% → £158.4k; £2.7m married → RNRB fully lost, £820k.

Possible future refinements (not built): precise charity component/grossing-up, indexed future bands, downsizing addition, GWR, annual-exemption automation.

---

## 8. Conventions & caveats

- **Presets are sheet-only** (owner's choice) — no fallback to `INITIAL_PRESETS`; empty pickers if the tab fails.
- **Charges** have a hardcoded `PB_CHARGES` fallback (money calc, so a safety net is kept).
- **Simplifications flagged in-UI:** CashCal is deterministic (single avg return, no sequence risk/tax); IHT charity 10% baseline is simplified; trustee fee in Analytics is portfolio-wide, not pension-only.
- **In-session persistence only** — no localStorage.
- Date/`crypto.randomUUID()` are fine in browser event handlers; only Workflow *scripts* forbid `Date.now()`.

## 9. Memory
Project memory lives in `memory/` (loaded each session via `MEMORY.md`): `local-build-env`, `sheet-driven-presets`, `sheet-data-quirks`, `do-not-edit-folder`. Keep them in sync with this doc.
