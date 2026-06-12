// ─────────────────────────────────────────────────────────────────────────────
// PerformanceAnalyticsView.jsx
//
// Streamlined presentation component. ALL state, calculations, simulation
// logic, and chart-interaction handlers live in `usePerformanceMetrics`
// (PerformanceLogic.js). This component is purely declarative: it destructures
// the hook's return value and renders the UI.
//
// PRESERVED FROM ORIGINAL:
//   - Tailwind layout wrappers (header panel, series cards, chart block,
//     fundamentals breakdown grid)
//   - Recharts: <AreaChart>, <Area>, <ReferenceArea>, <Tooltip>, <CartesianGrid>,
//     <XAxis>, <YAxis>, <ResponsiveContainer>
//   - Drag-to-cross-slice interaction (mouseDown / mouseMove / mouseUp / mouseLeave)
//   - Interactive, expandable underlying-fund accordions (Asset Composition Matrix)
//
// NEW:
//   - "Sandbox Injector" dropdown per series card, wired to
//     `injectSimulatedPortfolio(sel.id, type)` from the hook — replaces the
//     broken original implementation (`currency` / `onUpdatePortfolio` were
//     undefined in the source file).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Plus, X, MousePointer2, Shield, Percent, ChevronDown, ChevronUp, Layers } from 'lucide-react';

import { usePerformanceMetrics } from './PerformanceLogic';

