// ─────────────────────────────────────────────────────────────────────────────
// GSB ToolBox — Google Sheet backend (Apps Script)
//
// Reference / version-controlled copy of the script that lives INSIDE the
// published Google Sheet. The web app only READS the published CSV tabs; this
// script is what POPULATES them. Paste changes here into the Sheet's Apps Script
// editor (and vice-versa) so the two stay in sync.
//
// Jobs & triggers:
//   • RESET_HISTORY        — MANUAL override. Wipes + rebuilds both history
//                            sheets (daily 5y, weekly since-inception). Batched,
//                            so a big roster spans multiple runs and a timeout
//                            never leaves a half-empty sheet.
//   • UPDATE_HISTORY       — DAILY trigger (run every day). Tops up both sheets
//                            to the latest close and AUTO-BACKFILLS any ticker
//                            newly added to Stocks. Only ever appends/overwrites
//                            — a timeout just means "catch up tomorrow".
//   • UPDATE_PRICES_ONLY   — live price columns E–H on Stocks (unchanged).
//
// Weekly model: the current week's point is rewritten each daily run with the
// latest close; Saturday's run finalises it (Friday close) before Monday opens.
// Incremental weekly points are Monday-dated with the week's last close — which
// is exactly Yahoo's weekly candle — so RESET and daily top-ups line up.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  STOCKS_SHEET:            "Stocks",
  DAILY_HISTORY_SHEET:     "Daily_ History",
  WEEKLY_HISTORY_SHEET:    "Monthly_ History",  // kept to match existing sheet name

  TICKER_COLUMN:           3,   // 0-based index → Column D
  PRICE_WRITE_COLUMN:      5,   // 1-based       → Column E  (Price | Date | High | Low)
  LIVE_COLUMNS:            4,

  YAHOO_BASE:              "https://query1.finance.yahoo.com/v8/finance/chart/",
  HISTORY_INTERVAL_DAILY:  "1d",
  HISTORY_INTERVAL_WEEKLY: "1wk",
  HISTORY_RANGE:           "5y",   // legacy default (kept for any external callers)
  SNAPSHOT_RANGE:          "5d",   // 5d window lets us walk back past partial candles

  // History depths
  DAILY_RANGE:             "5y",   // daily history depth (reset + new-ticker backfill)
  WEEKLY_RANGE:            "max",  // weekly depth — since inception
  INCR_DAILY_RANGE:        "1mo",  // recent window pulled by the daily top-up

  // Batching / continuation (RESET only)
  RUN_BUDGET_MS:           270000, // ~4.5 min — hand off well before the 6-min cap
  CONTINUATION_DELAY_MS:   60000,  // resume ~1 min later
  RESET_STATE_KEY:         "HISTORY_RESET_STATE",

  FETCH_SLEEP_MS:          200,    // polite gap between requests
  MAX_RETRIES:             3,
  RETRY_BACKOFF_MS:        600,    // doubles each retry: 600 → 1200 → 2400 ms

  WRITE_CHUNK_SIZE:        10000,

  // Currency preference order for multi-listed ISINs
  CURRENCY_PRIORITY:       ["GBP", "USD", "EUR", "AUD"],
};

// ─────────────────────────────────────────────────────────────────────────────
// ISIN → YAHOO TICKER MAP  (built dynamically at runtime)
//
// Reads columns A–D of the Stocks sheet and groups every ticker variant under
// its ISIN key.  Multi-listed ISINs (same ISIN, different exchange/currency)
// all land in the same array; _resolveYahooTicker picks the best one at query
// time using CONFIG.CURRENCY_PRIORITY.
//
// The map is built ONCE per top-level function call and passed down — never
// rebuilt inside a per-ticker loop.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically builds the ISIN reference map from the Stocks sheet.
 * Columns expected: A: Name | B: Currency | C: ISIN | D: Ticker
 *
 * @returns {Object} map of ISIN → [{ ticker, currency }, …]
 */
