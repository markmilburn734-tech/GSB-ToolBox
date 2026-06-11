//─────────────────────────────────────────────────────────────────────────────
// api.js
//
// Orchestration engine: fetches four Google Sheets CSV tabs in parallel,
// parses and cross-references them, and delivers a single structured payload
// to the caller via `onComplete`.
//
// KEY CHANGES vs. original:
//   1. Uses Promise.allSettled so a single failing sheet never stalls the UI.
//   2. Never mutates EXCHANGE_RATES in constants.js — live rates are returned
//      as `liveRates` and stored in App-level React state.
//   3. Ticker normalisation is centralised in `normaliseTicker` so hidden
//      characters, BOM bytes, and mixed-case variants are stripped uniformly.
//   4. Every CSV column read uses the `col()` helper to handle case-insensitive
//      header variants and safely returns `undefined` instead of throwing.
// ─────────────────────────────────────────────────────────────────────────────
 
import Papa from 'papaparse';
import { GOOGLE_SHEETS_CSV_URLS } from './constants';
 
// ─── Helpers ─────────────────────────────────────────────────────────────────
 
/**
 * Strips leading/trailing whitespace AND invisible control characters (BOM,
 * zero-width spaces, non-breaking spaces) that Google Sheets occasionally
 * injects into CSV exports.
 * @param {unknown} raw
 * @returns {string}
 */
function sanitise(raw) {
    if (raw == null) return '';
    // \p{C} matches all Unicode control/format characters; requires the `u` flag
    return String(raw).trim().replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\u200B\u00A0]/gu, '');
}
 
/**
 * Normalises a ticker key: upper-case, sanitised, rejects placeholder values.
 * @param {unknown} raw
 * @returns {string|null}  null if the value is empty or a known non-ticker sentinel
 */
function normaliseTicker(raw) {
    const s = sanitise(raw).toUpperCase();
    if (!s || s === 'N/A' || s === 'TICKER' || s === 'TICKER CODE') return null;
    return s;
}
 
/**
 * Reads a value from a CSV row using multiple possible column-name variants
 * (handles inconsistent header capitalisation across sheet exports).
 * Returns undefined if none of the candidate keys exist on the row.
 * @param {Record<string,unknown>} row
 * @param {...string} keys
 * @returns {unknown}
 */
function col(row, ...keys) {
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(row, k) && row[k] != null) {
            return row[k];
        }
    }
    return undefined;
}
 
/**
 * Wraps PapaParse's download-and-parse into a Promise.
 * Resolves with the parsed row array; rejects on network/parse error.
 * @param {string} url
 * @returns {Promise<Record<string,unknown>[]>}
 */
function parseSheetPromise(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download:      true,
            header:        true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: ({ data }) => resolve(data),
            error:    (err)      => reject(err),
        });
    });
}
 
// ─── Sheet Processors ────────────────────────────────────────────────────────
 
/**
 * Builds the PricesData map from the Stocks sheet.
 * @param {Record<string,unknown>[]} rows
 * @returns {import('./constants').PricesData}
 */
function processStocks(rows) {
    /** @type {import('./constants').PricesData} */
    const prices = {};
 
    rows.forEach((row) => {
        const tickerRaw = col(row, 'Ticker', 'ticker', 'Ticker Code');
        const ticker = normaliseTicker(tickerRaw);
        if (!ticker) return;
 
        const priceRaw = col(row, 'Price', 'price');
        const price = parseFloat(String(priceRaw ?? ''));
        if (isNaN(price)) return;
 
        prices[ticker] = {
            price,
            isin:       sanitise(col(row, 'ISIN', 'isin')).toUpperCase() || 'N/A',
            name:       sanitise(col(row, 'Name', 'name'))                || 'Unknown Asset',
            currency:   sanitise(col(row, 'Currency', 'currency')).toUpperCase() || 'USD',
            ytd:        parseFloat(String(col(row, '% Off High', '% off high') ?? '0')) || 0,
            ter:        parseFloat(String(col(row, 'TER/OCR', 'ter')           ?? '0')) || 0,
            volatility: sanitise(col(row, 'Volatility Index', 'volatility'))   || 'Average',
            high_52:    parseFloat(String(col(row, '52W High', '52w high', 'High_52') ?? '0')) || 0,
            low_52:     parseFloat(String(col(row, '52W Low',  '52w low',  'Low_52')  ?? '0')) || 0,
            pct_off_high: parseFloat(String(col(row, '% Off High', '% off high') ?? '0')) || 0,
            date:       sanitise(col(row, 'Date', 'date', 'Last Updated')) || '',
        };
    });
 
    return prices;
}
 
/**
 * Groups and sorts history rows by ticker, then serialises prices as
 * a semicolon-delimited string (preserves existing consumer contract).
 * @param {Record<string,unknown>[]} rows
 * @param {string} historyKey  - e.g. 'Daily_1Y' or 'Monthly_5Y'
 * @returns {{ [ticker: string]: { [historyKey: string]: string } }}
 */
