// ─────────────────────────────────────────────────────────────────────────────
// PerformanceLogic.js
//
// Custom hook `usePerformanceMetrics` — extracted from the monolithic
// PerformanceAnalyticsView. Owns ALL state, derived data, and handlers:
//
//   - Timeframe configuration (3M / 6M / YTD / 1Y / 3Y / 5Y) + date labelling
//   - Selection (Series) state: add / remove / update
//   - Preset & individual-asset series calculation (calculateSeries)
//   - Simulation Sandbox engine (RANDOM / BALANCED_60_40 / AGGRESSIVE_GROWTH)
//     — operates on the flat pricesData map { [ticker]: AssetPrice }
//     — injects a synthetic portfolio onto the selection itself
//       (sel.simulatedPortfolio), so calculateSeries / structuralMetrics can
//       use it interchangeably with a preset portfolio
//   - Structural fundamentals (TER / volatility / holdings ledger)
//   - Chart data assembly for Recharts
//   - Drag-to-cross-slice interaction (mouseDown / mouseMove / mouseUp)
//   - Final & custom-range stats
//   - Volatility badge styling helper
//
// DATA SHAPE CONTRACT:
//   pricesData     : { [ticker]: AssetPrice }                — FLAT, all currencies
//   historicalData : { [ticker]: { Daily_1Y?: string; Monthly_5Y?: string } }
//   presets        : { [strategyName]: { [currency]: { [profileName]: PortfolioRow[] } } }
//
//   PortfolioRow   : { ticker?, isin?, name?, target?, weight? }
//   AssetPrice     : { price, isin, name, currency, ter, volatility, ... }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────

export const COLORS = ['#2d0738', '#9966ff', '#00a0f0', '#fc5b3f'];

// ─── Timeframe helpers ───────────────────────────────────────────────────────

function getYTDDays() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const calendarDays = Math.max(1, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
  return Math.floor(calendarDays * (252 / 365));
}

// ─── Simulation Sandbox Engine ───────────────────────────────────────────────
//
// Builds a synthetic PortfolioRow[] from the flat pricesData map, filtered to
// the selection's chosen currency. Each row carries `ticker`, `name`, `isin`,
// `weight`, and `units` so it slots directly into calculateSeries /
// structuralMetrics, which both already understand `asset.target || asset.weight`.
//
/**
 * @param {'RANDOM'|'BALANCED_60_40'|'AGGRESSIVE_GROWTH'} type
 * @param {string} currency     - The selection's OWN currency (sel.currency), never a global var
 * @param {{ [ticker: string]: any }} pricesData - FLAT map, all currencies
 * @returns {Array<{ ticker: string, name: string, isin: string, weight: number, units: number }>}
 */
export function generateSimulatedPortfolio(type, currency, pricesData) {
  if (!currency) return [];

  // Filter the FLAT map down to assets matching this selection's currency,
  // re-attaching the ticker key (lost when using Object.values).
  const availableAssets = Object.entries(pricesData || {})
    .filter(([, asset]) => asset && asset.currency === currency)
    .map(([ticker, asset]) => ({ ticker, ...asset }));

  if (availableAssets.length === 0) return [];

  // Shuffle to introduce variety on every generation
  const shuffled = [...availableAssets].sort(() => 0.5 - Math.random());

  const toPortfolioRow = (asset, weight) => ({
    ticker: asset.ticker,
    isin:   asset.isin,
    name:   asset.name,
    weight,
    units:  1000,
  });

  switch (type) {
    case 'RANDOM': {
      // Select 3 to 5 random assets
      const sampleSize = Math.floor(Math.random() * 3) + 3;
      const selected = shuffled.slice(0, Math.min(sampleSize, shuffled.length));
      if (selected.length === 0) return [];

      // Allocate weights that dynamically sum to 100%
      let remainingWeight = 100;
      return selected.map((asset, index) => {
        if (index === selected.length - 1) {
          return toPortfolioRow(asset, remainingWeight);
        }
        const randomWeight = Math.floor(Math.random() * (remainingWeight / 1.5)) + 5;
        remainingWeight -= randomWeight;
        return toPortfolioRow(asset, randomWeight);
      });
    }

    case 'BALANCED_60_40': {
      const selected = shuffled.slice(0, Math.min(3, shuffled.length));
      const weights = [45, 35, 20]; // Predefined stable profile split
      return selected.map((asset, i) => toPortfolioRow(asset, weights[i] || 10));
    }

    case 'AGGRESSIVE_GROWTH': {
      const selected = shuffled.slice(0, Math.min(4, shuffled.length));
      const weights = [50, 30, 15, 5];
      return selected.map((asset, i) => toPortfolioRow(asset, weights[i] || 5));
    }

    default:
      return [];
  }
}