function _buildDynamicIsinMap() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.STOCKS_SHEET);

  if (!sheet) {
    console.error(`_buildDynamicIsinMap: sheet '${CONFIG.STOCKS_SHEET}' not found.`);
    return {};
  }

  const data       = sheet.getDataRange().getValues();
  const dynamicMap = {};
  let   added      = 0;
  const excluded   = [];   // rows dropped from ISIN lookup (still priced/historised via ticker)

  for (let i = 1; i < data.length; i++) {
    const currency = data[i][1] ? data[i][1].toString().trim().toUpperCase() : "";
    const isin     = data[i][2] ? data[i][2].toString().trim().toUpperCase() : "";
    const ticker   = data[i][3] ? data[i][3].toString().trim()               : "";

    // Skip blanks, placeholder headers, N/A, and malformed (non-12-char) ISINs
    if (!isin || isin === "N/A" || isin === "[ISIN]" || isin.length !== 12) {
      // Only flag rows that actually have a ticker — empty rows aren't worth logging
      if (ticker && ticker !== "N/A" && ticker !== "[TICKER]") {
        excluded.push(`Row ${i + 1}: ${ticker} — bad ISIN '${isin}' (len ${isin.length})`);
      }
      continue;
    }
    if (!ticker || ticker === "N/A" || ticker === "[TICKER]") {
      excluded.push(`Row ${i + 1}: ISIN ${isin} — bad/empty ticker`);
      continue;
    }

    if (!dynamicMap[isin]) dynamicMap[isin] = [];

    // Deduplicate: same ISIN + same ticker already recorded → skip
    const alreadyPresent = dynamicMap[isin].some(e => e.ticker === ticker);
    if (alreadyPresent) continue;

    dynamicMap[isin].push({ ticker, currency: currency || "USD" });
    added++;
  }

  console.log(`_buildDynamicIsinMap: ${Object.keys(dynamicMap).length} unique ISINs, ${added} ticker entries loaded. ${excluded.length} excluded from ISIN lookup:`);
  excluded.forEach(e => console.log(`   – ${e}`));

  return dynamicMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT — LIVE PRICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refreshes live price columns (E–H) on the Stocks sheet only.
 * Intended for a daily / intraday trigger.
 */
