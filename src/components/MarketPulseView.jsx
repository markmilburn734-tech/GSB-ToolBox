// ─────────────────────────────────────────────────────────────────────────────
// MarketPulseView.jsx — market pulse + asset explorer
//
// Top:   a scrolling movers ticker, then sector and region performance boards,
//        all driven by one timeframe selector (3M / 6M / YTD / 1Y).
// Below: the searchable / filterable asset list and the detail panel.
//
// CURRENCY IS A FILTER HERE, not the global top-right selector — this view
// defaults to "All currencies" so the whole roster can be seen at once. The
// global selector still drives the investment tabs; it just doesn't gate this
// one any more.
//
// ⚠️ Returns are computed in each asset's OWN currency, because the history feed
// is native-currency and we only hold TODAY's FX — there is no historical FX to
// convert a past return with. So a USD asset's number is its USD return. Mixing
// currencies on one board is therefore approximate, and the UI says so.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { getVolBadgeStyles, stitchDiscontinuities } from './PerformanceLogic';
import { CURRENCY_SYMBOLS } from '../constants';

const TF = [['3m', '3M'], ['6m', '6M'], ['ytd', 'YTD'], ['1y', '1Y']];

/** Sector is only meaningful for single companies; funds and ETFs carry these. */
const NON_SECTORS = new Set(['mixed', 'unclassified', 'n/a', '']);

// ─── Return maths ────────────────────────────────────────────────────────────

/** Window start for a timeframe, anchored to the series' own last date. */
function windowStart(endMs, key) {
  const d = new Date(endMs);
  if (key === 'ytd') return new Date(d.getFullYear(), 0, 1).getTime();
  if (key === '3m') { d.setMonth(d.getMonth() - 3); return d.getTime(); }
  if (key === '6m') { d.setMonth(d.getMonth() - 6); return d.getTime(); }
  d.setFullYear(d.getFullYear() - 1);
  return d.getTime();
}

/**
 * Percentage return over a timeframe from an ALREADY-STITCHED series.
 * Split out from the stitching so a whole-roster sweep stitches each series
 * once rather than once per timeframe.
 */
function returnFrom(dates, prices, key) {
  if (!dates?.length || dates.length < 2) return null;
  const startMs = windowStart(dates[dates.length - 1], key);
  let base = null;
  for (let i = 0; i < dates.length; i += 1) {
    if (dates[i] <= startMs) base = prices[i];
    else break;
  }
  if (base == null) base = prices.find((p) => p > 0) ?? null;
  const last = prices[prices.length - 1];
  if (!(base > 0) || !(last > 0)) return null;
  return (last / base - 1) * 100;
}

const pct = (v, dp = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`);
const toneOf = (v) => (v == null ? 'text-gray-300' : v >= 0 ? 'text-emerald-600' : 'text-rose-600');

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Groups rows by a field and returns equal-weighted mean + median + spread.
 *
 * Equal-weighted because we have no AUM or market caps — every holding counts
 * once. `n` is surfaced on every row: several regions hold only one or two
 * assets, and a mean over n=2 is a data point, not a trend.
 */
function groupPerformance(rows, field, key) {
  const buckets = new Map();
  rows.forEach((r) => {
    const v = r.perf?.[key];
    if (v == null) return;
    const g = r[field] || 'Unclassified';
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push({ v, name: r.name, ticker: r.ticker });
  });

  return [...buckets.entries()].map(([group, members]) => {
    const vals = members.map((m) => m.v).sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const mid = Math.floor(vals.length / 2);
    const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    const best = members.reduce((a, m) => (m.v > a.v ? m : a), members[0]);
    const worst = members.reduce((a, m) => (m.v < a.v ? m : a), members[0]);
    return { group, n: vals.length, mean, median, best, worst };
  }).sort((a, b) => b.mean - a.mean);
}

// ─── Presentational bits ─────────────────────────────────────────────────────

function MoverChip({ row, symbol, onClick }) {
  const v = row.value;
  const up = v >= 0;
  return (
    <button
      onClick={onClick}
      title={`${row.name} · ${row.ticker}`}
      className="shrink-0 flex items-center gap-2.5 px-3.5 py-2 mx-1 rounded-xl border border-gray-200 bg-white/85 hover:border-brand transition-colors"
    >
      <span className="text-[10px] font-black tracking-tighter text-brand6">{row.ticker}</span>
      <span className="text-xs font-semibold text-gray-700 max-w-[150px] truncate">{row.name}</span>
      <span className="text-[10px] font-mono text-gray-400">{symbol}{row.price}</span>
      <span className={`text-xs font-mono font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '▲' : '▼'} {pct(v)}
      </span>
    </button>
  );
}

