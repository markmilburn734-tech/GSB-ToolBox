
// ─────────────────────────────────────────────────────────────────────────────
// constants.js
//
// RULE: This file is READ-ONLY configuration. Nothing at runtime should mutate
// these objects. Exchange rates fetched from the remote Currencies sheet are
// stored in App-level state (via the api.js return value), not merged back here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── TypeScript-style JSDoc interfaces (usable as @type hints in plain JS) ───
/**
 * @typedef {Object} PresetAllocation
 * @property {string}  name    - Human-readable fund name
 * @property {string}  isin    - ISIN code
 * @property {string}  [ticker]- Optional ticker symbol (omitted on ISIN-only presets)
 * @property {number}  target  - Target allocation percentage (0–100)
 */

/**
 * @typedef {{ [profileName: string]: PresetAllocation[] }} CurrencyProfiles
 * @typedef {{ [currency: string]: CurrencyProfiles }}       PresetGroup
 * @typedef {{ [groupName: string]: PresetGroup }}           InitialPresets
 */

/**
 * @typedef {Object} AssetPrice
 * @property {number} price
 * @property {string} isin
 * @property {string} name
 * @property {string} currency
 * @property {number} ytd         - % off 52-week high
 * @property {number} ter         - Total Expense Ratio / OCR
 * @property {string} volatility  - e.g. "Low" | "Average" | "High"
 * @property {number} high_52
 * @property {number} low_52
 * @property {number} pct_off_high
 * @property {string} date
 */

/**
 * @typedef {{ [ticker: string]: AssetPrice }} PricesData
 * @typedef {{ Daily_1Y?: string; Monthly_5Y?: string }} TickerHistory
 * @typedef {{ [ticker: string]: TickerHistory }} HistoryMap
 */

/**
 * @typedef {Object} ExchangeRateMap
 * @description  Nested map: rates[BASE][TARGET] = multiplier
 * @type {{ [baseCurrency: string]: { [targetCurrency: string]: number } }}
 */