function UPDATE_PRICES_ONLY() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = _getSheet(ss, CONFIG.STOCKS_SHEET);
  if (!sheet) return;

  const isinMap = _buildDynamicIsinMap();  // built once for the entire run
  const data    = sheet.getDataRange().getValues();
  const results = [];
  const failed  = [];
  const skipped = [];

  for (let i = 1; i < data.length; i++) {
    const raw = _parseTicker(data[i][CONFIG.TICKER_COLUMN]);

    if (!raw) {
      results.push(["", "", "", ""]);
      skipped.push(`Row ${i + 1}: empty`);
      continue;
    }

    const resolved = _resolveYahooTicker(raw, isinMap);

    if (!resolved.ok) {
      results.push(["Error", "", "", ""]);
      failed.push(`${raw}: ${resolved.error}`);
      continue;
    }

    const snap = _getYahooSnapshotExtended(resolved.ticker);

    if (!snap.ok) {
      results.push(["Error", "", "", ""]);
      failed.push(`${raw} (${resolved.ticker}): ${snap.error}`);
      continue;
    }

    results.push([snap.price, snap.date, snap.high, snap.low]);
    Utilities.sleep(CONFIG.FETCH_SLEEP_MS);
  }

  if (results.length > 0) {
    sheet
      .getRange(2, CONFIG.PRICE_WRITE_COLUMN, results.length, CONFIG.LIVE_COLUMNS)
      .setValues(results);
  }

  _logReport("LIVE PRICES", results.filter(r => r[0] !== "" && r[0] !== "Error").length, failed, skipped);
  _toastSummary("Live Prices", { failed, skipped, written: results.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY — MANUAL FULL RESET  (run by hand; no trigger)
//
// Wipes both history sheets and rebuilds them: daily = DAILY_RANGE, weekly =
// WEEKLY_RANGE ("max"). Batched via a time budget + a self-scheduling
// continuation trigger, so a large roster completes over several runs and a
// timeout never leaves the sheets half-cleared.
// ─────────────────────────────────────────────────────────────────────────────

function RESET_HISTORY() {                       // ← run manually (menu / editor)
  _clearResetContinuations();
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.RESET_STATE_KEY);
  _runReset();
}

/** One-off continuation entry — resumes an in-progress reset. */
function _CONTINUE_RESET_HISTORY() {
  _clearResetContinuations();
  _runReset();
}

function _runReset() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { console.warn("RESET_HISTORY already running — skipping."); return; }
  try {
    const t0     = Date.now();
    const props  = PropertiesService.getScriptProperties();
    const ss     = SpreadsheetApp.getActiveSpreadsheet();
    const source = _getSheet(ss, CONFIG.STOCKS_SHEET);
    const daily  = _getSheet(ss, CONFIG.DAILY_HISTORY_SHEET);
    const weekly = _getSheet(ss, CONFIG.WEEKLY_HISTORY_SHEET);
    if (!source || !daily || !weekly) { console.error("RESET_HISTORY: missing sheet."); return; }

    const isinMap = _buildDynamicIsinMap();
    const rows    = source.getDataRange().getValues();

    let s = JSON.parse(props.getProperty(CONFIG.RESET_STATE_KEY) || "null");
    if (!s) {                                       // fresh cycle — clear ONCE
      _clearHistory(daily);
      _clearHistory(weekly);
      s = { cursor: 1, dRow: 2, wRow: 2, failed: 0, skipped: 0 };
      console.log(`RESET_HISTORY: fresh rebuild of ${rows.length - 1} rows.`);
    } else {
      console.log(`RESET_HISTORY: resuming at ${s.cursor}/${rows.length - 1}.`);
    }

    for (; s.cursor < rows.length; s.cursor++) {
      if (Date.now() - t0 > CONFIG.RUN_BUDGET_MS) {                 // hand off before the cap
        props.setProperty(CONFIG.RESET_STATE_KEY, JSON.stringify(s));
        ScriptApp.newTrigger("_CONTINUE_RESET_HISTORY").timeBased().after(CONFIG.CONTINUATION_DELAY_MS).create();
        ss.toast(`Reset paused ${s.cursor - 1}/${rows.length - 1}; continuing in ~1 min…`, "Reset", 8);
        return;
      }

      const raw = _parseTicker(rows[s.cursor][CONFIG.TICKER_COLUMN]);
      if (!raw) { s.skipped++; continue; }
      const r = _resolveYahooTicker(raw, isinMap);
      if (!r.ok) { s.failed++; console.warn(`RESET FAIL ${raw}: ${r.error}`); continue; }

      const d = _fetchHistoryWithRetry(raw, r.ticker, CONFIG.HISTORY_INTERVAL_DAILY, CONFIG.DAILY_RANGE);
      if (d.ok && d.rows.length) { daily.getRange(s.dRow, 1, d.rows.length, 3).setValues(d.rows); s.dRow += d.rows.length; }
      else if (!d.ok) { s.failed++; console.warn(`RESET FAIL ${raw} daily: ${d.error}`); }
      Utilities.sleep(CONFIG.FETCH_SLEEP_MS);

      const w = _fetchHistoryWithRetry(raw, r.ticker, CONFIG.HISTORY_INTERVAL_WEEKLY, CONFIG.WEEKLY_RANGE);
      if (w.ok && w.rows.length) { weekly.getRange(s.wRow, 1, w.rows.length, 3).setValues(w.rows); s.wRow += w.rows.length; }
      else if (!w.ok) { s.failed++; console.warn(`RESET FAIL ${raw} weekly: ${w.error}`); }
      Utilities.sleep(CONFIG.FETCH_SLEEP_MS);
    }

    props.deleteProperty(CONFIG.RESET_STATE_KEY);
    _clearResetContinuations();
    ss.toast(`✅ Reset done. Daily ${s.dRow - 2}, Weekly ${s.wRow - 2}, Failed ${s.failed}, Skipped ${s.skipped}`, "Reset", 12);
    console.log(`RESET_HISTORY complete. Daily ${s.dRow - 2}, Weekly ${s.wRow - 2}, Failed ${s.failed}.`);
  } finally {
    lock.releaseLock();
  }
}

