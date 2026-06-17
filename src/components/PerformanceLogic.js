// ─────────────────────────────────────────────────────────────────────────────
// PerformanceLogic.js  —  v4 (FE Analytics Edition)
//
// usePerformanceMetrics custom hook. All state, maths, and derived data live
// here. The view layer is strictly declarative.
//
// UPGRADE SUMMARY (v3 → v4):
//   1. Sandbox engine REMOVED. Simulation type / simulatedPortfolio / simulationLabel
//      state fields REMOVED.
//   2. NEW: Custom Portfolio Builder. Each selection may carry `customPortfolio`
//      (PortfolioRow[]) built interactively by the user. Handlers:
//        addCustomHolding / removeCustomHolding / updateCustomHolding
//      `customPortfolioWeight(sel)` returns the current summed weight (0–100+)
//      so the UI can surface over/under allocation warnings.
//   3. TER-adjusted series calculation. `calculateSeries` now computes the
//      portfolio's weighted average TER and applies a compound daily/monthly
//      drag factor to every index point, producing a true net-of-fees curve:
//        dailyFeeFactor = (1 - TER/100) ^ (1/252)
//        netIndex[p] = grossIndex[p] * dailyFeeFactor ^ p
//   4. Normalized base-100 index. The series output now represents a rebased
//      index starting at 100 at the oldest boundary of the selected timeframe.
//      `growth` is the index value (100 = flat); `pctReturn` = growth − 100.
//   5. Annualized Volatility. Computed from daily log-return std dev × √252
//      for each populated series and exposed in `seriesSummaryStats`.
//   6. `seriesSummaryStats`: per-series badge data — cumulative return,
//      annualized volatility, and net portfolio cost (weighted TER).
//   7. `structuralMetrics` holdings now carry `weightedTerContribution` for the
//      expanded factsheet accordion column.
//
// DATA SHAPE CONTRACT (unchanged from v3):
//   pricesData     : { [ticker]: AssetPrice }
//   historicalData : { [ticker]: { Daily_1Y?: string; Monthly_5Y?: string } }
//   presets        : { [strategyName]: { [currency]: { [profileName]: PortfolioRow[] } } }
//   PortfolioRow   : { ticker?, isin?, name?, target?, weight? }
//   AssetPrice     : { price, isin, name, currency, ter, volatility, ... }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────

export const COLORS = ['#2d0738', '#9966ff', '#00a0f0', '#fc5b3f'];

// Trading-day counts used for annualisation
const TRADING_DAYS_PER_YEAR   = 252;
const TRADING_MONTHS_PER_YEAR = 12;

// ─── Timeframe helpers ───────────────────────────────────────────────────────

function getYTDDays() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const calendarDays = Math.max(1, Math.floor((now - start) / 86400000));
  return Math.floor(calendarDays * (TRADING_DAYS_PER_YEAR / 365));
}

// ─── Volatility badge styling (exported for use in view) ─────────────────────