function processHistory(rows, historyKey) {
    /** @type {{ [ticker: string]: Array<{ date: Date; price: number }> }} */
    const grouped = {};
 
    rows.forEach((row) => {
        const ticker = normaliseTicker(col(row, 'Ticker', 'ticker', 'Ticker Code'));
        if (!ticker) return;
 
        const priceRaw = col(row, 'Price', 'price');
        const price = parseFloat(String(priceRaw ?? ''));
        if (isNaN(price)) return;
 
        const dateRaw = sanitise(col(row, 'Date', 'date', 'Timestamp'));
        const date = new Date(dateRaw);
 
        if (!grouped[ticker]) grouped[ticker] = [];
        grouped[ticker].push({ date, price });
    });
 
    /** @type {{ [ticker: string]: { [key: string]: string } }} */
    const result = {};
 
    Object.entries(grouped).forEach(([ticker, entries]) => {
        entries.sort((a, b) => a.date - b.date);
        result[ticker] = {
            [historyKey]: entries.map((e) => e.price).join(';'),
        };
    });
 
    return result;
}
 
/**
 * Parses live exchange rates from the Currencies sheet.
 * Returns a NEW object — never mutates constants.
 * @param {Record<string,unknown>[]} rows
 * @returns {import('./constants').ExchangeRateMap}
 */
function processCurrencies(rows) {
    /** @type {import('./constants').ExchangeRateMap} */
    const liveRates = {};
 
    rows.forEach((row) => {
        const base   = sanitise(col(row, 'Base Currency', 'base currency', 'Base')).toUpperCase();
        const target = sanitise(col(row, 'Target Currency', 'target currency', 'Target')).toUpperCase();
        const rate   = parseFloat(String(col(row, 'Exchange Rate', 'exchange rate', 'Rate') ?? ''));
 
        if (!base || !target || isNaN(rate)) return;
 
        if (!liveRates[base]) liveRates[base] = {};
        liveRates[base][target] = rate;
    });
 
    return liveRates;
}
 
// ─── Public API ───────────────────────────────────────────────────────────────
 
/**
 * Fetches and parses all four data sheets in parallel.
 *
 * Uses `Promise.allSettled` so that a single failing sheet does NOT block
 * the UI — partial data is always delivered to `onComplete`.
 *
 * @param {function({
 *   newPrices:   import('./constants').PricesData,
 *   historyMap:  import('./constants').HistoryMap,
 *   liveRates:   import('./constants').ExchangeRateMap,
 *   errors:      string[],
 * }): void} onComplete
 */
export function fetchPortfolioData(onComplete) {
    const urls = [
        GOOGLE_SHEETS_CSV_URLS.STOCKS,
        GOOGLE_SHEETS_CSV_URLS.DAILY_HIST,
        GOOGLE_SHEETS_CSV_URLS.MONTHLY_HIST,
        GOOGLE_SHEETS_CSV_URLS.CURRENCIES,
    ];
 
    Promise.allSettled(urls.map((url) => parseSheetPromise(url))).then(
        ([stocksResult, dailyResult, monthlyResult, currenciesResult]) => {
            /** @type {string[]} */
            const errors = [];
 
            // ── Stocks ───────────────────────────────────────────────────────
            let newPrices = {};
            if (stocksResult.status === 'fulfilled') {
                newPrices = processStocks(stocksResult.value);
                if (stocksResult.value?.[0]) {
                    console.log('[GSB] Stocks headers:', Object.keys(stocksResult.value[0]));
                }
            } else {
                const msg = `Stocks sheet failed: ${stocksResult.reason}`;
                console.error('[GSB]', msg);
                errors.push(msg);
            }
 
            // ── Daily History ────────────────────────────────────────────────
            let dailyMap = {};
            if (dailyResult.status === 'fulfilled') {
                dailyMap = processHistory(dailyResult.value, 'Daily_1Y');
                if (dailyResult.value?.[0]) {
                    console.log('[GSB] Daily History headers:', Object.keys(dailyResult.value[0]));
                }
            } else {
                const msg = `Daily History sheet failed: ${dailyResult.reason}`;
                console.error('[GSB]', msg);
                errors.push(msg);
            }
 
            // ── Monthly History ───────────────────────────────────────────────
            let monthlyMap = {};
            if (monthlyResult.status === 'fulfilled') {
                monthlyMap = processHistory(monthlyResult.value, 'Monthly_5Y');
            } else {
                const msg = `Monthly History sheet failed: ${monthlyResult.reason}`;
                console.error('[GSB]', msg);
                errors.push(msg);
            }
 
            // ── Merge history maps ────────────────────────────────────────────
            /** @type {import('./constants').HistoryMap} */
            const historyMap = {};
            const allTickers = new Set([
                ...Object.keys(dailyMap),
                ...Object.keys(monthlyMap),
            ]);
            allTickers.forEach((ticker) => {
                historyMap[ticker] = {
                    ...(dailyMap[ticker]   ?? {}),
                    ...(monthlyMap[ticker] ?? {}),
                };
            });
 
            // ── Currencies ────────────────────────────────────────────────────
            let liveRates = {};
            if (currenciesResult.status === 'fulfilled') {
                liveRates = processCurrencies(currenciesResult.value);
            } else {
                const msg = `Currencies sheet failed: ${currenciesResult.reason}`;
                console.warn('[GSB]', msg, '— will use static fallback rates.');
                errors.push(msg);
            }
 
            console.log(
                '[GSB] Completed. Tickers with history:',
                Object.keys(historyMap).length,
                '| Errors:',
                errors.length,
            );
 
            // onComplete is ALWAYS called, even on total failure, so the UI
            // can exit its loading state.
            onComplete({ newPrices, historyMap, liveRates, errors });
        },
    );
}
 