/** Deletes only the auto-continuation triggers — never the user's daily trigger. */
function _clearResetContinuations() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "_CONTINUE_RESET_HISTORY")
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY — DAILY TOP-UP  (trigger: every day, after close)
//
//   • Ticker with NO history (newly added to Stocks) → full backfill
//     (daily DAILY_RANGE + weekly WEEKLY_RANGE).
//   • Existing ticker → append genuinely-new daily point(s); rewrite the
//     current week's weekly point with the latest close (append on a new week).
//
// Only appends/overwrites — never clears — so a timeout is harmless (the run
// simply catches up the next day).
// ─────────────────────────────────────────────────────────────────────────────

function UPDATE_HISTORY() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { console.warn("UPDATE_HISTORY already running — skipping."); return; }
  try {
    const ss     = SpreadsheetApp.getActiveSpreadsheet();
    // Don't run while a RESET is mid-flight (it appends at saved row offsets that a
    // concurrent top-up would invalidate) — the reset schedules its own continuation.
    if (PropertiesService.getScriptProperties().getProperty(CONFIG.RESET_STATE_KEY)) {
      console.warn("UPDATE_HISTORY skipped — a RESET_HISTORY is in progress."); return;
    }

    const source = _getSheet(ss, CONFIG.STOCKS_SHEET);
    const daily  = _getSheet(ss, CONFIG.DAILY_HISTORY_SHEET);
    const weekly = _getSheet(ss, CONFIG.WEEKLY_HISTORY_SHEET);
    if (!source || !daily || !weekly) { console.error("UPDATE_HISTORY: missing sheet."); return; }

    const isinMap    = _buildDynamicIsinMap();
    const rows       = source.getDataRange().getValues();
    const dailyLast  = _lastDateMap(daily);      // ticker → latest stored ts
    const weeklyLast = _lastWeeklyMap(weekly);   // ticker → { ts, row }

    const addDaily  = [];   // rows to append to the daily sheet
    const addWeekly = [];   // rows to append to the weekly sheet
    const overwrite = [];   // current-week weekly rows to rewrite → { row, price }
    let dRow = daily.getLastRow()  + 1;
    let wRow = weekly.getLastRow() + 1;
    let added = 0, topped = 0, failed = 0;

    for (let i = 1; i < rows.length; i++) {
      const raw = _parseTicker(rows[i][CONFIG.TICKER_COLUMN]);
      if (!raw) continue;
      const key = raw.toUpperCase();   // case/whitespace-insensitive history key
      const r = _resolveYahooTicker(raw, isinMap);
      if (!r.ok) { failed++; console.warn(`UPDATE FAIL ${raw}: ${r.error}`); continue; }

      // ── NEW ticker → full backfill ─────────────────────────────────────────
      if (!dailyLast.has(key)) {
        const d = _fetchHistoryWithRetry(raw, r.ticker, CONFIG.HISTORY_INTERVAL_DAILY, CONFIG.DAILY_RANGE);
        if (d.ok && d.rows.length) addDaily.push(...d.rows);
        Utilities.sleep(CONFIG.FETCH_SLEEP_MS);
        const w = _fetchHistoryWithRetry(raw, r.ticker, CONFIG.HISTORY_INTERVAL_WEEKLY, CONFIG.WEEKLY_RANGE);
        if (w.ok && w.rows.length) addWeekly.push(...w.rows);
        Utilities.sleep(CONFIG.FETCH_SLEEP_MS);
        added++;
        continue;
      }

      // ── Existing ticker → incremental top-up (one recent daily fetch) ───────
      const d = _fetchHistoryWithRetry(raw, r.ticker, CONFIG.HISTORY_INTERVAL_DAILY, CONFIG.INCR_DAILY_RANGE);
      Utilities.sleep(CONFIG.FETCH_SLEEP_MS);
      if (!d.ok || !d.rows.length) { if (!d.ok) failed++; continue; }

      // Daily: append points newer than what's already stored.
      const lastTs = dailyLast.get(key);
      for (const row of d.rows) if (row[1].getTime() > lastTs) addDaily.push(row);

      // Weekly: rewrite the current week's point with the latest close.
      const latest  = d.rows[d.rows.length - 1];        // [ticker, Date, price]
      const wkStart = _weekStart(latest[1]);            // Monday of the latest date's week
      const wl      = weeklyLast.get(key);
      if (wl && _weekStart(new Date(wl.ts)).getTime() === wkStart.getTime()) {
        overwrite.push({ row: wl.row, price: latest[2] });   // same week → overwrite price
      } else {
        addWeekly.push([raw, wkStart, latest[2]]);           // new week → append
      }
      topped++;
    }

    // Apply writes (appends batched; current-week rewrites are scattered rows).
    if (addDaily.length)  daily.getRange(dRow, 1, addDaily.length, 3).setValues(addDaily);
    if (addWeekly.length) weekly.getRange(wRow, 1, addWeekly.length, 3).setValues(addWeekly);
    overwrite.forEach(o => weekly.getRange(o.row, 3).setValue(o.price));   // col C = price

    ss.toast(`✅ ${added} new · ${topped} topped-up · +${addDaily.length} daily rows · Failed ${failed}`, "History", 10);
    console.log(`UPDATE_HISTORY: ${added} backfilled, ${topped} topped-up, +${addDaily.length} daily / +${addWeekly.length} weekly rows, ${overwrite.length} rewrites, ${failed} failed.`);
  } finally {
    lock.releaseLock();
  }
}