export function getVolBadgeStyles(vol) {
  const v = String(vol).trim().toLowerCase();
  if (['low', 'below average'].includes(v))   return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (['high', 'above average'].includes(v))  return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

// ─── Math helpers ────────────────────────────────────────────────────────────

/**
 * Annualized volatility from an array of index values (base-100 normalized).
 * Uses log returns; returns 0 if insufficient data.
 */
function computeAnnualizedVolatility(indexValues, isMonthly = false) {
  if (!indexValues || indexValues.length < 3) return 0;
  const logReturns = [];
  for (let i = 1; i < indexValues.length; i++) {
    const prev = indexValues[i - 1];
    const curr = indexValues[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }
  if (logReturns.length < 2) return 0;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const periodsPerYear = isMonthly ? TRADING_MONTHS_PER_YEAR : TRADING_DAYS_PER_YEAR;
  return Math.sqrt(variance * periodsPerYear) * 100; // expressed as %
}

// ─── The Hook ─────────────────────────────────────────────────────────────────

/**
 * @param {{ presets: Object, historicalData: Object, pricesData: Object }} params
 */
export function usePerformanceMetrics({ presets = {}, historicalData = {}, pricesData = {} }) {

  // ── Timeframe configuration ────────────────────────────────────────────────

  const TIMEFRAMES = useMemo(() => ({
    '3m':  { label: '3M',  source: 'Daily_1Y',   points: 63,           isMonthly: false },
    '6m':  { label: '6M',  source: 'Daily_1Y',   points: 126,          isMonthly: false },
    'ytd': { label: 'YTD', source: 'Daily_1Y',   points: getYTDDays(), isMonthly: false },
    '1y':  { label: '1Y',  source: 'Daily_1Y',   points: 252,          isMonthly: false },
    '3y':  { label: '3Y',  source: 'Daily_1Y',   points: 756,          isMonthly: false },
    '5y':  { label: '5Y',  source: 'Monthly_5Y', points: 60,           isMonthly: true  },
  }), []);

  const [timeframe, setTimeframe] = useState('1y');

  // ── Series selections ──────────────────────────────────────────────────────
  // Each selection carries:
  //   type            : 'preset' | 'asset' | 'custom'
  //   strategy/profile: preset selectors
  //   currency        : filter for ticker lookups
  //   assetTicker     : for type === 'asset'
  //   customPortfolio : PortfolioRow[] for type === 'custom'

  const makeEmptySelection = (overrides = {}) => ({
    id:              `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type:            'preset',
    strategy:        '',
    currency:        '',
    profile:         '',
    assetTicker:     '',
    customPortfolio: [],
    ...overrides,
  });

  const [selections, setSelections] = useState([
    makeEmptySelection({
      id:       'init-0',
      strategy: 'World Allocation',
      currency: 'USD',
      profile:  'Risk Averse (20/80)',
    }),
  ]);

  // ── Drag-to-cross-slice state ──────────────────────────────────────────────

  const [refAreaLeft,  setRefAreaLeft]  = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isSelecting,  setIsSelecting]  = useState(false);
  const [customStats,  setCustomStats]  = useState(null);

  // ── Holdings accordion state ───────────────────────────────────────────────

  const [expandedLedger, setExpandedLedger] = useState({});

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  const addSelection = useCallback(() => {
    setSelections(prev => {
      if (prev.length >= 4) return prev;
      return [...prev, makeEmptySelection()];
    });
  }, []);

  const removeSelection = useCallback((id) => {
    setSelections(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSelection = useCallback((id, field, value) => {
    setSelections(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      // Cascade resets on type change
      if (field === 'type') {
        updated.strategy        = '';
        updated.profile         = '';
        updated.assetTicker     = '';
        updated.customPortfolio = [];
      }
      if (field === 'strategy' || field === 'currency') {
        updated.profile = '';
      }
      if (field === 'currency' && updated.type === 'asset') {
        updated.assetTicker = '';
      }
      if (field === 'currency' && updated.type === 'custom') {
        updated.customPortfolio = []; // reset — built for previous currency pool
      }
      return updated;
    }));
  }, []);

  const toggleLedger = useCallback((id) => {
    setExpandedLedger(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // CUSTOM PORTFOLIO BUILDER HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Appends a new holding row to sel.customPortfolio.
   * The row is seeded with the ticker looked up from pricesData (for name/isin).
   */
  const addCustomHolding = useCallback((selectionId, ticker) => {
    if (!ticker) return;
    const tickerKey  = ticker.trim().toUpperCase();
    const assetMeta  = pricesData[tickerKey] || {};

    setSelections(prev => prev.map(s => {
      if (s.id !== selectionId) return s;
      // Prevent duplicate tickers in the same custom portfolio
      if (s.customPortfolio.some(h => h.ticker === tickerKey)) return s;
      return {
        ...s,
        customPortfolio: [
          ...s.customPortfolio,
          {
            ticker: tickerKey,
            isin:   assetMeta.isin   || '',
            name:   assetMeta.name   || tickerKey,
            weight: 0,   // user must fill in
          },
        ],
      };
    }));
  }, [pricesData]);

  /**
   * Removes a holding row by ticker from sel.customPortfolio.
   */
  const removeCustomHolding = useCallback((selectionId, ticker) => {
    setSelections(prev => prev.map(s => {
      if (s.id !== selectionId) return s;
      return {
        ...s,
        customPortfolio: s.customPortfolio.filter(h => h.ticker !== ticker),
      };
    }));
  }, []);

  /**
   * Updates the `weight` (or any field) of a specific holding row.
   */
  const updateCustomHolding = useCallback((selectionId, ticker, field, rawValue) => {
    setSelections(prev => prev.map(s => {
      if (s.id !== selectionId) return s;
      return {
        ...s,
        customPortfolio: s.customPortfolio.map(h => {
          if (h.ticker !== ticker) return h;
          const value = field === 'weight' ? Math.max(0, parseFloat(rawValue) || 0) : rawValue;
          return { ...h, [field]: value };
        }),
      };
    }));
  }, []);

  /**
   * Returns the sum of weights in a custom portfolio (for validation UI).
   */
  const customPortfolioWeight = useCallback((sel) => {
    if (!sel.customPortfolio || sel.customPortfolio.length === 0) return 0;
    return sel.customPortfolio.reduce((sum, h) => sum + (parseFloat(h.weight) || 0), 0);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // PORTFOLIO RESOLUTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the array of PortfolioRow for a given selection, or null if
   * the selection is not yet fully configured.
   *
   * Resolution order:
   *   custom  → sel.customPortfolio (only if total weight === 100)
   *   preset  → presets[strategy][currency][profile]
   *   asset   → [{ ticker: assetTicker, target: 100 }]
   */
  const resolvePortfolio = useCallback((sel) => {
    if (sel.type === 'custom') {
      if (!sel.customPortfolio || sel.customPortfolio.length === 0) return null;
      const total = sel.customPortfolio.reduce((s, h) => s + (parseFloat(h.weight) || 0), 0);
      // Require weight sum to be within 0.1% of 100 (floating-point tolerance)
      if (Math.abs(total - 100) > 0.1) return null;
      return sel.customPortfolio;
    }
    if (sel.type === 'preset') {
      if (!sel.strategy || !sel.currency || !sel.profile) return null;
      return presets[sel.strategy]?.[sel.currency]?.[sel.profile] ?? null;
    }
    // type === 'asset'
    if (!sel.currency || !sel.assetTicker) return null;
    return [{ ticker: sel.assetTicker, target: 100 }];
  }, [presets]);

  // ══════════════════════════════════════════════════════════════════════════
  // SERIES CALCULATION  —  Net-of-Fees, Base-100 Normalized
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Builds a base-100 normalized index series for a selection over a given
   * timeframe configuration, with compounded TER drag applied per point.
   *
   * Returns an array of { index: number, pctReturn: number, raw: number }
   * or null if the selection is incomplete / has no data.
   *
   *   index      : normalized level (100 = flat; e.g. 112.4 = +12.4%)
   *   pctReturn  : index − 100  (for display and stats)
   *   raw        : underlying weighted price sum (for cross-slice delta maths)
   */
  const calculateSeries = useCallback((sel, timeframeConfig) => {
    const portfolio = resolvePortfolio(sel);
    if (!portfolio || portfolio.length === 0) return null;

    const { source, points, isMonthly } = timeframeConfig;
    const periodsPerYear = isMonthly ? TRADING_MONTHS_PER_YEAR : TRADING_DAYS_PER_YEAR;

    // ── 1. Resolve history strings for each holding ────────────────────────

    const parsedHistories = portfolio.map(asset => {
      const rawTicker = (asset.ticker || '').trim().toUpperCase();
      const rawIsin   = (asset.isin   || '').trim().toUpperCase();

      if (rawTicker === 'N/A' || (!rawTicker && !rawIsin)) return [];

      const dataKey = Object.keys(historicalData).find(k => {
        const u = k.trim().toUpperCase();
        return u === rawTicker || u === rawIsin;
      });

      const hString = dataKey ? historicalData[dataKey]?.[source] : null;

      if (!hString || hString === 'N/A') {
        console.warn(`[GSB Analytics] No "${source}" history for: ${rawTicker || rawIsin}`);
        return [];
      }

      return hString.split(';').map(v => parseFloat(v) || 0);
    });

    if (parsedHistories.every(h => h.length === 0)) return null;

    // ── 2. Align all histories to the same trailing window ─────────────────

    let maxAvailablePoints = points;
    parsedHistories.forEach(h => {
      if (h.length > 0 && h.length < maxAvailablePoints) {
        maxAvailablePoints = h.length;
      }
    });
    const finalPointsCount = Math.max(1, maxAvailablePoints);

    // ── 3. Compute weighted average TER for this portfolio ─────────────────
    //
    // TER is looked up from pricesData (flat map). For each holding, the
    // contribution is ter * (weight / 100).

    let weightedTer = 0;
    let totalWeight = 0;
    portfolio.forEach(asset => {
      const key    = (asset.ticker || '').trim().toUpperCase();
      const meta   = key ? (pricesData[key] || {}) : {};
      const ter    = parseFloat(meta.ter) || 0;
      const weight = parseFloat(asset.target || asset.weight) || 0;
      weightedTer += ter * weight;
      totalWeight += weight;
    });
    const blendedTer = totalWeight > 0 ? weightedTer / totalWeight : 0;

    // Daily/monthly compounded fee drag factor:
    //   netIndex[p] = grossIndex[p] × (1 − TER/100)^(p/periodsPerYear)
    // We compute a per-period multiplier and apply it cumulatively.
    const perPeriodFeeFactor = Math.pow(1 - blendedTer / 100, 1 / periodsPerYear);

    // ── 4. Compute the gross composite price series ────────────────────────

    const rawComposite = new Array(finalPointsCount).fill(null);

    for (let p = 0; p < finalPointsCount; p++) {
      let compositePrice = 0;
      let hasData        = false;

      portfolio.forEach((asset, i) => {
        const history = parsedHistories[i];
        if (!history || history.length === 0) return;
        const histIdx = history.length - finalPointsCount + p;
        if (histIdx < 0 || histIdx >= history.length) return;

        const weight = parseFloat(asset.target || asset.weight) || 0;
        compositePrice += history[histIdx] * (weight / 100);
        hasData = true;
      });

      if (hasData) rawComposite[p] = compositePrice;
    }

    // ── 5. Normalize to base-100 and apply TER drag ────────────────────────

    // Find the first non-null composite value as the base
    const baseIdx = rawComposite.findIndex(v => v !== null && v > 0);
    if (baseIdx === -1) return null;
    const basePrice = rawComposite[baseIdx];

    const alignedData = [];
    let feeCumulativeMultiplier = Math.pow(perPeriodFeeFactor, 0); // starts at 1.0

    for (let p = 0; p < finalPointsCount; p++) {
      const raw = rawComposite[p];
      if (raw === null) {
        alignedData.push(null);
        // still advance the fee clock even on data gaps
        feeCumulativeMultiplier *= perPeriodFeeFactor;
        continue;
      }

      const grossIndex = (raw / basePrice) * 100;
      const netIndex   = parseFloat((grossIndex * feeCumulativeMultiplier).toFixed(4));
      const pctReturn  = parseFloat((netIndex - 100).toFixed(4));

      alignedData.push({ index: netIndex, pctReturn, raw });

      feeCumulativeMultiplier *= perPeriodFeeFactor;
    }

    return alignedData;
  }, [historicalData, pricesData, resolvePortfolio]);

  // ══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL METRICS  —  TER factsheet with weighted contribution column
  // ══════════════════════════════════════════════════════════════════════════

  const structuralMetrics = useMemo(() => {
    return selections.map(sel => {
      const portfolio = resolvePortfolio(sel);
      if (!portfolio || portfolio.length === 0) return null;

      let totalWeight  = 0;
      let weightedTer  = 0;
      const volCounts  = { 'High': 0, 'Above Average': 0, 'Average': 0, 'Below Average': 0, 'Low': 0 };
      let dynamicName  = 'Asset Strategy';
      const holdings   = [];

      portfolio.forEach(asset => {
        const key    = (asset.ticker || '').trim().toUpperCase();
        const weight = parseFloat(asset.target || asset.weight) || 0;
        const meta   = key ? (pricesData[key] || {}) : {};

        const itemTer   = parseFloat(meta.ter)         || 0;
        const itemVol   = meta.volatility               || 'Average';
        const itemName  = meta.name || asset.name       || 'Unknown Asset';
        const terContrib = parseFloat(((itemTer * weight) / 100).toFixed(4));

        totalWeight  += weight;
        weightedTer  += itemTer * weight;

        if (volCounts[itemVol] !== undefined) {
          volCounts[itemVol] += weight;
        } else {
          volCounts['Average'] += weight;
        }

        holdings.push({
          ticker:              key  || 'N/A',
          name:                itemName,
          weight,
          ter:                 itemTer,
          weightedTerContrib:  terContrib,   // NEW: for factsheet column
          volatility:          itemVol,
        });

        if (sel.type === 'asset' && meta.name) dynamicName = meta.name;
        if (sel.type === 'custom')              dynamicName = 'Custom Portfolio';
      });

      if (totalWeight === 0) return null;

      let dominantVol  = 'Average';
      let maxVolWeight = -1;
      Object.entries(volCounts).forEach(([key, val]) => {
        if (val > maxVolWeight) { maxVolWeight = val; dominantVol = key; }
      });

      return {
        id:         sel.id,
        name:       sel.type === 'preset' ? sel.profile : dynamicName,
        ter:        weightedTer / totalWeight,
        volatility: dominantVol,
        holdings,
      };
    });
  }, [selections, pricesData, resolvePortfolio]);

  // ══════════════════════════════════════════════════════════════════════════
  // CHART DATA ASSEMBLY  —  base-100 index, net of fees
  // ══════════════════════════════════════════════════════════════════════════

  const chartData = useMemo(() => {
    const config        = TIMEFRAMES[timeframe];
    const seriesResults = selections.map(sel => calculateSeries(sel, config));

    const validLengths         = seriesResults.filter(s => s !== null).map(s => s.length);
    const actualPointsRendered = validLengths.length > 0
      ? Math.max(...validLengths)
      : config.points;

    // ── Generate date labels ────────────────────────────────────────────────

    const labels = [];
    const now    = new Date();
    const isDaily = config.source.includes('Daily');

    for (let i = 0; i < actualPointsRendered; i++) {
      const d = new Date(now);
      if (isDaily) {
        d.setDate(d.getDate() - Math.floor((actualPointsRendered - 1 - i) * (365 / TRADING_DAYS_PER_YEAR)));
      } else {
        d.setMonth(d.getMonth() - (actualPointsRendered - 1 - i));
      }
      labels.push(
        isDaily && actualPointsRendered <= 126
          ? d.toLocaleString('default', { month: 'short', day: 'numeric' })
          : d.toLocaleString('default', { month: 'short', year: '2-digit' })
      );
    }

    // ── Assemble per-point chart objects ────────────────────────────────────
    // Each point stores:
    //   series_N    : net-of-fee index value (base 100)
    //   pct_N       : percentage return (index − 100) for tooltip
    //   raw_N       : raw composite price (for cross-slice delta)

    const data = [];
    for (let i = 0; i < actualPointsRendered; i++) {
      const point = { name: labels[i] };
      selections.forEach((sel, idx) => {
        const dp = seriesResults[idx]?.[i] ?? null;
        point[`series_${idx}`] = dp !== null ? dp.index     : null;
        point[`pct_${idx}`]    = dp !== null ? dp.pctReturn : null;
        point[`raw_${idx}`]    = dp !== null ? dp.raw       : null;
      });
      data.push(point);
    }

    return data;
  }, [selections, timeframe, historicalData, pricesData, TIMEFRAMES, calculateSeries]);

  // ══════════════════════════════════════════════════════════════════════════
  // SERIES SUMMARY STATS  —  FE Analytics status badges
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * For each populated series, returns:
   *   id          : selection id
   *   name        : display label
   *   cumReturn   : total % return over the visible timeframe (net of fees)
   *   annualVol   : annualized volatility %
   *   weightedTer : blended cost (% p.a.)
   */
  const seriesSummaryStats = useMemo(() => {
    const config = TIMEFRAMES[timeframe];

    return selections.map((sel, idx) => {
      // Extract the index series values (non-null) for volatility calculation
      const indexValues = chartData
        .map(d => d[`series_${idx}`])
        .filter(v => v !== null && v !== undefined);

      const lastIndex = indexValues[indexValues.length - 1] ?? 100;
      const cumReturn = parseFloat((lastIndex - 100).toFixed(2));
      const annualVol = parseFloat(
        computeAnnualizedVolatility(indexValues, config.isMonthly).toFixed(2)
      );

      // Weighted TER from structuralMetrics (already computed)
      const metrics    = structuralMetrics[idx];
      const weightedTer = metrics ? parseFloat(metrics.ter.toFixed(3)) : 0;

      return {
        id:           sel.id,
        name:         resolveSelectionName(sel),
        cumReturn,
        annualVol,
        weightedTer,
        hasData:      indexValues.length > 1,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, selections, structuralMetrics, timeframe]);

  // ══════════════════════════════════════════════════════════════════════════
  // DRAG-TO-CROSS-SLICE INTERACTION
  // ══════════════════════════════════════════════════════════════════════════

  const clearSelection = useCallback(() => {
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setCustomStats(null);
  }, []);

  useEffect(() => { clearSelection(); }, [timeframe, clearSelection]);

  const handleMouseDown = useCallback((e) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
      setIsSelecting(true);
      setCustomStats(null);
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isSelecting && e?.activeLabel) setRefAreaRight(e.activeLabel);
  }, [isSelecting]);

  // Resolves the human-readable display name for a selection.
  // Defined here (not via useCallback) because it is also called from the
  // seriesSummaryStats memo above — we need a stable reference.
  function resolveSelectionName(sel) {
    if (sel.type === 'custom') return 'Custom Portfolio';
    if (sel.type === 'preset') return sel.profile || 'Preset';
    const key = (sel.assetTicker || '').trim().toUpperCase();
    return (key && pricesData[key]) ? pricesData[key].name : 'Asset';
  }

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);

    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      let startIdx = chartData.findIndex(d => d.name === refAreaLeft);
      let endIdx   = chartData.findIndex(d => d.name === refAreaRight);

      if (startIdx === -1 || endIdx === -1) {
        setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
        return;
      }

      if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];
      setRefAreaLeft(chartData[startIdx].name);
      setRefAreaRight(chartData[endIdx].name);

      const stats = selections.map((sel, idx) => {
        const startRaw = chartData[startIdx]?.[`raw_${idx}`];
        const endRaw   = chartData[endIdx]?.[`raw_${idx}`];
        if (!startRaw || !endRaw) return null;

        return {
          id:     sel.id,
          name:   resolveSelectionName(sel),
          return: parseFloat((((endRaw - startRaw) / startRaw) * 100).toFixed(2)),
        };
      }).filter(Boolean);

      setCustomStats({ start: chartData[startIdx].name, end: chartData[endIdx].name, stats });
    } else {
      setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
    }
  }, [refAreaLeft, refAreaRight, chartData, selections, pricesData]);

  // ── Final (full-timeframe) stats ────────────────────────────────────────────

  const finalStats = useMemo(() => {
    if (chartData.length === 0) return [];
    const last = chartData[chartData.length - 1];
    return selections.map((sel, idx) => ({
      id:     sel.id,
      name:   resolveSelectionName(sel),
      return: last?.[`pct_${idx}`] ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, selections]);

  const displayStats    = customStats ? customStats.stats : finalStats;
  const isChartPopulated = useMemo(() => chartData.some(d =>
    Object.keys(d).some(k => k.startsWith('series_') && d[k] !== null && d[k] !== undefined)
  ), [chartData]);

  // ── Ticker options for dropdowns ─────────────────────────────────────────────

  const getTickerOptions = useCallback((sel) => {
    if (!sel.currency) return [];
    return Object.entries(pricesData)
      .filter(([, a]) => a && a.currency === sel.currency)
      .map(([ticker, a]) => ({ ticker, name: a.name }));
  }, [pricesData]);

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    // Constants
    COLORS,
    TIMEFRAMES,

    // Timeframe
    timeframe,
    setTimeframe,

    // Selections
    selections,
    addSelection,
    removeSelection,
    updateSelection,
    getTickerOptions,

    // Custom Portfolio Builder
    addCustomHolding,
    removeCustomHolding,
    updateCustomHolding,
    customPortfolioWeight,

    // Holdings accordion
    expandedLedger,
    toggleLedger,

    // Derived data
    chartData,
    structuralMetrics,
    seriesSummaryStats,
    finalStats,
    displayStats,
    customStats,
    isChartPopulated,

    // Cross-slice drag
    refAreaLeft,
    refAreaRight,
    isSelecting,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelection,

    // Styling helper
    getVolBadgeStyles,
  };
}