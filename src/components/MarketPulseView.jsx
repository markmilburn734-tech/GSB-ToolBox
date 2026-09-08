// ─────────────────────────────────────────────────────────────────────────────
// MarketPulseView.jsx — market pulse + asset explorer
//
// Layout, top to bottom:
//   1. a full-bleed movers ticker, flush under the nav
//   2. title + timeframe selector (3M / 6M / YTD / 1Y) + filters
//   3. asset list | asset detail | sector & region boards in a side rail
//
// The boards live in the right rail deliberately: they are context, not the
// main event, and stacking them full-width above the list pushed the stocks
// themselves below the fold.
//
// CURRENCY IS A FILTER HERE, not the global top-right selector — this view
// defaults to "All currencies" so the whole roster can be seen at once.
//
// ⚠️ Returns are computed in each asset's OWN currency: the history feed is
// native-currency and we only hold TODAY's FX, so there is no historical rate
// to convert a past return with. Mixing currencies on one board is therefore
// approximate, and the UI says so.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
 * Percentage return over a timeframe from an ALREADY-STITCHED series. Split out
 * from the stitching so a whole-roster sweep stitches each series once rather
 * than once per timeframe.
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
 * Groups rows by a field → equal-weighted mean, median and extremes.
 * Equal-weighted because we hold no AUM or market caps; `n` is surfaced because
 * several regions contain one or two assets and a mean over n=2 is a data
 * point, not a trend.
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

// ─── Marquee ─────────────────────────────────────────────────────────────────

/**
 * Scrolls the ticker by translating the track every animation frame.
 *
 * Deliberately NOT a CSS animation: the previous @keyframes version was
 * silently cancelled by `prefers-reduced-motion: reduce`, which is on by
 * default on plenty of Windows installs and produced a dead bar with nothing to
 * debug. Reading `scrollWidth` live also means the loop adapts when the
 * timeframe changes the chip list, with no re-measure needed.
 *
 * The track renders the list twice; once it has travelled half its own width
 * the offset wraps, so the seam is never visible.
 */
function useMarquee(pxPerSecond = 45) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    let frame;
    let last = performance.now();
    let offset = 0;

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);   // clamp after a tab switch
      last = now;
      const track = trackRef.current;
      const viewport = viewportRef.current;

      if (track && viewport) {
        const half = track.scrollWidth / 2;   // width of ONE copy of the list
        // Only scroll when a single copy overflows the viewport. A narrow
        // filter (CHF has three assets) would otherwise scroll a short list
        // into open space and show the seam between the two copies.
        if (half > viewport.clientWidth) {
          if (!pausedRef.current) {
            offset -= pxPerSecond * dt;
            if (-offset >= half) offset += half;
            track.style.transform = `translate3d(${offset}px, 0, 0)`;
          }
        } else if (offset !== 0) {
          offset = 0;
          track.style.transform = 'translate3d(0, 0, 0)';
        }
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [pxPerSecond]);

  return { viewportRef, trackRef, pausedRef };
}

// ─── Presentational bits ─────────────────────────────────────────────────────