/** ticker → latest stored timestamp (ms), scanned from a history sheet. */
function _lastDateMap(sheet) {
  const m = new Map();
  const last = sheet.getLastRow();
  if (last < 2) return m;
  const vals = sheet.getRange(2, 1, last - 1, 2).getValues();   // [ticker, Date]
  for (const [ticker, date] of vals) {
    if (!ticker || !(date instanceof Date)) continue;
    const k = ticker.toString().trim().toUpperCase();   // case/whitespace-insensitive
    const t = date.getTime();
    if (!m.has(k) || t > m.get(k)) m.set(k, t);
  }
  return m;
}

/** ticker → { ts, row } for its most-recent weekly point (row = sheet row). */
function _lastWeeklyMap(sheet) {
  const m = new Map();
  const last = sheet.getLastRow();
  if (last < 2) return m;
  const vals = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < vals.length; i++) {
    const ticker = vals[i][0], date = vals[i][1];
    if (!ticker || !(date instanceof Date)) continue;
    const k = ticker.toString().trim().toUpperCase();   // case/whitespace-insensitive
    const t = date.getTime();
    const cur = m.get(k);
    if (!cur || t > cur.ts) m.set(k, { ts: t, row: i + 2 });   // +2: skip header, 1-based
  }
  return m;
}

/** Monday 00:00 of the given date's week (local timezone). */
function _weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // Mon=0 … Sun=6
  return d;
}

/** Clears rows 2..last (cols A–C) of a history sheet. */
function _clearHistory(sheet) {
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, 3).clearContent();
}

// ─────────────────────────────────────────────────────────────────────────────
// YAHOO — HISTORY FETCH
// ─────────────────────────────────────────────────────────────────────────────

function _fetchHistoryWithRetry(originalTicker, yahooTicker, interval, range) {
  const url = `${CONFIG.YAHOO_BASE}${encodeURIComponent(yahooTicker)}?range=${range}&interval=${interval}`;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const status   = response.getResponseCode();

      if (status === 429 || status === 503) {
        const wait = CONFIG.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(`Rate-limited on ${yahooTicker} (attempt ${attempt}). Waiting ${wait}ms.`);
        Utilities.sleep(wait);
        continue;
      }

      if (status !== 200) return { ok: false, error: `HTTP ${status}` };

      const json = JSON.parse(response.getContentText());
      if (!json?.chart?.result?.[0]?.timestamp) {
        return { ok: false, error: "No timestamp data in response" };
      }

      // Store the original ticker (or ISIN) in the history sheet, not the resolved one
      return _parseHistoryResult(originalTicker, json.chart.result[0]);

    } catch (e) {
      if (attempt === CONFIG.MAX_RETRIES) return { ok: false, error: e.toString() };
      Utilities.sleep(CONFIG.RETRY_BACKOFF_MS * attempt);
    }
  }

  return { ok: false, error: "Max retries exceeded" };
}