// ─── Volatility badge styling ────────────────────────────────────────────────

export function getVolBadgeStyles(vol) {
  const cleanVol = String(vol).trim().toLowerCase();
  if (['low', 'below average'].includes(cleanVol)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
  if (['high', 'above average'].includes(cleanVol)) {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

// ─── The Hook ─────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Object} params.presets         - Strategy presets, keyed by [strategy][currency][profile]
 * @param {Object} params.historicalData  - { [ticker]: { Daily_1Y?, Monthly_5Y? } }
 * @param {Object} params.pricesData      - FLAT { [ticker]: AssetPrice } map, all currencies
 */
export function usePerformanceMetrics({ presets = {}, historicalData = {}, pricesData = {} }) {

  // ── Timeframe configuration ────────────────────────────────────────────────
  const TIMEFRAMES = useMemo(() => ({
    '3m':  { label: '3M',  source: 'Daily_1Y',   points: 63 },
    '6m':  { label: '6M',  source: 'Daily_1Y',   points: 126 },
    'ytd': { label: 'YTD', source: 'Daily_1Y',   points: getYTDDays() },
    '1y':  { label: '1Y',  source: 'Daily_1Y',   points: 252 },
    '3y':  { label: '3Y',  source: 'Daily_1Y',   points: 756 },
    '5y':  { label: '5Y',  source: 'Monthly_5Y', points: 60 }
  }), []);

  const [timeframe, setTimeframe] = useState('1y');

  // ── Series selections ──────────────────────────────────────────────────────
  const [selections, setSelections] = useState([
    { id: 'init-0', type: 'preset', strategy: 'World Allocation', currency: 'USD', profile: 'Risk Averse (20/80)', assetTicker: '', simulatedPortfolio: null, simulationLabel: '' }
  ]);

  // ── Drag-to-cross-slice interaction state ──────────────────────────────────
  const [refAreaLeft,  setRefAreaLeft]  = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isSelecting,  setIsSelecting]  = useState(false);
  const [customStats,  setCustomStats]  = useState(null);

  // ── Underlying-holdings accordion state ────────────────────────────────────
  const [expandedLedger, setExpandedLedger] = useState({});

  // ── Selection management ────────────────────────────────────────────────────

  const addSelection = useCallback(() => {
    setSelections(prev => {
      if (prev.length >= 4) return prev;
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      return [...prev, {
        id: uniqueId, type: 'preset', strategy: '', currency: '', profile: '',
        assetTicker: '', simulatedPortfolio: null, simulationLabel: ''
      }];
    });
  }, []);

  const removeSelection = useCallback((id) => {
    setSelections(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSelection = useCallback((id, field, value) => {
    setSelections(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };

      if (field === 'type') {
        updated.strategy = '';
        updated.profile = '';
        updated.assetTicker = '';
        updated.simulatedPortfolio = null;
        updated.simulationLabel = '';
      }
      if (field === 'strategy' || field === 'currency') {
        updated.profile = '';
      }
      if (field === 'currency' && updated.type === 'asset') {
        updated.assetTicker = '';
      }
      // Changing currency invalidates any simulated portfolio (it was built
      // from the previous currency's asset pool).
      if (field === 'currency') {
        updated.simulatedPortfolio = null;
        updated.simulationLabel = '';
      }

      return updated;
    }));
  }, []);

  const toggleLedger = useCallback((id) => {
    setExpandedLedger(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Simulation Sandbox injector ─────────────────────────────────────────────
  //
  // FIX vs. original: `currency` is read from the SELECTION (sel.currency),
  // never from an undefined outer-scope variable. The generated portfolio is
  // attached directly to the selection as `simulatedPortfolio`, and
  // `simulationLabel` is set for display. calculateSeries / structuralMetrics
  // both check `sel.simulatedPortfolio` first, before falling back to presets.
  //
  const injectSimulatedPortfolio = useCallback((selectionId, simulationType) => {
    setSelections(prev => prev.map(s => {
      if (s.id !== selectionId) return s;
      if (!s.currency) return s; // safety: no currency context to scan

      const simulated = generateSimulatedPortfolio(simulationType, s.currency, pricesData);
      if (simulated.length === 0) return s;

      const LABELS = {
        RANDOM:             'Randomized Allocation',
        BALANCED_60_40:     'Balanced (60/40 Mock)',
        AGGRESSIVE_GROWTH:  'High-Growth Equity Run',
      };

      return {
        ...s,
        type: 'simulation',
        simulatedPortfolio: simulated,
        simulationLabel: LABELS[simulationType] || 'Simulated Portfolio',
      };
    }));
  }, [pricesData]);

  // ── Resolve a selection's underlying portfolio rows ────────────────────────
  //
  // Single source of truth used by both calculateSeries and structuralMetrics:
  //   1. simulation  -> sel.simulatedPortfolio
  //   2. preset      -> presets[strategy][currency][profile]
  //   3. asset       -> [{ ticker: assetTicker, target: 100 }]
  //
  const resolvePortfolio = useCallback((sel) => {
    if (sel.type === 'simulation') {
      return sel.simulatedPortfolio || [];
    }
    if (sel.type === 'preset') {
      if (!sel.strategy || !sel.currency || !sel.profile || !presets[sel.strategy]?.[sel.currency]?.[sel.profile]) {
        return null;
      }
      return presets[sel.strategy][sel.currency][sel.profile];
    }
    // type === 'asset'
    if (!sel.currency || !sel.assetTicker) return null;
    return [{ ticker: sel.assetTicker, target: 100 }];
  }, [presets]);

  // ── Series calculation (chart line data) ────────────────────────────────────

  const calculateSeries = useCallback((sel, timeframeConfig) => {
    const portfolio = resolvePortfolio(sel);
    if (!portfolio || portfolio.length === 0) return null;

    const { source, points } = timeframeConfig;

    const parsedHistories = portfolio.map(asset => {
      const rawTicker = (asset.ticker || '').trim().toUpperCase();
      const rawIsin   = (asset.isin   || '').trim().toUpperCase();

      if (rawTicker === 'N/A' || (!rawTicker && !rawIsin)) return [];

      const actualDataKey = Object.keys(historicalData).find(key => {
        const upperKey = key.trim().toUpperCase();
        return upperKey === rawTicker || upperKey === rawIsin;
      });

      const hString = actualDataKey ? historicalData[actualDataKey]?.[source] : null;

      if (!hString || hString === 'N/A') {
        console.warn(`[GSB Analytics] Missing historical data for: "${rawTicker || rawIsin}" under: "${source}"`);
        return [];
      }
      return hString.split(';').map(v => parseFloat(v) || 0);
    });

    if (parsedHistories.every(h => h.length === 0)) return null;

    let maxAvailablePoints = points;
    parsedHistories.forEach(h => {
      if (h.length > 0 && h.length < maxAvailablePoints) {
        maxAvailablePoints = h.length;
      }
    });

    const finalPointsCount = Math.max(1, maxAvailablePoints);
    const alignedData = new Array(finalPointsCount).fill(null);
    let initialTotal = 0;

    portfolio.forEach((asset, i) => {
      const history = parsedHistories[i];
      if (!history || history.length === 0) return;
      const startIndex = Math.max(0, history.length - finalPointsCount);
      const weight = asset.target || asset.weight || 100;
      initialTotal += (history[startIndex] * (weight / 100));
    });

    if (initialTotal === 0) return null;

    for (let p = 0; p < finalPointsCount; p++) {
      let currentTotal = 0;
      let hasData = false;

      portfolio.forEach((asset, i) => {
        const history = parsedHistories[i];
        if (!history || history.length === 0) return;
        const historyIndex = history.length - finalPointsCount + p;

        if (historyIndex >= 0 && historyIndex < history.length) {
          const weight = asset.target || asset.weight || 100;
          currentTotal += (history[historyIndex] * (weight / 100));
          hasData = true;
        }
      });

      if (hasData) {
        const pctGrowth = ((currentTotal - initialTotal) / initialTotal) * 100;
        alignedData[p] = {
          growth: parseFloat(pctGrowth.toFixed(2)),
          raw: currentTotal
        };
      }
    }

    return alignedData;
  }, [historicalData, resolvePortfolio]);

  // ── Structural fundamentals (TER / volatility / underlying holdings) ───────
  //
  // FIX vs. original: pricesData is FLAT ({ [ticker]: AssetPrice }), so the
  // lookup is `pricesData[targetKey]` — NOT `pricesData[sel.currency]?.[targetKey]`.
  //
  const structuralMetrics = useMemo(() => {
    return selections.map((sel) => {
      const portfolio = resolvePortfolio(sel);
      if (!portfolio || portfolio.length === 0) return null;

      let totalWeight = 0;
      let weightedTer = 0;
      const volCounts = { 'High': 0, 'Above Average': 0, 'Average': 0, 'Below Average': 0, 'Low': 0 };
      let dynamicName = sel.type === 'simulation'
        ? (sel.simulationLabel || 'Simulated Portfolio')
        : 'Asset Strategy';
      const holdingsDetails = [];

      portfolio.forEach(asset => {
        const targetKey = asset.ticker ? asset.ticker.trim().toUpperCase() : '';
        const weight = asset.target || asset.weight || 100;

        // ── FLAT lookup (no currency nesting) ──────────────────────────────
        const assetMeta = targetKey ? pricesData[targetKey] : null;

        const itemTer  = assetMeta ? (assetMeta.ter        || 0)         : 0;
        const itemVol  = assetMeta ? (assetMeta.volatility || 'Average') : 'Average';
        const itemName = assetMeta ? assetMeta.name : (asset.name || 'Unknown Asset');

        totalWeight += weight;
        weightedTer += itemTer * weight;

        if (volCounts[itemVol] !== undefined) {
          volCounts[itemVol] += weight;
        } else {
          volCounts['Average'] += weight;
        }

        holdingsDetails.push({
          ticker:     targetKey || 'N/A',
          name:       itemName,
          weight,
          ter:        itemTer,
          volatility: itemVol
        });

        if (sel.type === 'asset' && assetMeta) dynamicName = assetMeta.name;
      });

      if (totalWeight === 0) return null;

      let dominantVol  = 'Average';
      let maxVolWeight = -1;
      Object.entries(volCounts).forEach(([key, val]) => {
        if (val > maxVolWeight) {
          maxVolWeight = val;
          dominantVol = key;
        }
      });

      return {
        id: sel.id,
        name: sel.type === 'preset' ? sel.profile : dynamicName,
        ter: totalWeight > 0 ? (weightedTer / totalWeight) : 0,
        volatility: dominantVol,
        holdings: holdingsDetails
      };
    });
  }, [selections, pricesData, resolvePortfolio]);

  // ── Chart data assembly ───────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const config = TIMEFRAMES[timeframe];
    const seriesResults = selections.map(sel => calculateSeries(sel, config));

    const validSeriesLengths = seriesResults.filter(s => s !== null).map(s => s.length);
    const actualPointsRendered = validSeriesLengths.length > 0
      ? Math.max(...validSeriesLengths)
      : config.points;

    const labels = [];
    const now = new Date();
    const isWeekly = config.source.includes('Weekly');
    const isDaily  = config.source.includes('Daily');

    for (let i = 0; i < actualPointsRendered; i++) {
      const d = new Date(now);
      if (isDaily) {
        d.setDate(d.getDate() - Math.floor((actualPointsRendered - 1 - i) * (365 / 252)));
      } else if (isWeekly) {
        d.setDate(d.getDate() - (actualPointsRendered - 1 - i) * 7);
      } else {
        d.setMonth(d.getMonth() - (actualPointsRendered - 1 - i));
      }

      if (isDaily && actualPointsRendered <= 126) {
        labels.push(d.toLocaleString('default', { month: 'short', day: 'numeric' }));
      } else {
        labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
      }
    }

    const data = [];
    for (let i = 0; i < actualPointsRendered; i++) {
      const point = { name: labels[i] };
      selections.forEach((sel, idx) => {
        const dataPoint = seriesResults[idx] && seriesResults[idx][i] ? seriesResults[idx][i] : null;
        point[`series_${idx}`] = dataPoint ? dataPoint.growth : null;
        point[`raw_${idx}`]    = dataPoint ? dataPoint.raw    : null;
      });
      data.push(point);
    }

    return data;
  }, [selections, timeframe, historicalData, pricesData, TIMEFRAMES, calculateSeries]);

  // ── Drag-to-cross-slice interaction ─────────────────────────────────────────

  const clearSelection = useCallback(() => {
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setCustomStats(null);
  }, []);

  // Reset the cross-slice selection whenever the timeframe changes
  useEffect(() => {
    clearSelection();
  }, [timeframe, clearSelection]);

  const handleMouseDown = useCallback((e) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
      setIsSelecting(true);
      setCustomStats(null);
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isSelecting && e?.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  }, [isSelecting]);

  // Resolves a human-readable name for a selection, used by both
  // handleMouseUp (custom-range stats) and finalStats (full-range stats).
  //
  // FIX vs. original: FLAT lookup `pricesData[targetKey]` instead of
  // `pricesData[sel.currency][targetKey]`.
  const resolveSelectionName = useCallback((sel) => {
    if (sel.type === 'simulation') {
      return sel.simulationLabel || 'Simulated Portfolio';
    }
    if (sel.type === 'preset') {
      return sel.profile || 'Preset';
    }
    // type === 'asset'
    const targetKey = sel.assetTicker ? sel.assetTicker.trim().toUpperCase() : '';
    return (targetKey && pricesData[targetKey]) ? pricesData[targetKey].name : 'Asset';
  }, [pricesData]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);

    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      let startIndex = chartData.findIndex(d => d.name === refAreaLeft);
      let endIndex   = chartData.findIndex(d => d.name === refAreaRight);

      if (startIndex === -1 || endIndex === -1) {
        setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
        return;
      }

      if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex];
        setRefAreaLeft(chartData[startIndex].name);
        setRefAreaRight(chartData[endIndex].name);
      }

      const stats = selections.map((sel, idx) => {
        const startRaw = chartData[startIndex]?.[`raw_${idx}`];
        const endRaw   = chartData[endIndex]?.[`raw_${idx}`];

        if (startRaw && endRaw) {
          const percentChange = ((endRaw - startRaw) / startRaw) * 100;
          return {
            id: sel.id,
            name: resolveSelectionName(sel),
            return: percentChange
          };
        }
        return null;
      }).filter(Boolean);

      setCustomStats({ start: chartData[startIndex].name, end: chartData[endIndex].name, stats });
    } else {
      setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
    }
  }, [refAreaLeft, refAreaRight, chartData, selections, resolveSelectionName]);

  // ── Final (full-range) stats ────────────────────────────────────────────────

  const finalStats = useMemo(() => {
    if (chartData.length === 0) return [];
    const lastData = chartData[chartData.length - 1];

    return selections.map((sel, idx) => ({
      id: sel.id,
      name: resolveSelectionName(sel),
      return: lastData ? lastData[`series_${idx}`] : 0
    }));
  }, [chartData, selections, resolveSelectionName]);

  const displayStats = customStats ? customStats.stats : finalStats;

  const isChartPopulated = useMemo(() => {
    return chartData.some(d =>
      Object.keys(d).some(k => k.startsWith('series_') && d[k] !== null && d[k] !== undefined)
    );
  }, [chartData]);

  // ── Ticker options for the "Individual Asset" dropdown ─────────────────────
  //
  // Sourced from the FLAT pricesData map, filtered by the selection's currency.
  const getTickerOptions = useCallback((sel) => {
    if (!sel.currency) return [];
    return Object.entries(pricesData)
      .filter(([, asset]) => asset && asset.currency === sel.currency)
      .map(([ticker, asset]) => ({ ticker, name: asset.name }));
  }, [pricesData]);

  // ── Public hook API ──────────────────────────────────────────────────────────

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

    // Simulation sandbox
    injectSimulatedPortfolio,

    // Underlying-holdings accordion
    expandedLedger,
    toggleLedger,

    // Derived data
    chartData,
    structuralMetrics,
    finalStats,
    displayStats,
    customStats,
    isChartPopulated,

    // Drag-to-cross-slice
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