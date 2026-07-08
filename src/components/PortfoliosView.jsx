// ─────────────────────────────────────────────────────────────────────────────
// PortfoliosView.jsx
//
// Read-only "model preset browser". Pick Strategy → Currency → Profile and see
// the model's holdings in detail: live prices (converted to the display
// currency), target weights, blended TER, dominant volatility, and weight-
// summed breakdowns by asset class and region.
//
// Sourced entirely from the sheet-driven `presets` + `pricesData` already loaded
// by App — no extra fetching here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState, useEffect } from 'react';
import { resolveRate, isCash } from '../constants';
import { getVolBadgeStyles } from './PerformanceLogic';
import { Briefcase, Check, X, Percent, Globe, Layers } from 'lucide-react';

// Palette reused for the breakdown bars.
const BAR_COLORS = ['#2d0738', '#9966ff', '#00a0f0', '#fc5b3f', '#10b981', '#f59e0b', '#64748b', '#ec4899'];

export default function PortfoliosView({ presets = {}, pricesData = {}, liveRates = {}, currency = 'USD', symbol = '$' }) {
    const strategies = useMemo(() => Object.keys(presets), [presets]);

    const [strategy, setStrategy] = useState('');
    const [curr,     setCurr]     = useState('');
    const [profile,  setProfile]  = useState('');

    // ── Keep the selection valid as presets load / the global currency changes ──
    useEffect(() => {
        if (strategies.length === 0) return;
        const s = strategies.includes(strategy) ? strategy : strategies[0];

        const currencyOptions = Object.keys(presets[s] || {});
        // Prefer the app's active currency if this strategy offers it.
        const c = currencyOptions.includes(curr)
            ? curr
            : (currencyOptions.includes(currency) ? currency : (currencyOptions[0] || ''));

        const profileOptions = Object.keys(presets[s]?.[c] || {});
        const p = profileOptions.includes(profile) ? profile : (profileOptions[0] || '');

        if (s !== strategy) setStrategy(s);
        if (c !== curr)     setCurr(c);
        if (p !== profile)  setProfile(p);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategies, presets, currency, strategy, curr, profile]);

    const currencyOptions = Object.keys(presets[strategy] || {});
    const profileOptions  = Object.keys(presets[strategy]?.[curr] || {});
    const holdings        = presets[strategy]?.[curr]?.[profile] || [];

    // ── Resolve price/metadata for a holding (ticker first, then ISIN) ──────────
    const findMeta = (h) => {
        const t = (h.ticker || '').trim().toUpperCase();
        if (t && pricesData[t]) return pricesData[t];
        const isin = (h.isin || '').trim().toUpperCase();
        if (isin && isin !== 'N/A') {
            const byIsin = Object.values(pricesData).find((a) => a.isin === isin);
            if (byIsin) return byIsin;
        }
        return null;
    };

    const displayPrice = (meta) => {
        if (!meta || !(meta.price > 0)) return null;
        const src = meta.currency || curr;
        if (src === curr) return meta.price;
        return meta.price * resolveRate(src, curr, liveRates);
    };

    // ── Derived rows + portfolio-level stats ────────────────────────────────────
    const { rows, blendedTer, dominantVol, totalWeight, byClass, byRegion } = useMemo(() => {
        let weightedTer = 0;
        let total       = 0;
        const volWeights    = {};
        const classWeights  = {};
        const regionWeights = {};

        const out = holdings.map((h) => {
            const cash   = isCash(h.ticker) || isCash(h.isin);
            const meta   = cash ? null : findMeta(h);
            const weight = parseFloat(h.target) || 0;
            const ter    = cash ? 0      : (meta ? (parseFloat(meta.ter) || 0) : 0);
            const vol    = cash ? 'Low'  : (meta?.volatility || 'Average');
            const cls    = cash ? 'Cash' : (meta?.assetClass || (h.isin === 'N/A' ? 'Cash' : 'Other'));
            const region = cash ? 'Cash' : (meta?.region || 'Global');

            total       += weight;
            weightedTer += ter * weight;
            volWeights[vol]       = (volWeights[vol]       || 0) + weight;
            classWeights[cls]     = (classWeights[cls]     || 0) + weight;
            regionWeights[region] = (regionWeights[region] || 0) + weight;

            return {
                name:   cash ? (h.name || 'Cash') : (meta?.name || h.name || 'Unknown Asset'),
                ticker: (h.ticker || '').toUpperCase() || '—',
                isin:   h.isin || 'N/A',
                weight,
                price:  cash ? 1 : displayPrice(meta),   // par: 1 unit of the displayed currency
                ter,
                vol,
                cls,
                region,
                priced: cash ? true : !!meta,
            };
        });

        let dom = 'Average';
        let max = -1;
        Object.entries(volWeights).forEach(([k, v]) => { if (v > max) { max = v; dom = k; } });

        const toSorted = (obj) =>
            Object.entries(obj).map(([k, v]) => ({ key: k, weight: v })).sort((a, b) => b.weight - a.weight);

        return {
            rows:        out,
            blendedTer:  total > 0 ? weightedTer / total : 0,
            dominantVol: dom,
            totalWeight: total,
            byClass:     toSorted(classWeights),
            byRegion:    toSorted(regionWeights),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [holdings, pricesData, liveRates, curr]);

    const weightOk     = Math.abs(totalWeight - 100) < 0.1;
    const unpricedCount = rows.filter((r) => !r.priced).length;

    const fmtPrice = (v) =>
        v == null ? '—' : `${symbol}${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ── Labelled horizontal bar list (used for class & region splits) ───────────
    const BreakdownBars = ({ title, icon, data }) => (
        <div className="bg-white/75 backdrop-blur-smrounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4 text-gray-500">
                {icon}
                <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>
            </div>
            <div className="space-y-2.5">
                {data.map((d, i) => (
                    <div key={d.key} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs font-semibold text-gray-600 truncate" title={d.key}>{d.key}</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(d.weight, 100)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                            />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs font-mono font-bold text-gray-700">{d.weight.toFixed(1)}%</span>
                    </div>
                ))}
                {data.length === 0 && <p className="text-xs text-gray-400 italic">No data.</p>}
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-2 animate-in fade-in">
            {/* Header */}
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h2 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">Model Portfolios</h2>
                        <p className="text-gray-500 text-sm">Detailed composition of the GSB model presets · prices shown in <span className="font-bold text-brand">{curr || currency}</span></p>
                    </div>
                </div>
            </header>

            {strategies.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                    <Briefcase size={32} className="text-gray-300 mb-3" />
                    <p className="text-gray-400 font-medium">Loading portfolios from the workbook…</p>
                </div>
            ) : (
                <>
                    {/* Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Strategy</label>
                            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/75 backdrop-blur-smborder border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:border-brand">
                                {strategies.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Currency</label>
                            <select value={curr} onChange={(e) => setCurr(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/75 backdrop-blur-smborder border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:border-brand">
                                {currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Risk Profile</label>
                            <select value={profile} onChange={(e) => setProfile(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/75 backdrop-blur-smborder border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:border-brand">
                                {profileOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="bg-white/75 backdrop-blur-smrounded-2xl border border-gray-200 shadow-sm p-5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1"><Percent size={11} /> Blended Net Cost</p>
                            <p className="text-2xl font-bold text-gray-900 font-mono">{blendedTer.toFixed(3)}%</p>
                        </div>
                        <div className="bg-white/75 backdrop-blur-smrounded-2xl border border-gray-200 shadow-sm p-5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Volatility Profile</p>
                            <span className={`inline-block px-2 py-0.5 text-xs font-extrabold rounded-md border mt-1 ${getVolBadgeStyles(dominantVol)}`}>{dominantVol}</span>
                        </div>
                        <div className="bg-white/75 backdrop-blur-smrounded-2xl border border-gray-200 shadow-sm p-5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Holdings</p>
                            <p className="text-2xl font-bold text-gray-900 font-mono">{rows.length}</p>
                        </div>
                        <div className="bg-white/75 backdrop-blur-smrounded-2xl border border-gray-200 shadow-sm p-5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Weight Integrity</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-extrabold mt-1 ${weightOk ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {totalWeight.toFixed(2)}% {weightOk ? <Check size={12} /> : <X size={12} />}
                            </span>
                        </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
                        <BreakdownBars title="Allocation by Asset Class" icon={<Layers size={14} />} data={byClass} />
                        <BreakdownBars title="Allocation by Region" icon={<Globe size={14} />} data={byRegion} />
                    </div>

                    {/* Holdings table */}
                    <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-brand shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[820px]">
                                <thead>
                                    <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="py-3.5 px-6 w-1/3">Holding</th>
                                        <th className="py-3.5 px-4">Class</th>
                                        <th className="py-3.5 px-4">Region</th>
                                        <th className="py-3.5 px-4 text-right">Price ({curr})</th>
                                        <th className="py-3.5 px-4 text-right">TER</th>
                                        <th className="py-3.5 px-4 text-center">Vol</th>
                                        <th className="py-3.5 px-4 text-right w-24">Target %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {rows.map((r, i) => (
                                        <tr key={`${r.ticker}-${i}`} className="hover:bg-gray-50/40 transition-colors">
                                            <td className="py-3 px-6">
                                                <div className="font-semibold text-gray-800 truncate max-w-[280px]" title={r.name}>{r.name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{r.ticker} · {r.isin}{!r.priced && <span className="text-amber-500 ml-1">· no live data</span>}</div>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-600">{r.cls}</td>
                                            <td className="py-3 px-4 text-xs text-gray-600">{r.region}</td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-700">{fmtPrice(r.price)}</td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-500">{r.ter.toFixed(3)}%</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold rounded border ${getVolBadgeStyles(r.vol)}`}>{r.vol}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-800 font-mono">{r.weight.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {unpricedCount > 0 && (
                            <div className="bg-amber-50 border-t border-amber-200 px-6 py-2 text-amber-700 text-[11px]">
                                {unpricedCount} holding{unpricedCount > 1 ? 's' : ''} couldn’t be matched to live price data (check the ticker/ISIN in the sheet).
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