export default function PerformanceAnalyticsView({ presets = {}, historicalData = {}, pricesData = {}, symbol = '$' }) {

  const {
    COLORS,
    TIMEFRAMES,

    timeframe,
    setTimeframe,

    selections,
    addSelection,
    removeSelection,
    updateSelection,
    getTickerOptions,

    injectSimulatedPortfolio,

    expandedLedger,
    toggleLedger,

    chartData,
    structuralMetrics,
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-200">

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">GSB Analytics</h3>
          <p className="text-slate-500 text-xs font-medium mt-0.5 flex items-center gap-2">
            Compare strategic portfolio variance models.
            <span className="text-amber-600 font-bold flex items-center gap-1">
              <MousePointer2 size={12} /> Drag chart canvas to cross-slice return frames.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl">
            {Object.entries(TIMEFRAMES).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => setTimeframe(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeframe === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={addSelection}
            disabled={selections.length >= 4}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-all shadow-xs"
          >
            <Plus size={14} /> Compare ({selections.length}/4)
          </button>
        </div>
      </div>

      {/* Series Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {selections.map((sel, idx) => (
          <div key={sel.id} className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-xs relative flex flex-col justify-between min-h-[110px]">

            {/* Card Header: color dot, series label, remove button */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: COLORS[idx] }} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Series {idx + 1}</span>
              </div>
              {selections.length > 1 && (
                <button onClick={() => removeSelection(sel.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="space-y-1.5">

              {/* Type + Currency row */}
              <div className="flex gap-1.5">
                <select
                  className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                  value={sel.type}
                  onChange={(e) => updateSelection(sel.id, 'type', e.target.value)}
                >
                  <option value="preset">Preset Strategy</option>
                  <option value="asset">Individual Asset</option>
                  <option value="simulation">Simulated Portfolio</option>
                </select>
                <select
                  className="w-20 px-1.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
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

              {/* Sandbox Injector */}
              <div className="relative flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Sandbox:</span>
                <select
                  value=""
                  disabled={!sel.currency}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    injectSimulatedPortfolio(sel.id, e.target.value);
                    e.target.value = ''; // reset dropdown to placeholder
                  }}
                  className="flex-1 bg-brand text-white border border-brand2 rounded-lg px-2 py-1.5 text-[11px] font-medium cursor-pointer outline-none hover:bg-brand2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="" className="text-gray-700 bg-white">-- Quick Generate Portfolio --</option>
                  <option value="RANDOM" className="text-gray-700 bg-white">🎲 Fully Randomized Allocation</option>
                  <option value="BALANCED_60_40" className="text-gray-700 bg-white">⚖️ Pre-set Balanced (60/40 Mock)</option>
                  <option value="AGGRESSIVE_GROWTH" className="text-gray-700 bg-white">🚀 High-Growth Equity Run</option>
                </select>
              </div>

              {/* Type-dependent selector row */}
              {sel.type === 'preset' && (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    value={sel.strategy}
                    onChange={(e) => updateSelection(sel.id, 'strategy', e.target.value)}
                  >
                    <option value="">Select Strategy</option>
                    {Object.keys(presets).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                    disabled={!sel.strategy || !sel.currency}
                    value={sel.profile}
                    onChange={(e) => updateSelection(sel.id, 'profile', e.target.value)}
                  >
                    <option value="">Risk Profile</option>
                    {sel.strategy && sel.currency && presets[sel.strategy]?.[sel.currency] &&
                      Object.keys(presets[sel.strategy][sel.currency]).map(p => <option key={p} value={p}>{p}</option>)
                    }
                  </select>
                </div>
              )}

              {sel.type === 'asset' && (
                <select
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                  disabled={!sel.currency}
                  value={sel.assetTicker}
                  onChange={(e) => updateSelection(sel.id, 'assetTicker', e.target.value)}
                >
                  <option value="">Select Ticker…</option>
                  {getTickerOptions(sel).map(({ ticker, name }) => (
                    <option key={ticker} value={ticker}>{ticker} — {name}</option>
                  ))}
                </select>
              )}

              {sel.type === 'simulation' && (
                <div className="px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700">
                  {sel.simulatedPortfolio && sel.simulatedPortfolio.length > 0
                    ? `${sel.simulationLabel || 'Simulated Portfolio'} (${sel.simulatedPortfolio.length} holdings)`
                    : (sel.currency ? 'Use Sandbox above to generate a portfolio' : 'Select a currency first')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Block */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative">
        {isChartPopulated ? (
          <div className="space-y-4">

            {/* Return Stats Header */}
            <div className={`flex flex-wrap items-center gap-4 border-b pb-4 transition-all ${customStats ? 'border-amber-100 bg-amber-50/40 -mx-5 px-5 -mt-5 pt-5 rounded-t-2xl' : 'border-slate-100'}`}>
              <div className="w-full flex justify-between items-center">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${customStats ? 'text-amber-700' : 'text-slate-400'}`}>
                  {customStats
                    ? `Custom Return Frame: ${customStats.start} → ${customStats.end}`
                    : `Total Performance Return Overview (${TIMEFRAMES[timeframe].label})`}
                </p>
                {customStats && (
                  <button onClick={clearSelection} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border shadow-2xs px-2 py-0.5 rounded-md transition-colors">
                    ✕ Clear Delta
                  </button>
                )}
              </div>

              {displayStats.map((stat, idx) => stat && stat.return !== undefined && stat.return !== null && (
                <div key={stat.id} className={`flex-1 min-w-[100px] ${idx > 0 ? 'border-l border-slate-100 pl-4' : ''}`}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                    {stat.name}
                  </p>
                  <p className={`text-xl font-bold tracking-tight ${stat.return >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stat.return >= 0 ? '+' : ''}{stat.return.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>

            {/* Recharts AreaChart */}
            <div className="w-full h-[380px] min-w-0 select-none cursor-crosshair">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    {selections.map((sel, idx) => (
                      <linearGradient key={`grad_${idx}`} id={`color_${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={COLORS[idx]} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={COLORS[idx]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />

                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dy={10}
                    interval={Math.max(1, Math.floor(chartData.length / 7))}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `${val}%`}
                  />

                  {!isSelecting && (
                    <Tooltip
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 min-w-[180px] pointer-events-none text-xs">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-800 pb-1.5">
                                {payload[0].payload.name}
                              </p>
                              <div className="space-y-2">
                                {payload.map((entry, idx) => {
                                  if (!entry || entry.value === null || entry.value === undefined) return null;
                                  return (
                                    <div key={idx} className="flex justify-between items-center gap-4">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                                        <span className="text-slate-300 truncate max-w-[100px]">
                                          {finalStats[idx]?.name || `Series ${idx + 1}`}
                                        </span>
                                      </div>
                                      <span className={`font-bold ${entry.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {entry.value}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  )}

                  {selections.map((sel, idx) => (
                    <Area
                      key={sel.id}
                      type="monotone"
                      dataKey={`series_${idx}`}
                      stroke={COLORS[idx]}
                      fill={`url(#color_${idx})`}
                      strokeWidth={idx === 0 ? 2.5 : 2}
                      strokeDasharray={idx > 0 ? '4 4' : '0'}
                      animationDuration={150}
                      connectNulls={true}
                    />
                  ))}

                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0f172a" fillOpacity={0.07} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Strategy Fundamentals Breakdown */}
            <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Strategy Fundamentals Breakdown
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {structuralMetrics.map((metrics, idx) => {
                  if (!metrics) return null;
                  const isOpen = !!expandedLedger[metrics.id];

                  return (
                    <div
                      key={metrics.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/30 overflow-hidden flex flex-col justify-between transition-all"
                    >
                      {/* Summary Header Card */}
                      <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }} />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Series {idx + 1}</span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-800 truncate" title={metrics.name}>
                            {metrics.name}
                          </h5>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-0.5 justify-end">
                              <Percent size={10} /> Blended TER
                            </span>
                            <p className="text-xs font-bold text-slate-900">{metrics.ter.toFixed(2)}%</p>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-0.5 justify-end">
                              <Shield size={10} /> Profile
                            </span>
                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold rounded-md border mt-0.5 ${getVolBadgeStyles(metrics.volatility)}`}>
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

                      {/* Granular Fund Distribution Ledger Accordion */}
                      {isOpen && (
                        <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200/60">
                            <Layers size={11} /> Asset Composition Matrix ({metrics.holdings.length})
                          </div>
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                            {metrics.holdings.map((fund, fIdx) => (
                              <div key={fIdx} className="bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1 py-0.25 rounded">
                                      {fund.ticker}
                                    </span>
                                    <span className={`text-[9px] font-medium px-1 rounded-sm border ${getVolBadgeStyles(fund.volatility)}`}>
                                      {fund.volatility}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-semibold text-slate-700 truncate" title={fund.name}>
                                    {fund.name}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[11px] font-extrabold text-slate-900">{fund.weight}%</p>
                                  <p className="text-[10px] font-medium text-slate-400">TER: {fund.ter.toFixed(2)}%</p>
                                </div>
                              </div>
                            ))}
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
          <div className="h-[320px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <TrendingUp size={32} className="text-slate-300 mb-2 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Awaiting Valid Series Alignment</p>
            <p className="text-[11px] text-slate-400 mt-1 text-center max-w-md">
              Confirm your selected presets contain exact matching ticker codes as saved inside the history tables.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}