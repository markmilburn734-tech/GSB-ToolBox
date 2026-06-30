// ─────────────────────────────────────────────────────────────────────────────
// MarketPulseView.jsx — asset explorer
//
// Left:  searchable / filterable / sortable list of the active currency's assets.
// Right: detail panel — price, 52-week pulse, TER / volatility / class / region,
//        and multi-timeframe returns (3M / 6M / YTD / 1Y) from the dated history.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { getVolBadgeStyles } from './PerformanceLogic';

// Compact return-over-timeframe from a { dates, prices } history series.
function returnOver(series, key) {
  if (!series || !series.prices || series.prices.length < 2) return null;
  const { dates, prices } = series;
  const end = dates[dates.length - 1];
  const d = new Date(end);
  let startMs;
  if (key === 'ytd')      startMs = new Date(d.getFullYear(), 0, 1).getTime();
  else if (key === '3m')  { const x = new Date(end); x.setMonth(x.getMonth() - 3); startMs = x.getTime(); }
  else if (key === '6m')  { const x = new Date(end); x.setMonth(x.getMonth() - 6); startMs = x.getTime(); }
  else                    { const x = new Date(end); x.setFullYear(x.getFullYear() - 1); startMs = x.getTime(); }

  let base = null;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] <= startMs) base = prices[i];
    else break;
  }
  if (base == null) base = prices.find(p => p > 0) ?? null;
  const last = prices[prices.length - 1];
  if (!(base > 0) || !(last > 0)) return null;
  return (last / base - 1) * 100;
}

const TF = [['3m', '3M'], ['6m', '6M'], ['ytd', 'YTD'], ['1y', '1Y']];