function _parseHistoryResult(ticker, result) {
  const timestamps = result.timestamp;
  const indicators = result.indicators?.quote?.[0];
  const adjclose   = result.indicators?.adjclose?.[0]?.adjclose;  // total-return series
  const currency   = result.meta?.currency || "";

  if (!indicators?.close) return { ok: false, error: "Missing close prices" };

  // Prefer adjusted close (reinvested dividends → total return);
  // fall back to raw close if Yahoo didn't supply adjclose.
  const prices = (adjclose && adjclose.length === timestamps.length)
    ? adjclose
    : indicators.close;

  const rows = [];
  for (let j = 0; j < timestamps.length; j++) {
    const raw = prices[j];
    if (raw === null || raw === undefined || isNaN(raw)) continue;
    rows.push([ ticker, new Date(timestamps[j] * 1000), _normalisePence(raw, currency) ]);
  }
  if (rows.length === 0) return { ok: false, error: "All price entries were null" };
  return { ok: true, rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// YAHOO — LIVE SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the most recent *complete* daily candle.
 * Uses a 5-day window and walks backward from the last index,
 * skipping any partial candle where close/high/low is still null.
 */
function _getYahooSnapshot(yahooTicker) {
  const url = `${CONFIG.YAHOO_BASE}${encodeURIComponent(yahooTicker)}?range=${CONFIG.SNAPSHOT_RANGE}&interval=1d`;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const status   = response.getResponseCode();

      if (status === 429 || status === 503) {
        Utilities.sleep(CONFIG.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1));
        continue;
      }

      if (status !== 200) return { ok: false, error: `HTTP ${status}` };

      const json = JSON.parse(response.getContentText());
      if (!json?.chart?.result?.[0]) return { ok: false, error: "Empty chart result" };

      return _parseSnapshotResult(json.chart.result[0]);

    } catch (e) {
      if (attempt === CONFIG.MAX_RETRIES) return { ok: false, error: e.toString() };
      Utilities.sleep(CONFIG.RETRY_BACKOFF_MS * attempt);
    }
  }

  return { ok: false, error: "Max retries exceeded" };
}

function _parseSnapshotResult(result) {
  const currency   = result.meta?.currency || "";
  const indicators = result.indicators?.quote?.[0];

  if (!indicators?.close) return { ok: false, error: "No quote indicators" };

  const closes = indicators.close;
  const highs  = indicators.high;
  const lows   = indicators.low;
  const stamps = result.timestamp;

  // Walk back to the last candle where all three values are present
  let idx = closes.length - 1;
  while (idx >= 0) {
    if (
      closes[idx] != null && !isNaN(closes[idx]) &&
      highs[idx]  != null && !isNaN(highs[idx])  &&
      lows[idx]   != null && !isNaN(lows[idx])
    ) break;
    idx--;
  }

  if (idx < 0) return { ok: false, error: "No complete candle in 5-day window" };

  return {
    ok:    true,
    price: _normalisePence(closes[idx], currency),
    date:  new Date(stamps[idx] * 1000),
    high:  _normalisePence(highs[idx],  currency),
    low:   _normalisePence(lows[idx],   currency),
  };
}

