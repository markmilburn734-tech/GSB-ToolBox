// ─────────────────────────────────────────────────────────────────────────────
// PerformanceAnalyticsView.jsx  —  v4 (FE Analytics Edition)
//
// Strictly declarative presentation layer. All state and logic is consumed
// from `usePerformanceMetrics` (PerformanceLogic.js).
//
// UPGRADE SUMMARY (v3 → v4):
//   1. Sandbox Injector REMOVED. "Simulated Portfolio" type REMOVED.
//   2. NEW: Custom Portfolio Builder sub-panel (type === 'custom'):
//        - Ticker add dropdown (currency-filtered)
//        - Weight % input per holding
//        - Live weight-sum validation badge (green = 100%, red/amber otherwise)
//        - Remove holding button
//   3. Chart upgraded to <LineChart> with thin crisp lines (professional
//      terminal aesthetic), very light fill (Area with low opacity),
//      and a crosshair tooltip displaying both % return and index level.
//   4. Factsheet accordion table: 5 columns —
//        Ticker | Fund Name | Alloc % | Asset TER % | Weighted Contribution
//   5. FE Analytics status badges per series:
//        Cumulative Return | Annualized Volatility | Net Cost (Weighted TER)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Plus,
  X,
  MousePointer2,
  Shield,
  Percent,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';

import { usePerformanceMetrics } from './PerformanceLogic';

// ─── Small pure-presentational sub-components ────────────────────────────────

/**
 * Weight validation pill shown inside the Custom Portfolio Builder.
 */
function WeightPill({ total }) {
  const diff    = Math.abs(total - 100);
  const perfect = diff <= 0.1;
  const over    = total > 100.1;

  if (perfect) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
        <CheckCircle2 size={10} /> {total.toFixed(1)}% — Allocated
      </span>
    );
  }
  if (over) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
        <AlertTriangle size={10} /> {total.toFixed(1)}% — Over-allocated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
      <AlertTriangle size={10} /> {total.toFixed(1)}% — Under-allocated
    </span>
  );
}

/**
 * FE Analytics-style status badge strip for a single series.
 */
function SeriesStatusBadges({ stats, color }) {
  if (!stats || !stats.hasData) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          stats.cumReturn >= 0
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
      >
        <TrendingUp size={9} />
        {stats.cumReturn >= 0 ? '+' : ''}{stats.cumReturn.toFixed(2)}% Total Return
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
        <Activity size={9} />
        {stats.annualVol.toFixed(2)}% Ann. Vol
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-200">
        <BarChart2 size={9} />
        {stats.weightedTer.toFixed(3)}% Net Cost
      </span>
    </div>
  );
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────