// ─── 1. Portfolio Presets ─────────────────────────────────────────────────────
/** @type {InitialPresets} */
export const INITIAL_PRESETS = {
    "World Allocation": {
        "GBP": {
            "Risk Averse (20/80)": [
                { name: "Dimensional World Allocation 20/80 Fund", isin: "IE00BYTYTV40", ticker: "0P00016L34.L", target: 99 },
                { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
            ],
            "Cautious (40/60)": [
                { name: "Dimensional World Allocation 40/60 Fund", isin: "IE00B56FVB15", ticker: "0P0000UUVM.L", target: 99 },
                { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
            ],
            "Balanced (60/40)": [
                { name: "Dimensional World Allocation 60/40 Fund", isin: "IE00B416SD35", ticker: "0P0000UUVK.L", target: 99 },
                { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
            ],
            "Growth (80/20)": [
                { name: "Dimensional World Allocation 80/20 Fund", isin: "IE00BYTYV184", ticker: "0P00016L3A.L", target: 99 },
                { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
            ],
            "Adventurous (100/0)": [
                { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 99 },
                { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
            ]
        },
        "USD": {
            "Risk Averse (20/80)": [
                { name: "Dimensional World Allocation 20/80 Fund", isin: "IE00BYTYTZ87", ticker: "0P00016L38", target: 99 },
                { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
            ],
            "Cautious (40/60)": [
                { name: "Dimensional World Allocation 40/60 Fund", isin: "IE00BFZ0X665", ticker: "0P0001CWE0", target: 99 },
                { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
            ],
            "Balanced (60/40)": [
                { name: "Dimensional World Allocation 60/40 Fund", isin: "IE00BFZ0X772", ticker: "0P0001CWDZ", target: 99 },
                { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
            ],
            "Growth (80/20)": [
                { name: "Dimensional World Allocation 80/20 Fund", isin: "IE00BYTYV523", ticker: "0P00016L3E", target: 99 },
                { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
            ],
            "Adventurous (100/0)": [
                { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 99 },
                { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
            ]
        },
        "EUR": {
            "Risk Averse (20/80)": [
                { name: "Dimensional World Allocation 20/80 Fund", isin: "IE00BYTYTX63", ticker: "0P00016L36.F", target: 99 },
                { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
            ],
            "Cautious (40/60)": [
                { name: "Dimensional World Allocation 40/60 Fund", isin: "IE00B8Y02V60", ticker: "0P0000YN21.F", target: 99 },
                { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
            ],
            "Balanced (60/40)": [
                { name: "Dimensional World Allocation 60/40 Fund", isin: "IE00B9L4YR86", ticker: "0P0000YN1Z.F", target: 99 },
                { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
            ],
            "Growth (80/20)": [
                { name: "Dimensional World Allocation 80/20 Fund", isin: "IE00BYTYV309", ticker: "0P00016L3C.F", target: 99 },
                { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
            ],
            "Adventurous (100/0)": [
                { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 99 },
                { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
            ]
        }
    },
        "Dimensional Core": {
    "GBP": {
        "Risk Averse (10/90)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 89.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 9.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Defensive (20/80)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 79.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 19.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Cautious (30/70)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 69.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 29.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Conservative (40/60)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 59.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 39.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Conservative Balanced (50/50)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 49.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 49.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Balanced (60/40)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 39.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 59.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Growth (70/30)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 29.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 69.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Ambitious (80/20)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 19.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 79.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Speculative (90/10)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B05PYX08", ticker: "0P0000VA1Q.L", target: 9.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 89.5 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ],
        "Adventurous (100/0)": [
            { name: "Dimensional World Equity Fund", isin: "IE00B3Z8MM50", ticker: "0P0000UUVI.L", target: 99 },
            { name: "BlackRock ICS Sterling Liquidity", isin: "IE0004806687", ticker: "0P000024Y9.L", target: 1 }
        ]
    },

    "USD": {
        "Risk Averse (10/90)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 89.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 9.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Defensive (20/80)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 79.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 19.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Cautious (30/70)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 69.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 29.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Conservative (40/60)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 59.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 39.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Conservative Balanced (50/50)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 49.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 49.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Balanced (60/40)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 39.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 59.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Growth (70/30)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 29.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 69.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Ambitious (80/20)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 19.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 79.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Speculative (90/10)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3S6T365", ticker: "0P0000VA1P", target: 9.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 89.5 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ],
        "Adventurous (100/0)": [
            { name: "Dimensional World Equity Fund", isin: "IE00B3V7VL84", ticker: "0P0000VA0A", target: 99 },
            { name: "BlackRock ICS US Dollar Liquidity", isin: "IE0004809582", ticker: "0P0000258M", target: 1 }
        ]
    },

    "EUR": {
        "Risk Averse (10/90)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 89.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 9.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Defensive (20/80)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 79.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 19.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Cautious (30/70)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 69.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 29.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Conservative (40/60)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 59.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 39.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Conservative Balanced (50/50)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 49.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 49.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Balanced (60/40)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 39.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 59.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Growth (70/30)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 29.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 69.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Ambitious (80/20)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 19.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 79.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Speculative (90/10)": [
            { name: "Dimensional Global Short Fixed Income", isin: "IE00B3QL0Y14", ticker: "0P0000VA1M.F", target: 9.5 },
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 89.5 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ],
        "Adventurous (100/0)": [
            { name: "Dimensional World Equity Fund", isin: "IE00B4MJ5D07", ticker: "0P0000V9WM.F", target: 99 },
            { name: "BlackRock ICS Euro Liquidity", isin: "IE000BAFXJO9", ticker: "0P0001Q06D.F", target: 1 }
        ]
    },
},
    "Passive Value": {
    "GBP": {
  "20/80": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 40.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 39.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 11.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 2.50 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 2.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 34.50 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 34.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 17.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 4.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 3.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 30.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 29.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 22.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 5.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 4.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 25.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 24.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 28.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 6.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 5.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 20.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 19.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 34.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 7.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 6.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 15.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 14.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 40.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 8.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 7.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 10.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 9.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 45.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 9.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 8.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 5.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024Y9.L", "target": 4.75 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 50.75 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 10.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 9.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 56.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 11.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 10.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
    "USD": {
  "20/80": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 40.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 39.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 11.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 2.50 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 2.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 34.50 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 34.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 17.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 4.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 3.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 30.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 29.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 22.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 5.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 4.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 25.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 24.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 28.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 6.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 5.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 20.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 19.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 34.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 7.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 6.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 15.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 14.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 40.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 8.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 7.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 10.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 9.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 45.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 9.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 8.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 5.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258M", "target": 4.75 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 50.75 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 10.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 9.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 56.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 11.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 10.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
    "EUR": {
  "20/80": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 40.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 39.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 11.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 2.50 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 2.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 34.50 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 34.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 17.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 4.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 3.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 30.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 29.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 22.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 5.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 4.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 25.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 24.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 28.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 6.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 5.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 20.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 19.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 34.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 7.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 6.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 15.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 14.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 40.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 8.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 7.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 10.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 9.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 45.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 9.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 8.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 5.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0001Q06D.F", "target": 4.75 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 50.75 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 10.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 9.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 56.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 11.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 10.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
   "AUD": {
  "20/80": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 40.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 39.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 11.00 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 2.50 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 2.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 2.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 1.50 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 34.50 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 34.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 17.00 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 4.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 3.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 3.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 2.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 30.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 29.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 22.50 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 5.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 4.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 4.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 3.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 25.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 24.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 28.50 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 6.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 5.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 5.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 3.50 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 20.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 19.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 34.50 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 7.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 6.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 6.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 4.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 15.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 14.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 40.00 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 8.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 7.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 7.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 5.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 10.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 9.50 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 45.50 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 9.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 8.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 8.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 6.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "Vanguard Australian Government Bond Index ETF", "isin": "AU00000VGB4", "ticker": "VGB.AX", "target": 5.00 },
    { "name": "iShares Core Cash ETF", "isin": "AU0000BILL3", "ticker": "BILL.AX", "target": 4.75 },
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 50.75 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 10.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 9.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 9.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 7.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares S&P 500 ETF", "isin": "AU00000IVV8", "ticker": "IVV.AX", "target": 56.00 },
    { "name": "iShares Europe ETF", "isin": "AU0000IEU6", "ticker": "IEU.AX", "target": 11.00 },
    { "name": "Vanguard MSCI International Small Companies Index ETF", "isin": "AU0000026171", "ticker": "VISM.AX", "target": 10.00 },
    { "name": "Vanguard Global Value Active Equity ETF", "isin": "AU0000005886", "ticker": "VVLU.AX", "target": 10.00 },
    { "name": "iShares MSCI Emerging Markets ETF", "isin": "AU00000IEM3", "ticker": "IEM.AX", "target": 8.00 },
    { "name": "iShares MSCI Japan ETF", "isin": "AU00000IJP5", "ticker": "IJP.AX", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
},
    "Morningstar Passive Value": {
     "GBP": {
  "20/80": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 40.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 39.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 11.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 2.50 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 2.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 34.50 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 34.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 17.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 4.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 3.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 30.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 29.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 22.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 5.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 4.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 25.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 24.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 28.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 6.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 5.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 20.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 19.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 34.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 7.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 6.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 15.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 14.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 40.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 8.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 7.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 10.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 9.50 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 45.50 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 9.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 8.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares UK Gilts 0-5yr UCITS ETF GBP", "isin": "IE00B4WXJK79", "ticker": "IGLS.L", "target": 5.00 },
    { "name": "BlackRock ICS Sterling Liquidity Fund", "isin": "IE0004806687", "ticker": "0P000024YA.L", "target": 4.75 },
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 50.75 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 10.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 9.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares Core S&P500 UCITS ETF GBP", "isin": "IE00B5BMR087", "ticker": "CSP1.L", "target": 56.00 },
    { "name": "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", "isin": "IE00B4K48X80", "ticker": "SMEA.L", "target": 11.00 },
    { "name": "Dimensional Global Small Companies Acc GBP", "isin": "IE00B67QQ264", "ticker": "0P0000TH0O.L", "target": 10.00 },
    { "name": "Dimensional Global Value Acc GBP", "isin": "IE00B3NVPH21", "ticker": "0P0000VA0R.L", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EMIM.L", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF GBP", "isin": "IE00B4L5YX21", "ticker": "SJPA.L", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
    "USD": {
  "20/80": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 40.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 39.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 11.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 2.50 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 2.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 34.50 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 34.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 17.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 4.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 3.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 30.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 29.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 22.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 5.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 4.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 25.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 24.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 28.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 6.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 5.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 20.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 19.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 34.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 7.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 6.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 15.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 14.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 40.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 8.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 7.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 10.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 9.50 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 45.50 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 9.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 8.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares Treasury Bond 1-3yr UCITS ETF", "isin": "IE00B14X4S71", "ticker": "IDBT.L", "target": 5.00 },
    { "name": "BlackRock ICS US Dollar Liquidity Fund", "isin": "IE0004809582", "ticker": "0P0000258N", "target": 4.75 },
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 50.75 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 10.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 9.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares VII plc Core S&P 500 UCITS ETF Acc USD", "isin": "IE00B5BMR087", "ticker": "CSPX.L", "target": 56.00 },
    { "name": "Xtrackers MSCI Europe UCITS ETF 1C USD", "isin": "LU0274209237", "ticker": "XMED.L", "target": 11.00 },
    { "name": "Dimensional Global Small Companies Acc USD", "isin": "IE00B3MRDK01", "ticker": "0P0000TH0L", "target": 10.00 },
    { "name": "Dimensional Global Value Fund Acc USD", "isin": "IE00B687H819", "ticker": "0P0000VA0N", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF USD", "isin": "IE00BKM4GZ66", "ticker": "EIMI.L", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF USD", "isin": "IE00B4L5YX21", "ticker": "IJPA.L", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
    "EUR": {
  "20/80": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 40.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 39.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 11.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 2.50 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 2.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 2.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 1.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 0.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "30/70": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 34.50 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 34.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 17.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 4.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 3.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 3.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 2.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "40/60": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 30.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 29.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 22.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 5.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 4.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 4.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 3.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "50/50": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 25.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 24.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 28.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 6.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 5.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 5.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 3.50 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 1.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "60/40": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 20.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 19.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 34.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 7.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 6.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 6.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 4.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 2.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "70/30": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 15.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 14.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 40.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 8.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 7.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 7.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 5.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 2.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "80/20": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 10.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 9.50 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 45.50 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 9.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 8.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 8.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 6.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 3.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "90/10": [
    { "name": "iShares EUR Govt Bond 1-3yr UCITS ETF", "isin": "IE00B14X4Q57", "ticker": "IBGS.MI", "target": 5.00 },
    { "name": "BlackRock ICS Euro Liquidity Fund", "isin": "IE000BAFXJO9", "ticker": "0P0000247G.F", "target": 4.75 },
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 50.75 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 10.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 9.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 9.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 7.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 3.50 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ],
  "100/0": [
    { "name": "iShares S&P 500 EUR hedged UCITS ETF", "isin": "IE00B3ZW0K18", "ticker": "IUSE.L", "target": 56.00 },
    { "name": "iShares MSCI Europe UCITS ETF Acc EUR", "isin": "IE00B4K48X80", "ticker": "SMEA.MI", "target": 11.00 },
    { "name": "Dimensional Global Small Companies EUR ACC", "isin": "IE00B67WB637", "ticker": "0P0000TH0M.F", "target": 10.00 },
    { "name": "Dimensional Global Value Fund EUR, Acc", "isin": "IE00B60LX167", "ticker": "0P0000VA0P.F", "target": 10.00 },
    { "name": "iShares Core MSCI EM IMI UCITS ETF", "isin": "IE00BKM4GZ66", "ticker": "EIMI.MI", "target": 8.00 },
    { "name": "iShares Core MSCI Japan IMI UCITS ETF EUR", "isin": "IE00B4L5YX21", "ticker": "IJPA.AS", "target": 4.00 },
    { "name": "Cash", "isin": "N/A", "ticker": "N/A", "target": 1.00 }
  ]
},
},
    /*"IB Passive": {
    "GBP": {
      "20/80": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 40.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 39.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 11.00 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 2.50 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 2.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 2.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 1.50 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 0.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "30/70": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 34.50 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 34.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 17.00 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 4.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 3.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 3.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 2.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 1.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "40/60": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 30.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 29.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 22.50 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 5.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 4.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 4.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 3.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 1.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "50/50": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 25.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 24.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 28.50 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 6.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 5.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 5.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 3.50 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 1.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "60/40": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 20.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 19.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 34.50 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 7.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 6.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 6.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 4.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 2.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "70/30": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 15.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 14.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 40.00 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 8.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 7.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 7.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 5.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 2.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "80/20": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 10.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 9.50 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 45.50 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 9.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 8.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 8.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 6.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 3.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "90/10": [
        { name: "iShares UK Gilts 0-5yr UCITS ETF GBP", isin: "IE00B4WXJK79", target: 5.00 },
        { name: "BlackRock ICS Sterling Liquidity Fund Core Acc", isin: "IE0004807107", target: 4.75 },
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 50.75 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 10.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 9.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 9.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 7.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 3.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "100/0": [
        { name: "iShares Core S&P500 UCITS ETF GBP", isin: "IE00B5BMR087", target: 56.00 },
        { name: "iShares Core MSCI Europe UCITS ETF EUR (Acc) GBP", isin: "IE00B4K48X80", target: 11.00 },
        { name: "Dimensional Global Small Companies Acc GBP", isin: "IE00B67QQ264", target: 10.00 },
        { name: "Dimensional Global Value Acc GBP", isin: "IE00B3NVPH21", target: 10.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF", isin: "IE00BKM4GZ66", target: 8.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF GBP", isin: "IE00B4L5YX21", target: 4.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ]
    },
    "USD": {
      "20/80": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 40.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 39.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 11.00 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 2.50 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 2.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 2.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 1.50 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 0.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "30/70": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 34.50 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 34.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 17.00 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 4.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 3.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 3.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 2.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 1.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "40/60": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 30.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 29.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 22.50 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 5.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 4.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 4.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 3.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 1.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "50/50": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 25.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 24.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 28.50 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 6.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 5.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 5.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 3.50 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 1.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "60/40": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 20.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 19.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 34.50 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 7.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 6.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 6.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 4.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 2.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "70/30": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 15.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 14.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 40.00 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 8.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 7.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 7.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 5.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 2.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "80/20": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 10.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 9.50 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 45.50 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 9.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 8.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 8.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 6.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 3.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "90/10": [
        { name: "iShares Treasury Bond 1-3yr UCITS ETF (ACC)", isin: "IE00BYXPSP02", target: 5.00 },
        { name: "BlackRock ICS US Dollar Liquidity Fund Core Acc", isin: "IE0004810143", target: 4.75 },
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 50.75 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 10.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 9.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 9.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 7.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 3.50 },
        { name: "Cash", isin: "N/A", target: 1.00 }
      ],
      "100/0": [
        { name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", target: 56.00 },
        { name: "Xtrackers MSCI Europe UCITS ETF 1C USD", isin: "LU0274209237", target: 11.00 },
        { name: "Dimensional Global Small Companies Acc USD", isin: "IE00B3MRDK01", target: 10.00 },
        { name: "Dimensional Global Value Fund Acc USD", isin: "IE00B687H819", target: 10.00 },
        { name: "iShares Core MSCI EM IMI UCITS ETF USD", isin: "IE00BKM4GZ66", target: 8.00 },
        { name: "iShares Core MSCI Japan IMI UCITS ETF USD", isin: "IE00B4L5YX21", target: 4.00 },
        { name: "Cash", isin: "N/A", target: 1.00 }
    ]
    }
}*/
};

// ─── 2. Static Fallback Exchange Rates ───────────────────────────────────────
//
// PURPOSE: Emergency fallback only. These are NEVER mutated. When live rates
// arrive from the Currencies sheet, they are stored in App-level React state
// and merged at read-time via the `resolveRate` utility below.
//
/** @type {ExchangeRateMap} */
export const FALLBACK_EXCHANGE_RATES = Object.freeze({
    "USD": Object.freeze({ GBP: 0.74,   EUR: 0.86,   AUD: 1.40,   AED: 3.6725 }),
    "GBP": Object.freeze({ USD: 1.35,   EUR: 1.16,   AUD: 1.89,   AED: 4.96   }),
    "EUR": Object.freeze({ USD: 1.17,   GBP: 0.86,   AUD: 1.64,   AED: 4.29   }),
    "AUD": Object.freeze({ USD: 0.71,   GBP: 0.53,   EUR: 0.61,   AED: 2.62   }),
    "AED": Object.freeze({ USD: 0.2723, GBP: 0.2016, EUR: 0.2331, AUD: 0.3802 }),
});

/**
 * Looks up a conversion rate, preferring live rates over the static fallback.
 *
 * @param {string}         base        - Source currency, e.g. "USD"
 * @param {string}         target      - Target currency, e.g. "GBP"
 * @param {ExchangeRateMap} liveRates  - Runtime map fetched from the sheet
 * @returns {number}                   - Conversion multiplier, or 1.0 if unknown
 */
export function resolveRate(base, target, liveRates = {}) {
    if (base === target) return 1;
    return (
        liveRates?.[base]?.[target] ??
        FALLBACK_EXCHANGE_RATES[base]?.[target] ??
        1
    );
}

// ─── 3. Currency Symbols ──────────────────────────────────────────────────────
/** @type {{ [currency: string]: string }} */
export const CURRENCY_SYMBOLS = {
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
    'AUD': 'A$',
};

// ─── 4. Remote Data Source URLs ───────────────────────────────────────────────
export const GOOGLE_SHEETS_CSV_URLS = Object.freeze({
    STOCKS:      "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=0&single=true&output=csv",
    DAILY_HIST:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=689728688&single=true&output=csv",
    MONTHLY_HIST:"https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=755116259&single=true&output=csv",
    CURRENCIES:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=161616036&single=true&output=csv",
    PORTFOLIOS:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2K_7b79oThGmtNyB6y1Flz_o6_I9k5BMq2nIc-ARgZ7qi0FpTjaaycaDv4pNX7BtkmexcvaicQE1M/pub?gid=1724094727&single=true&output=csv",
});