function _getYahooSnapshotExtended(yahooTicker) {
  const is0P = /^0P[0-9A-Z]+(\.[A-Z]+)?$/i.test(yahooTicker);
  const range = is0P ? "1y" : "5d";

  const url = `${CONFIG.YAHOO_BASE}${encodeURIComponent(yahooTicker)}?range=${range}&interval=1d`;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const status   = response.getResponseCode();

      if (status === 429 || status === 503) {
        Utilities.sleep(CONFIG.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1));
        continue;
      }

      if (status !== 200) return { ok: false, error: `HTTP ${status}` };

      const json = JSON.parse(response.getContentText());
      if (!json?.chart?.result?.[0]) return { ok: false, error: "Empty chart result" };

      return is0P
        ? _parseSnapshotFrom1Y(json.chart.result[0])   // derive high/low from history
        : _parseSnapshotResult(json.chart.result[0]);  // existing 5d logic

    } catch (e) {
      if (attempt === CONFIG.MAX_RETRIES) return { ok: false, error: e.toString() };
      Utilities.sleep(CONFIG.RETRY_BACKOFF_MS * attempt);
    }
  }

  return { ok: false, error: "Max retries exceeded" };
}

/**
 * For 0P funds: derives today's price from the last complete candle,
 * and computes 52-week high/low from the full year of close prices.
 * Used because Yahoo's meta.fiftyTwoWeekHigh is unreliable for OEICs.
 */