/** Diverging bar: zero in the middle, gains right, losses left. */
function PerfBar({ row, max, onPick }) {
  const scale = max > 0 ? Math.min(Math.abs(row.mean) / max, 1) * 50 : 0;
  const up = row.mean >= 0;
  return (
    <button
      onClick={() => onPick?.(row)}
      className="w-full text-left group py-1.5"
      title={`${row.n} asset${row.n === 1 ? '' : 's'} · median ${pct(row.median)} · best ${row.best.name} ${pct(row.best.v)} · worst ${row.worst.name} ${pct(row.worst.v)}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700 truncate group-hover:text-brand">
          {row.group}
          <span className={`ml-1.5 text-[10px] font-mono ${row.n < 3 ? 'text-amber-500' : 'text-gray-300'}`}>
            n={row.n}
          </span>
        </span>
        <span className={`text-xs font-mono font-bold ${toneOf(row.mean)}`}>{pct(row.mean)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 z-10" />
        <div
          className={`absolute inset-y-0 ${up ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={up
            ? { left: '50%', width: `${scale}%` }
            : { right: '50%', width: `${scale}%` }}
        />
      </div>
    </button>
  );
}

// ─── View ────────────────────────────────────────────────────────────────────

export default function MarketPulseView({ data = {}, historicalData = {} }) {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterCcy, setFilterCcy] = useState('ALL');
  const [timeframe, setTimeframe] = useState('ytd');

  // ── Returns for the WHOLE roster, computed once ─────────────────────────
  // Each series is stitched once (denomination glitches would otherwise report
  // +14,000%), then all four timeframes are read off it.
  const perf = useMemo(() => {
    const out = {};
    Object.entries(historicalData).forEach(([ticker, h]) => {
      const s = h?.Daily_1Y;
      if (!s?.prices?.length || !s?.dates?.length) return;
      const prices = stitchDiscontinuities(s.prices.map((v) => parseFloat(v) || 0));
      out[ticker] = {
        '3m': returnFrom(s.dates, prices, '3m'),
        '6m': returnFrom(s.dates, prices, '6m'),
        ytd: returnFrom(s.dates, prices, 'ytd'),
        '1y': returnFrom(s.dates, prices, '1y'),
      };
    });
    return out;
  }, [historicalData]);

  /** Every asset, flattened, with its returns attached. */
  const allRows = useMemo(
    () => Object.entries(data).map(([ticker, a]) => ({ ticker, ...a, perf: perf[ticker] })),
    [data, perf],
  );

  const currencies = useMemo(
    () => ['ALL', ...Array.from(new Set(allRows.map((r) => r.currency).filter(Boolean))).sort()],
    [allRows],
  );
  const classes = useMemo(
    () => ['ALL', ...Array.from(new Set(allRows.map((r) => r.assetClass || 'Other'))).sort()],
    [allRows],
  );
  const regions = useMemo(
    () => ['ALL', ...Array.from(new Set(allRows.map((r) => r.region || 'Global'))).sort()],
    [allRows],
  );

  /** The universe the boards summarise: currency + class filters only, so
   *  drilling into one region doesn't empty the region board. */
  const universe = useMemo(() => allRows.filter((r) => (
    (filterCcy === 'ALL' || r.currency === filterCcy)
    && (filterClass === 'ALL' || (r.assetClass || 'Other') === filterClass)
  )), [allRows, filterCcy, filterClass]);

  const movers = useMemo(() => {
    const rated = universe
      .filter((r) => r.perf?.[timeframe] != null)
      .map((r) => ({
        ticker: r.ticker,
        name: r.name,
        value: r.perf[timeframe],
        currency: r.currency,
        price: Number(r.price || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 }),
      }))
      .sort((a, b) => b.value - a.value);
    return { winners: rated.slice(0, 10), losers: rated.slice(-10).reverse(), total: rated.length };
  }, [universe, timeframe]);

  // Sector only means something for single companies — funds and ETFs are
  // tagged "Mixed", which would otherwise swamp the board with one giant bucket.
  const sectorRows = useMemo(() => groupPerformance(
    universe.filter((r) => !NON_SECTORS.has(String(r.sector || '').toLowerCase())),
    'sector', timeframe,
  ), [universe, timeframe]);

  const regionRows = useMemo(
    () => groupPerformance(universe, 'region', timeframe),
    [universe, timeframe],
  );

  const sectorMax = Math.max(...sectorRows.map((r) => Math.abs(r.mean)), 1);
  const regionMax = Math.max(...regionRows.map((r) => Math.abs(r.mean)), 1);
  const fundsWithoutSector = universe.length - sectorRows.reduce((s, r) => s + r.n, 0);

  // ── Asset list ──────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allRows.filter((r) => (
      (filterCcy === 'ALL' || r.currency === filterCcy)
      && (filterClass === 'ALL' || (r.assetClass || 'Other') === filterClass)
      && (filterRegion === 'ALL' || (r.region || 'Global') === filterRegion)
    ));
    if (q) {
      rows = rows.filter((r) => r.ticker.toLowerCase().includes(q)
        || (r.name || '').toLowerCase().includes(q)
        || (r.isin || '').toLowerCase().includes(q));
    }
    rows.sort((x, y) => {
      if (sortBy === 'price') return (y.price || 0) - (x.price || 0);
      if (sortBy === 'offHigh') return (y.pct_off_high || 0) - (x.pct_off_high || 0);
      if (sortBy === 'perf') return (y.perf?.[timeframe] ?? -Infinity) - (x.perf?.[timeframe] ?? -Infinity);
      return (x.name || '').localeCompare(y.name || '');
    });
    return rows;
  }, [allRows, search, filterCcy, filterClass, filterRegion, sortBy, timeframe]);

  useEffect(() => {
    setSelectedTicker((prev) => (prev && data[prev] ? prev : (visible[0]?.ticker ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterCcy]);

  const activeAsset = data[selectedTicker];
  const activeSymbol = CURRENCY_SYMBOLS[activeAsset?.currency] || '';
  const activePerf = perf[selectedTicker];
  const fmt = (v, dp = 2) => (v == null ? '—' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

  const select = 'px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 outline-none';
  const card = 'bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm';

  // The ticker holds two copies of the list; duration scales with content so a
  // long list doesn't whip past.
  const tickerRows = [...movers.winners, ...movers.losers];
  const marqueeSeconds = Math.max(30, tickerRows.length * 3.5);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Market Pulse</h2>
          <p className="text-gray-500 text-sm">
            {universe.length} assets
            {filterCcy === 'ALL' ? ' across all currencies' : ` in ${filterCcy}`}
            {' '}— movers, sector and country performance, then drill into any one.
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {TF.map(([key, txt]) => (
            <button
              key={key}
              onClick={() => setTimeframe(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                timeframe === key ? 'bg-brand text-white' : 'text-gray-500 hover:text-brand'
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </header>

      {/* ── Movers ticker ──────────────────────────────────────────────── */}
      {tickerRows.length > 0 && (
        <div className={`${card} mb-5 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[10px] font-black text-brand6 uppercase tracking-widest">
              Biggest movers · {TF.find(([k]) => k === timeframe)?.[1]}
            </p>
            <p className="text-[10px] text-gray-400">Hover to pause · local-currency returns</p>
          </div>
          <div className="gsb-marquee relative overflow-hidden pb-3">
            <div
              className="gsb-marquee-track"
              style={{ '--gsb-marquee-duration': `${marqueeSeconds}s` }}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex" aria-hidden={copy === 1}>
                  {tickerRows.map((row) => (
                    <MoverChip
                      key={`${copy}-${row.ticker}`}
                      row={row}
                      symbol={CURRENCY_SYMBOLS[row.currency] || ''}
                      onClick={() => setSelectedTicker(row.ticker)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sector + region boards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className={`${card} p-5`}>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-800">Sector performance</h3>
            <span className="text-[10px] text-gray-400">equal-weighted mean</span>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Single-company holdings only.
            {fundsWithoutSector > 0 && ` ${fundsWithoutSector} funds and ETFs are excluded — they carry no single sector.`}
          </p>
          {sectorRows.length === 0
            ? <p className="text-xs text-gray-400 italic py-6 text-center">No sector-tagged assets in this filter.</p>
            : sectorRows.map((row) => (
              <PerfBar key={row.group} row={row} max={sectorMax} onPick={() => setSelectedTicker(row.best.ticker)} />
            ))}
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-800">Country / region performance</h3>
            <span className="text-[10px] text-gray-400">equal-weighted mean</span>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Hover a row for its median, best and worst. Amber <span className="font-mono">n</span> marks
            a group of fewer than three assets — read those as a data point, not a trend.
          </p>
          <div className="max-h-[340px] overflow-y-auto pr-1">
            {regionRows.length === 0
              ? <p className="text-xs text-gray-400 italic py-6 text-center">No priced assets in this filter.</p>
              : regionRows.map((row) => (
                <PerfBar key={row.group} row={row} max={regionMax} onPick={() => setSelectedTicker(row.best.ticker)} />
              ))}
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ticker or ISIN…"
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-brand"
        />
        <select value={filterCcy} onChange={(e) => setFilterCcy(e.target.value)} className={select}>
          {currencies.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All currencies' : c}</option>)}
        </select>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className={select}>
          {classes.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All classes' : c}</option>)}
        </select>
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className={select}>
          {regions.map((r) => <option key={r} value={r}>{r === 'ALL' ? 'All regions' : r}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={select}>
          <option value="name">Sort: Name</option>
          <option value="perf">Sort: Performance</option>
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
              const r = info.perf?.[timeframe];
              return (
                <button
                  key={info.ticker}
                  onClick={() => setSelectedTicker(info.ticker)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected ? 'border-brand3 bg-brand3/5 shadow-sm ring-1 ring-brand3' : 'border-gray-200 bg-white/75 backdrop-blur-sm hover:border-gray-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-brand3' : 'text-brand6'}`}>{info.ticker}</span>
                      <h4 className="font-bold text-gray-800 truncate text-sm">{info.name}</h4>
                      <span className="text-[10px] text-gray-400">{info.assetClass || 'Other'} · {info.region || 'Global'}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-gray-600 block">
                        {CURRENCY_SYMBOLS[info.currency] || ''}{fmt(info.price)}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${toneOf(r)}`}>{pct(r)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: detail */}
        <div className="lg:col-span-8">
          {activeAsset ? (
            <div className="bg-white/75 backdrop-blur-sm rounded-3xl border border-gray-200 p-8 shadow-sm sticky top-32">
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
                  <div className="text-4xl font-mono font-bold text-brand tracking-tighter">{activeSymbol}{fmt(activeAsset.price)}</div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">
                    {activeAsset.currency} · price as of {activeAsset.date}
                  </p>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
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
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">Sector</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{activeAsset.sector || 'Unclassified'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">Region</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{activeAsset.region || 'Global'}</p>
                </div>
              </div>

              {/* Multi-timeframe returns */}
              <div className="mb-8">
                <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-2">
                  Total Return <span className="text-gray-400 font-bold normal-case tracking-normal">· in {activeAsset.currency}</span>
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {TF.map(([key, txt]) => {
                    const r = activePerf?.[key];
                    return (
                      <div
                        key={key}
                        className={`rounded-xl p-3 border text-center transition-colors ${
                          timeframe === key ? 'bg-brand-tint border-brand/30' : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">{txt}</p>
                        <p className={`text-base font-bold font-mono ${toneOf(r)}`}>{pct(r)}</p>
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
                      {activeSymbol}{fmt(activeAsset.low_52)}<span className="text-gray-300 font-light mx-2">—</span>{activeSymbol}{fmt(activeAsset.high_52)}
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

      <p className="text-[11px] text-gray-400 leading-relaxed mt-6 max-w-4xl">
        Returns are price-history total returns in <strong>each asset’s own currency</strong> — the feed is
        native-currency and only today’s FX is held, so there is no historical rate to convert a past return
        with. Comparing across currencies on one board is therefore approximate. The same fund can also appear
        as several listings or share classes; filtering to one currency collapses most of those duplicates.
      </p>
    </div>
  );
}