export default function MarketPulseView({ data, historicalData = {}, symbol, currency }) {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [search,      setSearch]      = useState('');
  const [sortBy,      setSortBy]      = useState('name');   // name | price | offHigh
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterRegion,setFilterRegion]= useState('ALL');

  const currencyData = data[currency] || {};

  // Reset the picked asset when the currency changes / data arrives.
  useEffect(() => {
    const keys = Object.keys(currencyData);
    setSelectedTicker((prev) => (prev && currencyData[prev] ? prev : (keys[0] ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, data]);

  const classes = useMemo(
    () => ['ALL', ...Array.from(new Set(Object.values(currencyData).map(a => a.assetClass || 'Other'))).sort()],
    [currencyData],
  );
  const regions = useMemo(
    () => ['ALL', ...Array.from(new Set(Object.values(currencyData).map(a => a.region || 'Global'))).sort()],
    [currencyData],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = Object.entries(currencyData).map(([ticker, a]) => ({ ticker, ...a }));
    if (q) rows = rows.filter(r => r.ticker.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q) || (r.isin || '').toLowerCase().includes(q));
    if (filterClass !== 'ALL')  rows = rows.filter(r => (r.assetClass || 'Other') === filterClass);
    if (filterRegion !== 'ALL') rows = rows.filter(r => (r.region || 'Global') === filterRegion);
    rows.sort((x, y) => {
      if (sortBy === 'price')   return (y.price || 0) - (x.price || 0);
      if (sortBy === 'offHigh') return (y.pct_off_high || 0) - (x.pct_off_high || 0);
      return (x.name || '').localeCompare(y.name || '');
    });
    return rows;
  }, [currencyData, search, filterClass, filterRegion, sortBy]);

  const activeAsset = currencyData[selectedTicker];
  const hist = selectedTicker ? historicalData[selectedTicker] : null;
  const series = hist?.Daily_1Y;

  const fmt = (v, dp = 2) => (v == null ? '—' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Market Explorer</h2>
        <p className="text-gray-500 text-sm">
          Browse <span className="font-bold text-brand">{currency}</span> assets — search, filter and drill into each one.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ticker or ISIN…"
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-brand"
        />
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 outline-none">
          {classes.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All classes' : c}</option>)}
        </select>
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 outline-none">
          {regions.map(r => <option key={r} value={r}>{r === 'ALL' ? 'All regions' : r}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 outline-none">
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price</option>
          <option value="offHigh">Sort: % off high</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: list */}
        <div className="lg:col-span-4 space-y-2 max-h-[640px] overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">{visible.length} assets</p>
          {visible.length === 0 ? (
            <p className="text-gray-400 italic p-2">No matches.</p>
          ) : (
            visible.map((info) => {
              const isSelected = selectedTicker === info.ticker;
              return (
                <button
                  key={info.ticker}
                  onClick={() => setSelectedTicker(info.ticker)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected ? 'border-brand3 bg-brand3/5 shadow-sm ring-1 ring-brand3' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-brand3' : 'text-brand6'}`}>{info.ticker}</span>
                      <h4 className="font-bold text-gray-800 truncate text-sm">{info.name}</h4>
                      <span className="text-[10px] text-gray-400">{info.assetClass || 'Other'} · {info.region || 'Global'}</span>
                    </div>
                    <span className="font-mono font-bold text-gray-600 shrink-0">{symbol}{fmt(info.price)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: detail */}
        <div className="lg:col-span-8">
          {activeAsset ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm sticky top-32">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-brand3/10 text-brand3 text-[10px] font-black uppercase mb-3">Asset Overview</span>
                  <h3 className="text-3xl font-bold text-gray-900 leading-tight">{activeAsset.name}</h3>
                  <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand3/5 border border-brand3/10">
                    <span className="text-[10px] font-bold text-brand6 uppercase tracking-widest">ISIN</span>
                    <span className="text-xs font-black text-brand3 font-mono">{activeAsset.isin}</span>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-4xl font-mono font-bold text-brand tracking-tighter">{symbol}{fmt(activeAsset.price)}</div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">Price as of {activeAsset.date}</p>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">TER / OCR</p>
                  <p className="text-lg font-bold text-gray-800 font-mono">{fmt(activeAsset.ter, 3)}%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">Volatility</p>
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border mt-0.5 ${getVolBadgeStyles(activeAsset.volatility)}`}>{activeAsset.volatility}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">Class</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{activeAsset.assetClass || 'Other'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">Region</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{activeAsset.region || 'Global'}</p>
                </div>
              </div>

              {/* Multi-timeframe returns */}
              <div className="mb-8">
                <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-2">Total Return</p>
                <div className="grid grid-cols-4 gap-3">
                  {TF.map(([key, label]) => {
                    const r = returnOver(series, key);
                    return (
                      <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{label}</p>
                        <p className={`text-base font-bold font-mono ${r == null ? 'text-gray-300' : r >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-gray-100 w-full mb-8" />

              {/* 52-week range + pulse */}
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">52-Week Range</p>
                    <p className="text-xl font-bold text-gray-800">
                      {symbol}{fmt(activeAsset.low_52)}<span className="text-gray-300 font-light mx-2">—</span>{symbol}{fmt(activeAsset.high_52)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">Off Yearly High</p>
                    <p className={`text-xl font-bold ${activeAsset.pct_off_high < 2 ? 'text-amber-500' : 'text-emerald-500'}`}>{fmt(activeAsset.pct_off_high)}%</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                    <div
                      className="h-full bg-brand3 transition-all duration-1000 ease-out"
                      style={{
                        width: `${activeAsset.high_52 > activeAsset.low_52
                          ? Math.min(Math.max(((activeAsset.price - activeAsset.low_52) / (activeAsset.high_52 - activeAsset.low_52)) * 100, 0), 100)
                          : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-3 text-[9px] font-black text-brand6 uppercase tracking-tighter">
                    <span>Yearly Low</span><span className="text-brand3">Current Position</span><span>Yearly High</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
              <p className="text-gray-400 font-medium">Select an asset from the list to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