function _parseSnapshotFrom1Y(result) {
  const currency   = result.meta?.currency || "";
  const indicators = result.indicators?.quote?.[0];

  if (!indicators?.close) return { ok: false, error: "No quote indicators" };

  const closes = indicators.close;
  const highs  = indicators.high;
  const lows   = indicators.low;
  const stamps  = result.timestamp;

  // Most recent complete candle — same walk-back logic as _parseSnapshotResult
  let idx = closes.length - 1;
  while (idx >= 0) {
    if (
      closes[idx] != null && !isNaN(closes[idx]) &&
      highs[idx]  != null && !isNaN(highs[idx])  &&
      lows[idx]   != null && !isNaN(lows[idx])
    ) break;
    idx--;
  }

  if (idx < 0) return { ok: false, error: "No complete candle in 1y window" };

  // Derive 52-week high and low from all valid close prices in the dataset
  const validCloses = closes.filter(p => p != null && !isNaN(p));

  if (validCloses.length === 0) return { ok: false, error: "No valid closes in 1y window" };

  const yearHigh = Math.max(...validCloses);
  const yearLow  = Math.min(...validCloses);

  return {
    ok:    true,
    price: _normalisePence(closes[idx], currency),
    date:  new Date(stamps[idx] * 1000),
    high:  _normalisePence(yearHigh, currency),  // 52-week high from closes
    low:   _normalisePence(yearLow,  currency),  // 52-week low from closes
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKER RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts any of:
 *   · A standard Yahoo ticker   → returned as-is
 *   · A Morningstar 0P... code  → returned as-is (Yahoo recognises these)
 *   · A 12-char ISIN            → looked up in isinMap (built from the sheet),
 *                                 resolved by currency priority (GBP > USD > EUR > AUD)
 *
 * @param  {string} raw      Raw value from the ticker column
 * @param  {Object} isinMap  Map built by _buildDynamicIsinMap()
 * @returns {{ ok: boolean, ticker?: string, error?: string }}
 */
function _resolveYahooTicker(raw, isinMap) {
  if (!raw) return { ok: false, error: "Empty ticker" };

  const value = raw.toString().trim();

  // Morningstar 0P codes — Yahoo Finance serves these directly
  if (/^0P[0-9A-Z]+(\.[A-Z]+)?$/i.test(value)) {
    return { ok: true, ticker: value };
  }

  // Not an ISIN — standard Yahoo ticker, pass straight through
  if (!_looksLikeIsin(value)) {
    return { ok: true, ticker: value };
  }

  // ISIN path — look up in the dynamically built map
  const entries = isinMap[value];

  if (!entries || entries.length === 0) {
    // Unknown ISIN — attempt country-based fallback before failing
    const fallback = _isinFallback(value);
    if (fallback) {
      console.warn(`Unknown ISIN ${value} — no entry in sheet lookup, using fallback: ${fallback}`);
      return { ok: true, ticker: fallback };
    }
    return {
      ok:    false,
      error: `ISIN ${value} not found in sheet lookup and no fallback available. Add a row for it in '${CONFIG.STOCKS_SHEET}'.`,
    };
  }

  if (entries.length === 1) {
    return { ok: true, ticker: entries[0].ticker };
  }

  // Multiple listings — pick by currency priority
  for (const preferred of CONFIG.CURRENCY_PRIORITY) {
    const match = entries.find(e => e.currency === preferred);
    if (match) {
      return { ok: true, ticker: match.ticker };
    }
  }

  // No priority currency matched — fall back to first entry
  console.warn(`ISIN ${value}: no currency priority match, using first entry: ${entries[0].ticker}`);
  return { ok: true, ticker: entries[0].ticker };
}

/**
 * Last-resort fallbacks for unknown ISINs:
 *   · GB ISINs  → try raw ISIN + ".L"
 *   · AU ISINs  → try raw ISIN + ".AX"
 *   · Others    → return null (will surface as a named error)
 */
function _isinFallback(isin) {
  if (isin.startsWith("GB")) return `${isin}.L`;
  if (isin.startsWith("AU")) return `${isin}.AX`;
  return null;
}

function _looksLikeIsin(value) {
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// GBX / GBp NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts UK pence prices (GBX / GBp) to pounds sterling.
 * All other currencies are returned rounded to 4 decimal places.
 * Handles null / undefined / NaN safely.
 */
function _normalisePence(value, currency) {
  if (value == null || isNaN(value)) return value;
  const v = parseFloat(value);
  if (currency === "GBX" || currency === "GBp") {
    return parseFloat((v / 100).toFixed(4));
  }
  return parseFloat(v.toFixed(4));
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a raw cell value into a usable ticker string.
 * Returns null for empty cells, placeholder headers, or non-strings.
 */
function _parseTicker(raw) {
  if (!raw) return null;
  const s = raw.toString().trim();
  if (s === "" || s === "[Ticker]" || s.toLowerCase() === "ticker") return null;
  return s;
}

function _getSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) console.error(`Sheet not found: "${name}"`);
  return sheet;
}

/**
 * Writes all rows to a sheet in chunks, starting at row 2.
 * (Retained utility — used by ad-hoc full rewrites.)
 */
function _writeChunked(sheet, rows) {
  if (!rows || rows.length === 0) return;
  let nextRow = 2;
  for (let s = 0; s < rows.length; s += CONFIG.WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(s, s + CONFIG.WRITE_CHUNK_SIZE);
    sheet.getRange(nextRow, 1, chunk.length, 3).setValues(chunk);
    nextRow += chunk.length;
  }
}

/**
 * Logs a structured run summary to the Apps Script console.
 */
function _logReport(label, writtenCount, failed, skipped) {
  const lines = [
    `\n════ ${label} REPORT ════`,
    `  ✔ Rows written : ${writtenCount}`,
    `  ✗ Failed       : ${failed.length}`,
    `  – Skipped      : ${skipped.length}`,
  ];
  if (failed.length > 0) {
    lines.push("\nFailed:");
    failed.forEach(f => lines.push(`  ✗ ${f}`));
  }
  if (skipped.length > 0) {
    lines.push("\nSkipped:");
    skipped.forEach(s => lines.push(`  – ${s}`));
  }
  lines.push("─".repeat(40));
  console.log(lines.join("\n"));
}

/**
 * Displays a brief toast in the Sheets UI on completion.
 */
function _toastSummary(title, ...runs) {
  const totals = runs.reduce(
    (acc, r) => ({
      failed:  acc.failed  + (r.failed?.length  ?? 0),
      skipped: acc.skipped + (r.skipped?.length ?? 0),
      written: acc.written + (r.written         ?? 0),
    }),
    { failed: 0, skipped: 0, written: 0 }
  );
  const icon = totals.failed > 0 ? "⚠️" : "✅";
  const msg  = `${icon}  Written: ${totals.written}  |  Failed: ${totals.failed}  |  Skipped: ${totals.skipped}`;
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title, 10);
}