function MoverChip({ row, onClick }) {
  const up = row.value >= 0;
  return (
    <button
      onClick={onClick}
      title={`${row.name} · ${row.ticker} · ${row.currency}`}
      className="shrink-0 flex items-baseline gap-2 px-4 py-2 border-r border-gray-200/70 hover:bg-brand-tint/60 transition-colors"
    >
      <span className="text-[11px] font-black tracking-tighter text-brand6">{row.ticker}</span>
      <span className="text-[11px] text-gray-500 max-w-[120px] truncate">{row.name}</span>
      <span className={`text-[11px] font-mono font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '▲' : '▼'}{pct(row.value)}
      </span>
    </button>
  );
}

/** Compact diverging bar for the side rail: zero centred, gains right. */
function PerfRow({ row, max, onPick }) {
  const scale = max > 0 ? Math.min(Math.abs(row.mean) / max, 1) * 50 : 0;
  const up = row.mean >= 0;
  return (
    <button
      onClick={() => onPick?.(row)}
      className="w-full text-left group py-1"
      title={`${row.n} asset${row.n === 1 ? '' : 's'} · median ${pct(row.median)} · best ${row.best.name} ${pct(row.best.v)} · worst ${row.worst.name} ${pct(row.worst.v)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-gray-600 truncate group-hover:text-brand">
          {row.group}
          <span className={`ml-1 text-[9px] font-mono ${row.n < 3 ? 'text-amber-500' : 'text-gray-300'}`}>
            {row.n}
          </span>
        </span>
        <span className={`text-[11px] font-mono font-bold shrink-0 ${toneOf(row.mean)}`}>{pct(row.mean)}</span>
      </div>
      <div className="relative h-1.5 mt-0.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300 z-10" />
        <div
          className={`absolute inset-y-0 ${up ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={up ? { left: '50%', width: `${scale}%` } : { right: '50%', width: `${scale}%` }}
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

  const { viewportRef, trackRef, pausedRef } = useMarquee();

  // ── Returns for the WHOLE roster, computed once ─────────────────────────
  const perf = useMemo(() => {
    const out = {};
    Object.entries(historicalData).forEach(([ticker, h]) => {
      const s = h?.Daily_1Y;
      if (!s?.prices?.length || !s?.dates?.length) return;
      // Stitch once per series — a re-denominated ticker (SMEA.L ×100) would
      // otherwise report +14,000%.
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

  /** What the boards summarise: currency + class only, so drilling into one
   *  region doesn't empty the region board. */
  const universe = useMemo(() => allRows.filter((r) => (
    (filterCcy === 'ALL' || r.currency === filterCcy)
    && (filterClass === 'ALL' || (r.assetClass || 'Other') === filterClass)
  )), [allRows, filterCcy, filterClass]);

  const movers = useMemo(() => {
    const rated = universe
      .filter((r) => r.perf?.[timeframe] != null)
      .map((r) => ({ ticker: r.ticker, name: r.name, value: r.perf[timeframe], currency: r.currency }))
      .sort((a, b) => b.value - a.value);
    return [...rated.slice(0, 12), ...rated.slice(-12).reverse()];
  }, [universe, timeframe]);

  // Funds and ETFs are tagged "Mixed" and would swamp the board with one bucket.
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
  const tfLabel = TF.find(([k]) => k === timeframe)?.[1];

  return (
    <>
      {/* ── Movers ticker — full bleed, flush under the sub-tab bar. The
             negative margin cancels <main>'s top padding. ──────────────── */}
      {movers.length > 0 && (
        <div className="-mt-6 mb-6 bg-white/85 backdrop-blur-sm border-y border-gray-200 shadow-sm">
          <div className="flex items-stretch">
            <div className="shrink-0 flex items-center gap-2 px-4 bg-[#2e1c34] text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-brand3 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                Movers · {tfLabel}
              </span>
            </div>
            <div
              ref={viewportRef}
              className="relative overflow-hidden flex-1"
              onMouseEnter={() => { pausedRef.current = true; }}
              onMouseLeave={() => { pausedRef.current = false; }}
            >
              <div ref={trackRef} className="flex w-max will-change-transform">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex" aria-hidden={copy === 1}>
                    {movers.map((row) => (
                      <MoverChip
                        key={`${copy}-${row.ticker}`}
                        row={row}
                        onClick={() => setSelectedTicker(row.ticker)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pb-8 animate-in fade-in">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Market Pulse</h2>
            <p className="text-gray-500 text-sm">
              {universe.length} assets
              {filterCcy === 'ALL' ? ' across all currencies' : ` in ${filterCcy}`}
              {' '}— hover the ticker to pause it.
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

        {/* ── Filters ──────────────────────────────────────────────────── */}
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

        {/* ── List | detail | boards rail ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT: asset list */}
          <div className="lg:col-span-3 space-y-2 max-h-[720px] overflow-y-auto pr-1 custom-scrollbar">
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
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                      isSelected ? 'border-brand3 bg-brand3/5 shadow-sm ring-1 ring-brand3' : 'border-gray-200 bg-white/75 backdrop-blur-sm hover:border-gray-300 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-brand3' : 'text-brand6'}`}>{info.ticker}</span>
                        <h4 className="font-bold text-gray-800 truncate text-sm">{info.name}</h4>
                        <span className="text-[10px] text-gray-400">{info.assetClass || 'Other'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-gray-600 block text-sm">
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

          {/* CENTRE: detail */}
          <div className="lg:col-span-6">
            {activeAsset ? (
              <div className={`${card} p-6`}>
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-5">
                  <div className="min-w-0">
                    <span className="inline-block px-3 py-1 rounded-full bg-brand3/10 text-brand3 text-[10px] font-black uppercase mb-2">Asset Overview</span>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight">{activeAsset.name}</h3>
                    <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand3/5 border border-brand3/10">
                      <span className="text-[10px] font-bold text-brand6 uppercase tracking-widest">ISIN</span>
                      <span className="text-xs font-black text-brand3 font-mono">{activeAsset.isin}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0">
                    <div className="text-3xl font-mono font-bold text-brand tracking-tighter">{activeSymbol}{fmt(activeAsset.price)}</div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">
                      {activeAsset.currency} · as of {activeAsset.date}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                  {[
                    ['TER / OCR', `${fmt(activeAsset.ter, 3)}%`, true],
                    ['Volatility', null, false],
                    ['Class', activeAsset.assetClass || 'Other', false],
                    ['Sector', activeAsset.sector || 'Unclassified', false],
                    ['Region', activeAsset.region || 'Global', false],
                  ].map(([text, value, mono]) => (
                    <div key={text} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                      <p className="text-[9px] font-black text-brand6 uppercase tracking-widest mb-1">{text}</p>
                      {text === 'Volatility'
                        ? <span className={`inline-block px-1.5 py-0.5 text-[10px] font-extrabold rounded-md border ${getVolBadgeStyles(activeAsset.volatility)}`}>{activeAsset.volatility}</span>
                        : <p className={`text-sm font-bold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-2">
                    Total Return <span className="text-gray-400 font-bold normal-case tracking-normal">· in {activeAsset.currency}</span>
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {TF.map(([key, txt]) => {
                      const r = activePerf?.[key];
                      return (
                        <div
                          key={key}
                          className={`rounded-xl p-2.5 border text-center transition-colors ${
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

                <div className="h-px bg-gray-100 w-full mb-6" />

                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">52-Week Range</p>
                      <p className="text-lg font-bold text-gray-800">
                        {activeSymbol}{fmt(activeAsset.low_52)}<span className="text-gray-300 font-light mx-2">—</span>{activeSymbol}{fmt(activeAsset.high_52)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">Off Yearly High</p>
                      <p className={`text-lg font-bold ${activeAsset.pct_off_high < 2 ? 'text-amber-500' : 'text-emerald-500'}`}>{fmt(activeAsset.pct_off_high)}%</p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                      <div
                        className="h-full bg-brand3 transition-all duration-1000 ease-out"
                        style={{
                          width: `${activeAsset.high_52 > activeAsset.low_52
                            ? Math.min(Math.max(((activeAsset.price - activeAsset.low_52) / (activeAsset.high_52 - activeAsset.low_52)) * 100, 0), 100)
                            : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] font-black text-brand6 uppercase tracking-tighter">
                      <span>Yearly Low</span><span className="text-brand3">Current Position</span><span>Yearly High</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <p className="text-gray-400 font-medium">Select an asset to view details.</p>
              </div>
            )}
          </div>

          {/* RIGHT RAIL: sector + region boards */}
          <div className="lg:col-span-3 space-y-4">
            <div className={`${card} p-4`}>
              <div className="flex items-baseline justify-between mb-0.5">
                <h3 className="text-xs font-bold text-gray-800">Sector</h3>
                <span className="text-[9px] text-gray-400">mean · {tfLabel}</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2 leading-snug">
                Single companies only{fundsWithoutSector > 0 && `; ${fundsWithoutSector} funds have no sector`}.
              </p>
              {sectorRows.length === 0
                ? <p className="text-[11px] text-gray-400 italic py-3 text-center">Nothing sector-tagged here.</p>
                : sectorRows.map((row) => (
                  <PerfRow key={row.group} row={row} max={sectorMax} onPick={() => setSelectedTicker(row.best.ticker)} />
                ))}
            </div>

            <div className={`${card} p-4`}>
              <div className="flex items-baseline justify-between mb-0.5">
                <h3 className="text-xs font-bold text-gray-800">Country / region</h3>
                <span className="text-[9px] text-gray-400">mean · {tfLabel}</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2 leading-snug">
                Hover for median, best and worst. Amber count = fewer than three assets.
              </p>
              <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {regionRows.length === 0
                  ? <p className="text-[11px] text-gray-400 italic py-3 text-center">No priced assets here.</p>
                  : regionRows.map((row) => (
                    <PerfRow key={row.group} row={row} max={regionMax} onPick={() => setSelectedTicker(row.best.ticker)} />
                  ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed mt-6 max-w-4xl">
          Returns are price-history total returns in <strong>each asset’s own currency</strong> — the feed is
          native-currency and only today’s FX is held, so there is no historical rate to convert a past return
          with. Comparing across currencies on one board is therefore approximate. The same fund can also appear
          as several listings or share classes; filtering to one currency collapses most of those duplicates.
        </p>
      </div>
    </>
  );
}