function AnalyticsTooltip({ active, payload, finalStats, COLORS }) {
  if (!active || !payload || !payload.length) return null;
  const label = payload[0]?.payload?.name;

  return (
    <div className="bg-[#0f172a] text-white p-3 rounded-xl shadow-2xl border border-slate-700/60 min-w-[200px] pointer-events-none text-xs font-mono">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, idx) => {
          if (entry.value === null || entry.value === undefined) return null;
          const pctKey = `pct_${idx}`;
          const pct    = entry.payload?.[pctKey];
          const sign   = pct !== null && pct !== undefined && pct >= 0 ? '+' : '';
          return (
            <div key={idx} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                <span className="text-slate-300 truncate max-w-[90px] text-[10px]">
                  {finalStats[idx]?.name || `Series ${idx + 1}`}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-slate-400 text-[9px] mr-1.5">
                  {entry.value.toFixed(2)}
                </span>
                <span className={`font-bold text-[11px] ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sign}{pct !== null && pct !== undefined ? pct.toFixed(2) : '—'}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PerformanceAnalyticsView({
  presets       = {},
  historicalData = {},
  pricesData    = {},
  symbol        = '$',
}) {
  const {
    COLORS,
    TIMEFRAMES,

    timeframe,
    setTimeframe,
    costs,
    setCosts,
    totalDrag,

    selections,
    addSelection,
    removeSelection,
    updateSelection,
    getTickerOptions,

    addCustomHolding,
    removeCustomHolding,
    updateCustomHolding,
    customPortfolioWeight,

    expandedLedger,
    toggleLedger,

    chartData,
    structuralMetrics,
    seriesSummaryStats,
    finalStats,
    displayStats,
    customStats,
    isChartPopulated,

    refAreaLeft,
    refAreaRight,
    isSelecting,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelection,

    getVolBadgeStyles,
  } = usePerformanceMetrics({ presets, historicalData, pricesData });

  // Live return for the slice currently being dragged (shown as a floating badge).
  const tLabels = {};
  chartData.forEach((d) => { tLabels[d.t] = d.name; });

  const dragSlice = (() => {
    if (!isSelecting || !refAreaLeft || !refAreaRight || refAreaLeft === refAreaRight) return null;
    let s = chartData.findIndex(d => d.t === refAreaLeft);
    let e = chartData.findIndex(d => d.t === refAreaRight);
    if (s < 0 || e < 0) return null;
    if (s > e) [s, e] = [e, s];
    const stats = selections.map((sel, idx) => {
      const sr = chartData[s]?.[`raw_${idx}`];
      const er = chartData[e]?.[`raw_${idx}`];
      return (sr && er) ? { idx, name: finalStats[idx]?.name || `Series ${idx + 1}`, ret: (er / sr - 1) * 100 } : null;
    }).filter(Boolean);
    return { start: chartData[s].name, end: chartData[e].name, stats };
  })();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-200">

      {/* ── Header (plain, matches other views) ──────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">GSB Analytics</h3>
          <p className="text-slate-500 text-xs font-medium mt-0.5 flex items-center gap-2">
            Net-of-fees performance comparison · Normalized base-100 index
            <span className="text-amber-600 font-bold flex items-center gap-1">
              <MousePointer2 size={12} /> Drag chart to cross-slice return frames.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Timeframe selector */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl">
            {Object.entries(TIMEFRAMES).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => setTimeframe(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeframe === key
                    ? 'bg-white/75 backdrop-blur-sm text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={addSelection}
            disabled={selections.length >= 4}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-all shadow-sm"
          >
            <Plus size={14} /> Compare ({selections.length}/4)
          </button>
        </div>
      </div>

      {/* ── Cost adjustments (advice fees not in fund prices) ─────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/75 backdrop-blur-sm px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Advice costs (p.a.)</span>
        {[['advisor', 'Advisor'], ['platform', 'Platform'], ['trustee', 'Trustee (pensions)']].map(([k, label]) => (
          <label key={k} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            {label}
            <span className="relative w-16">
              <input type="number" step={0.05} value={costs[k]}
                onChange={(e) => setCosts({ ...costs, [k]: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full pl-2 pr-5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-slate-400" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">%</span>
            </span>
          </label>
        ))}
        <span className="text-[11px] font-bold text-slate-400 ml-auto">Applied drag: <span className="text-brand3">{totalDrag.toFixed(2)}% p.a.</span></span>
      </div>

      {/* ── Series Selector Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {selections.map((sel, idx) => {
          const tickerOpts   = getTickerOptions(sel);
          const customTotal  = customPortfolioWeight(sel);
          const summaryStats = seriesSummaryStats[idx];

          return (
            <div
              key={sel.id}
              className="p-3.5 rounded-2xl border border-slate-100 bg-white/75 backdrop-blur-sm shadow-sm relative flex flex-col gap-2"
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Series {idx + 1}
                  </span>
                </div>
                {selections.length > 1 && (
                  <button
                    onClick={() => removeSelection(sel.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Type + Currency row */}
              <div className="flex gap-1.5">
                <select
                  className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                  value={sel.type}
                  onChange={(e) => updateSelection(sel.id, 'type', e.target.value)}
                >
                  <option value="preset">Preset Strategy</option>
                  <option value="asset">Individual Asset</option>
                  <option value="custom">Custom Portfolio</option>
                </select>
                <select
                  className="w-[72px] px-1.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                  value={sel.currency}
                  onChange={(e) => updateSelection(sel.id, 'currency', e.target.value)}
                >
                  <option value="">Curr</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>

              {/* ── Preset sub-selectors ──────────────────────────────────── */}
              {sel.type === 'preset' && (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    value={sel.strategy}
                    onChange={(e) => updateSelection(sel.id, 'strategy', e.target.value)}
                  >
                    <option value="">Strategy</option>
                    {Object.keys(presets).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                    disabled={!sel.strategy || !sel.currency}
                    value={sel.profile}
                    onChange={(e) => updateSelection(sel.id, 'profile', e.target.value)}
                  >
                    <option value="">Risk Profile</option>
                    {sel.strategy && sel.currency && presets[sel.strategy]?.[sel.currency] &&
                      Object.keys(presets[sel.strategy][sel.currency]).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* ── Individual Asset sub-selector ────────────────────────── */}
              {sel.type === 'asset' && (
                <select
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                  disabled={!sel.currency}
                  value={sel.assetTicker}
                  onChange={(e) => updateSelection(sel.id, 'assetTicker', e.target.value)}
                >
                  <option value="">Select Ticker…</option>
                  {tickerOpts.map(({ ticker, name }) => (
                    <option key={ticker} value={ticker}>{ticker} — {name}</option>
                  ))}
                </select>
              )}

              {/* ── Custom Portfolio Builder ──────────────────────────────── */}
              {sel.type === 'custom' && (
                <div className="space-y-2">
                  {/* Add ticker dropdown */}
                  <select
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                    disabled={!sel.currency}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      addCustomHolding(sel.id, e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">+ Add holding…</option>
                    {tickerOpts
                      .filter(({ ticker }) => !sel.customPortfolio.some(h => h.ticker === ticker))
                      .map(({ ticker, name }) => (
                        <option key={ticker} value={ticker}>{ticker} — {name}</option>
                      ))
                    }
                  </select>

                  {/* Holdings list */}
                  {sel.customPortfolio.length > 0 && (
                    <div className="space-y-1">
                      {sel.customPortfolio.map(holding => (
                        <div
                          key={holding.ticker}
                          className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-1"
                        >
                          <span className="font-mono text-[10px] font-bold text-slate-600 w-16 shrink-0 truncate">
                            {holding.ticker}
                          </span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder="0"
                              value={holding.weight === 0 ? '' : holding.weight}
                              onChange={(e) =>
                                updateCustomHolding(sel.id, holding.ticker, 'weight', e.target.value)
                              }
                              className="w-full pr-5 pl-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800 outline-none focus:border-slate-400"
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">
                              %
                            </span>
                          </div>
                          <button
                            onClick={() => removeCustomHolding(sel.id, holding.ticker)}
                            className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weight validation */}
                  {sel.customPortfolio.length > 0 && (
                    <WeightPill total={customTotal} />
                  )}

                  {sel.customPortfolio.length === 0 && sel.currency && (
                    <p className="text-[10px] text-slate-400 italic">
                      Select tickers above to build your portfolio.
                    </p>
                  )}
                  {!sel.currency && (
                    <p className="text-[10px] text-slate-400 italic">
                      Select a currency to see available tickers.
                    </p>
                  )}
                </div>
              )}

              {/* FE Analytics status badges */}
              <SeriesStatusBadges stats={summaryStats} color={COLORS[idx]} />
            </div>
          );
        })}
      </div>

      {/* ── Chart Block ───────────────────────────────────────────────────── */}
      <div className="bg-white/75 backdrop-blur-sm p-5 rounded-2xl border border-slate-100 shadow-sm relative">
        {isChartPopulated ? (
          <div className="space-y-5">

            {/* Return summary header */}
            <div
              className={`flex flex-wrap items-center gap-4 border-b pb-4 transition-all ${
                customStats
                  ? 'border-amber-100 bg-amber-50/40 -mx-5 px-5 -mt-5 pt-5 rounded-t-2xl'
                  : 'border-slate-100'
              }`}
            >
              <div className="w-full flex justify-between items-center">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${customStats ? 'text-amber-700' : 'text-slate-400'}`}>
                  {customStats
                    ? `Custom Return Frame: ${customStats.start} → ${customStats.end}`
                    : `Net-of-Fees Performance — Base 100 Index (${TIMEFRAMES[timeframe].label})`}
                </p>
                {customStats && (
                  <button
                    onClick={clearSelection}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white/75 backdrop-blur-sm border shadow-sm px-2 py-0.5 rounded-md transition-colors"
                  >
                    ✕ Clear Delta
                  </button>
                )}
              </div>

              {displayStats.map((stat, idx) => {
                if (!stat || stat.return === null || stat.return === undefined) return null;
                return (
                  <div
                    key={stat.id}
                    className={`flex-1 min-w-[100px] ${idx > 0 ? 'border-l border-slate-100 pl-4' : ''}`}
                  >
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                      {stat.name}
                    </p>
                    <p className={`text-xl font-bold tracking-tight ${stat.return >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.return >= 0 ? '+' : ''}{stat.return.toFixed(2)}%
                    </p>
                  </div>
                );
              })}
            </div>

            {/* ── Recharts ComposedChart: crisp lines + ghost area fills ───── */}
            <div className="w-full h-[420px] min-w-0 select-none cursor-crosshair relative">
              {dragSlice && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-[#0f172a] text-white rounded-lg px-3 py-1.5 shadow-xl text-xs font-mono pointer-events-none flex items-center gap-2 whitespace-nowrap">
                  <span className="text-slate-400">{dragSlice.start} → {dragSlice.end}</span>
                  {dragSlice.stats.map((s) => (
                    <span key={s.idx} className="font-bold" style={{ color: COLORS[s.idx] }}>{s.ret >= 0 ? '+' : ''}{s.ret.toFixed(1)}%</span>
                  ))}
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    {selections.map((sel, idx) => (
                      <linearGradient key={`grad_${idx}`} id={`fill_${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={COLORS[idx]} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={COLORS[idx]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Faint gridlines — horizontal at every % tick, light verticals */}
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="#cbd5e1"
                    strokeOpacity={0.55}
                    vertical
                    syncWithTicks
                  />

                  {/* Base-100 reference line */}
                  <ReferenceLine
                    y={100}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                  />

                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => tLabels[t] ?? ''}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    dy={8}
                    interval={Math.max(1, Math.floor(chartData.length / 8))}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${v - 100 >= 0 ? '+' : ''}${(v - 100).toFixed(0)}%`}
                    width={48}
                    domain={['auto', 'auto']}
                    tickCount={9}
                    allowDecimals={false}
                  />

                  {/* Crosshair tooltip (suppressed during drag selection) */}
                  {!isSelecting && (
                    <Tooltip
                      cursor={{
                        stroke: '#64748b',
                        strokeWidth: 1,
                        strokeDasharray: '3 3',
                      }}
                      content={
                        <AnalyticsTooltip finalStats={finalStats} COLORS={COLORS} />
                      }
                    />
                  )}

                  {/* Ghost area fills — very low opacity for depth */}
                  {selections.map((sel, idx) => (
                    <Area
                      key={`area_${sel.id}`}
                      type="monotone"
                      dataKey={`series_${idx}`}
                      stroke="none"
                      fill={`url(#fill_${idx})`}
                      fillOpacity={1}
                      isAnimationActive={false}
                      connectNulls
                      legendType="none"
                      activeDot={false}
                    />
                  ))}

                  {/* Crisp precision line plots */}
                  {selections.map((sel, idx) => (
                    <Line
                      key={`line_${sel.id}`}
                      type="monotone"
                      dataKey={`series_${idx}`}
                      stroke={COLORS[idx]}
                      strokeWidth={idx === 0 ? 2 : 1.5}
                      strokeDasharray={idx > 0 ? '5 3' : '0'}
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: COLORS[idx],
                        stroke: '#fff',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}

                  {/* Drag-select reference band */}
                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea
                      x1={refAreaLeft}
                      x2={refAreaRight}
                      fill="#9966ff"
                      fillOpacity={0.12}
                      stroke="#9966ff"
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── Strategy Fundamentals Breakdown (FE Factsheet) ─────────── */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Strategy Fundamentals — Net Cost Factsheet
              </h4>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {structuralMetrics.map((metrics, idx) => {
                  if (!metrics) return null;
                  const isOpen = !!expandedLedger[metrics.id];

                  return (
                    <div
                      key={metrics.id}
                      className="rounded-xl border border-slate-100 bg-white/75 backdrop-blur-sm overflow-hidden transition-all shadow-sm"
                    >
                      {/* Summary header */}
                      <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-slate-100">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[idx] }}
                            />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                              Series {idx + 1}
                            </span>
                          </div>
                          <h5
                            className="text-xs font-bold text-slate-800 truncate"
                            title={metrics.name}
                          >
                            {metrics.name}
                          </h5>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Blended TER badge */}
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-0.5 justify-end">
                              <Percent size={9} /> Net Cost
                            </p>
                            <p className="text-sm font-bold text-slate-900 font-mono">
                              {metrics.ter.toFixed(3)}%
                            </p>
                          </div>

                          {/* Volatility profile badge */}
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-0.5 justify-end">
                              <Shield size={9} /> Profile
                            </p>
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold rounded-md border mt-0.5 ${getVolBadgeStyles(metrics.volatility)}`}
                            >
                              {metrics.volatility}
                            </span>
                          </div>

                          <button
                            onClick={() => toggleLedger(metrics.id)}
                            className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors"
                          >
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable factsheet table */}
                      {isOpen && (
                        <div className="p-3 bg-slate-50/40 animate-in slide-in-from-top-1 duration-150">
                          {/* Table header */}
                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-200/70">
                            <Layers size={10} className="shrink-0" />
                            <span>Asset Composition — {metrics.holdings.length} Holdings</span>
                          </div>

                          {/* 5-column factsheet header row */}
                          <div className="grid grid-cols-[80px_1fr_52px_52px_64px] gap-x-2 px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 mb-1">
                            <span>Ticker</span>
                            <span>Fund Name</span>
                            <span className="text-right">Alloc %</span>
                            <span className="text-right">TER %</span>
                            <span className="text-right">Wtd. Cost</span>
                          </div>

                          {/* Holding rows */}
                          <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
                            {metrics.holdings.map((fund, fIdx) => (
                              <div
                                key={fIdx}
                                className="grid grid-cols-[80px_1fr_52px_52px_64px] gap-x-2 items-center px-2 py-1.5 bg-white/75 backdrop-blur-sm rounded-lg border border-slate-100 text-xs hover:bg-slate-50 transition-colors"
                              >
                                {/* Ticker */}
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1 py-0.5 rounded truncate max-w-full">
                                    {fund.ticker}
                                  </span>
                                </div>

                                {/* Fund name + volatility badge */}
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <p
                                    className="text-[11px] font-semibold text-slate-700 truncate"
                                    title={fund.name}
                                  >
                                    {fund.name}
                                  </p>
                                  <span
                                    className={`hidden md:inline-block shrink-0 text-[8px] font-bold px-1 py-0.5 rounded border ${getVolBadgeStyles(fund.volatility)}`}
                                  >
                                    {fund.volatility}
                                  </span>
                                </div>

                                {/* Allocation % */}
                                <p className="text-right font-mono text-[11px] font-bold text-slate-800">
                                  {fund.weight.toFixed(1)}%
                                </p>

                                {/* Asset TER % */}
                                <p className="text-right font-mono text-[11px] text-slate-500">
                                  {fund.ter.toFixed(3)}%
                                </p>

                                {/* Weighted TER contribution */}
                                <p className="text-right font-mono text-[11px] font-bold text-violet-700">
                                  {(fund.weightedTerContrib ?? (fund.ter * fund.weight / 100)).toFixed(4)}%
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Totals footer */}
                          <div className="grid grid-cols-[80px_1fr_52px_52px_64px] gap-x-2 px-2 py-1.5 mt-1 border-t border-slate-200 text-[10px] font-bold text-slate-700">
                            <span className="text-slate-400 col-span-2">Portfolio Total</span>
                            <span className="text-right font-mono">
                              {metrics.holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)}%
                            </span>
                            <span className="text-right font-mono text-slate-400">—</span>
                            <span className="text-right font-mono text-violet-700">
                              {metrics.ter.toFixed(4)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          /* ── Empty state ──────────────────────────────────────────────── */
          <div className="h-[360px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <TrendingUp size={36} className="text-slate-300 mb-3 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Awaiting Valid Series Configuration
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5 text-center max-w-sm">
              Configure a Preset Strategy, Individual Asset, or Custom Portfolio above.
              Custom portfolios require weights summing to exactly 100%.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}