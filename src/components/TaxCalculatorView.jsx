// ─────────────────────────────────────────────────────────────────────────────
// TaxCalculatorView.jsx — CGT sell-down planner (UK, GBP-locked).
//
// Was a five-row estimator; now a solver. Upload a portfolio, give it a target,
// and it works out WHICH holdings to sell and HOW MUCH of each for the smallest
// combined tax + FX bill — then shows what the tidier, fewer-trades plan would
// cost instead.
//
// All the maths lives in src/cgt/cgtEngine.js (pure, and verified against brute
// force by scripts/verify_cgt.py). This file is presentation + state only.
//
// Manual entry still works: "Add row" for a blank line, or pull a holding off
// the live price feed and type in the units and average cost.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Download, Upload, FileText, AlertCircle, Check, X } from './Icons';
import { CGT, resolveRate, CURRENCY_SYMBOLS } from '../constants';
import {
    taxContext, deriveHolding, buildSellDownPlan, portfolioTotals,
} from '../cgt/cgtEngine';
import { importPortfolioFile, downloadTemplate } from '../cgt/portfolioImport';

// ─── Shared classes ──────────────────────────────────────────────────────────
const card = 'bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm';
const label = 'block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1';
const input = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-brand';
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnMain = `${btn} bg-brand text-white hover:bg-brand6`;
const btnGhost = `${btn} bg-white border border-gray-200 text-gray-600 hover:border-brand hover:text-brand`;

const MODES = [
    { id: 'net', label: 'Net cash needed', hint: 'Client receives this much after tax and FX costs.' },
    { id: 'gross', label: 'Gross proceeds', hint: 'Sell this much of market value; see what the tax comes to.' },
    { id: 'allowance', label: 'Fill the CGT allowance', hint: 'Realise as much as possible with no tax to pay.' },
];

const gbp = (v) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(Number.isFinite(v) ? v : 0);

const gbp2 = (v) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number.isFinite(v) ? v : 0);

const units = (v) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(v || 0);

// ─── Small controls ──────────────────────────────────────────────────────────

function Field({ text, value, onChange, prefix, step = '1', title }) {
    return (
        <div title={title}>
            <span className={label}>{text}</span>
            <div className="relative">
                {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">{prefix}</span>}
                <input
                    type="number"
                    step={step}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${input} ${prefix ? 'pl-7' : ''}`}
                />
            </div>
        </div>
    );
}

function Toggle({ text, checked, onChange, hint }) {
    return (
        <label className="flex items-start gap-2.5 cursor-pointer py-1">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-brand cursor-pointer"
            />
            <span className="text-sm text-gray-700 leading-snug">
                {text}
                {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
            </span>
        </label>
    );
}

function Tile({ text, value, tone = 'default', sub }) {
    const tones = {
        default: 'text-gray-900',
        brand: 'text-brand',
        bad: 'text-brand3',
        good: 'text-emerald-600',
    };
    return (
        <div className={`${card} p-4`}>
            <span className={label}>{text}</span>
            <div className={`text-xl font-mono font-bold tracking-tight ${tones[tone]}`}>{value}</div>
            {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
        </div>
    );
}

// ─── View ────────────────────────────────────────────────────────────────────

export default function TaxCalculatorView({ pricesData = {}, liveRates = {} }) {
    // Portfolio
    const [holdings, setHoldings] = useState([]);
    const [importIssues, setImportIssues] = useState([]);
    const [importNote, setImportNote] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addQuery, setAddQuery] = useState('');
    const fileRef = useRef(null);

    // Taxpayer
    const [income, setIncome] = useState(30000);
    const [allowanceUsed, setAllowanceUsed] = useState(0);
    const [isJoint, setIsJoint] = useState(false);
    const [carriedLosses, setCarriedLosses] = useState(0);

    // Assumptions
    const [fxSpreadPct, setFxSpreadPct] = useState(0.25);
    const [useBuffer, setUseBuffer] = useState(true);
    const [wholeUnits, setWholeUnits] = useState(true);
    const [avgCostInNative, setAvgCostInNative] = useState(false);

    // Target
    const [mode, setMode] = useState('net');
    const [target, setTarget] = useState(50000);

    const rate = useCallback(
        (from, to) => resolveRate(from, to, liveRates),
        [liveRates],
    );

    // ── Derived holdings ────────────────────────────────────────────────────
    const derived = useMemo(() => holdings.map((h) => deriveHolding(h, rate, {
        marketBuffer: useBuffer ? CGT.MARKET_BUFFER : 0,
        fxSpread: (Number(fxSpreadPct) || 0) / 100,
        avgCostInNative,
    })), [holdings, rate, useBuffer, fxSpreadPct, avgCostInNative]);

    const totals = useMemo(() => portfolioTotals(derived), [derived]);

    const ctx = useMemo(() => taxContext({
        income: Number(income) || 0,
        allowanceUsed: Number(allowanceUsed) || 0,
        isJoint,
        broughtForwardLosses: Number(carriedLosses) || 0,
    }), [income, allowanceUsed, isJoint, carriedLosses]);

    const plan = useMemo(() => {
        if (!derived.length) return null;
        return buildSellDownPlan(derived, {
            mode,
            target: Number(target) || 0,
            ctx,
            wholeUnits,
        });
    }, [derived, mode, target, ctx, wholeUnits]);

    // ── Portfolio handlers ──────────────────────────────────────────────────
    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setImportIssues([]);
        setImportNote(null);
        try {
            const { holdings: rows, issues, source } = await importPortfolioFile(file);
            if (rows.length) {
                setHoldings(rows);
                setImportNote(`Imported ${rows.length} holding${rows.length === 1 ? '' : 's'} from ${source}.`);
            }
            setImportIssues(issues);
        } catch (err) {
            setImportIssues([err?.message || 'The file could not be read.']);
        }
    };

    const update = (id, field, value) => setHoldings((prev) => prev.map((h) => (
        h.id === id
            ? { ...h, [field]: ['name', 'currency'].includes(field) ? value : (parseFloat(value) || 0) }
            : h
    )));

    const toggle = (id, field) => setHoldings((prev) => prev.map((h) => (
        h.id === id ? { ...h, [field]: !h[field] } : h
    )));

    const removeRow = (id) => setHoldings((prev) => prev.filter((h) => h.id !== id));

    const addBlank = () => {
        setHoldings((prev) => [...prev, {
            id: `man-${Date.now()}`, name: 'New holding', currency: 'GBP',
            qty: 0, price: 0, avgCost: 0, locked: false, forced: false,
        }]);
        setAddOpen(false);
    };

    const addFromFeed = (ticker, asset) => {
        setHoldings((prev) => [...prev, {
            id: `feed-${ticker}-${Date.now()}`,
            name: asset.name, currency: asset.currency, ticker, isin: asset.isin,
            qty: 0, price: asset.price, avgCost: 0, locked: false, forced: false,
        }]);
        setAddOpen(false);
        setAddQuery('');
    };

    const feedHits = useMemo(() => {
        const q = addQuery.trim().toLowerCase();
        const entries = Object.entries(pricesData);
        if (!q) return entries.slice(0, 8);
        return entries.filter(([t, a]) => (
            t.toLowerCase().includes(q)
            || String(a.name || '').toLowerCase().includes(q)
            || String(a.isin || '').toLowerCase().includes(q)
        )).slice(0, 8);
    }, [pricesData, addQuery]);

    // ── Plan export ─────────────────────────────────────────────────────────
    const exportPlan = () => {
        if (!plan?.trades?.length) return;
        const rows = [
            ['Holding', 'Currency', 'Units to sell', 'Proceeds (native)', 'Proceeds (GBP)',
             'Gain (GBP)', 'FX cost (GBP)', 'Full disposal'],
            ...plan.trades.map((t) => [
                t.name, t.currency, units(t.units), t.proceedsNative.toFixed(2),
                t.proceedsGbp.toFixed(2), t.gainGbp.toFixed(2), t.fxCostGbp.toFixed(2),
                t.isFullDisposal ? 'Yes' : 'No',
            ]),
            [],
            ['Gross proceeds', '', '', '', plan.grossProceeds.toFixed(2)],
            ['Net gain', '', '', '', plan.netGain.toFixed(2)],
            ['CGT', '', '', '', plan.tax.toFixed(2)],
            ['FX cost', '', '', '', plan.fxCost.toFixed(2)],
            ['Net cash to client', '', '', '', plan.netCash.toFixed(2)],
        ];
        const csv = rows.map((r) => r.map((c) => {
            const s = String(c ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')).join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CGT sell-down plan - ${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const hasFx = derived.some((h) => h.currency !== 'GBP');
    const shortfall = plan?.shortfall > 1 ? plan.shortfall : 0;

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="max-w-7xl mx-auto px-4">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">CGT Sell-Down Planner</h2>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">UK · GBP</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Upload a portfolio and solve for the cheapest way to raise a target —
                        least tax, least FX cost, fewest trades.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className={btnMain} onClick={() => fileRef.current?.click()}>
                        <Upload size={14} /> Upload portfolio
                    </button>
                    <input
                        ref={fileRef} type="file" className="hidden"
                        accept=".csv,.tsv,.xlsx,.xlsm,.xls,text/csv"
                        onChange={handleFile}
                    />
                    <button className={btnGhost} onClick={downloadTemplate}>
                        <FileText size={14} /> Template
                    </button>
                </div>
            </div>

            {/* ── Import feedback ─────────────────────────────────────────── */}
            {importNote && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 mb-4 text-xs text-emerald-700 flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0" /> <span>{importNote}</span>
                </div>
            )}
            {importIssues.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 mb-4 text-xs text-amber-700">
                    <div className="flex items-start gap-2 font-bold mb-1">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{importIssues.length} row{importIssues.length === 1 ? '' : 's'} need attention</span>
                    </div>
                    <ul className="list-disc ml-8 space-y-0.5">
                        {importIssues.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
                        {importIssues.length > 8 && <li>…and {importIssues.length - 8} more.</li>}
                    </ul>
                </div>
            )}

            {/* ── Portfolio ───────────────────────────────────────────────── */}
            <div className={`${card} p-5 mb-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Portfolio</h3>
                        <p className="text-xs text-gray-500">
                            {derived.length
                                ? <>
                                    {derived.length} holdings · {gbp(totals.valueGbp)} value ·
                                    {' '}<span className={totals.gainGbp >= 0 ? 'text-emerald-600' : 'text-brand3'}>
                                        {totals.gainGbp >= 0 ? '+' : ''}{gbp(totals.gainGbp)} unrealised
                                    </span>
                                </>
                                : 'Upload a sheet with Name, Currency, Price, Qty and Avg Price — or add rows by hand.'}
                        </p>
                    </div>
                    <div className="flex gap-2 relative">
                        <button className={btnGhost} onClick={() => setAddOpen((o) => !o)}>
                            <Plus size={14} /> Add holding
                        </button>
                        {derived.length > 0 && (
                            <button
                                className={`${btnGhost} hover:border-rose-300 hover:text-rose-600`}
                                onClick={() => { setHoldings([]); setImportIssues([]); setImportNote(null); }}
                            >
                                <Trash2 size={14} /> Clear
                            </button>
                        )}
                        {addOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                                {/* Solid, not frosted: a blurred parent would trap this menu. */}
                                <div className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-gray-200 shadow-xl p-2 z-20">
                                    <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-brand hover:bg-brand-tint" onClick={addBlank}>
                                        + Blank row
                                    </button>
                                    <input
                                        autoFocus
                                        value={addQuery}
                                        onChange={(e) => setAddQuery(e.target.value)}
                                        placeholder="Search live prices by name, ticker or ISIN…"
                                        className="w-full mt-2 mb-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-brand"
                                    />
                                    <div className="max-h-60 overflow-y-auto">
                                        {feedHits.map(([t, a]) => (
                                            <button
                                                key={t}
                                                onClick={() => addFromFeed(t, a)}
                                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            >
                                                <span className="text-xs font-semibold text-gray-700 block truncate">{a.name}</span>
                                                <span className="text-[10px] font-mono text-gray-400">
                                                    {t} · {a.currency} {a.price}
                                                </span>
                                            </button>
                                        ))}
                                        {!feedHits.length && <p className="text-[11px] text-gray-400 px-3 py-2">No matches.</p>}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {derived.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <th className="text-left pb-2 pr-2">Holding</th>
                                    <th className="text-left pb-2 px-1 w-20">Ccy</th>
                                    <th className="text-right pb-2 px-1 w-28">Qty</th>
                                    <th className="text-right pb-2 px-1 w-28">Price</th>
                                    <th className="text-right pb-2 px-1 w-32">Avg cost{avgCostInNative ? '' : ' (£)'}</th>
                                    <th className="text-right pb-2 px-1 w-28">Value £</th>
                                    <th className="text-right pb-2 px-1 w-32">Gain £</th>
                                    <th className="text-center pb-2 px-1 w-24">Hold / Force</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {derived.map((h) => (
                                    <tr key={h.id} className={`border-t border-gray-100 ${h.locked ? 'opacity-50' : ''}`}>
                                        <td className="py-1 pr-2">
                                            <input
                                                value={h.name}
                                                onChange={(e) => update(h.id, 'name', e.target.value)}
                                                className="w-full min-w-[150px] px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand"
                                            />
                                        </td>
                                        <td className="px-1">
                                            <input
                                                value={h.currency}
                                                onChange={(e) => update(h.id, 'currency', e.target.value.toUpperCase())}
                                                className={`${input} py-1.5 text-center uppercase`}
                                            />
                                        </td>
                                        <td className="px-1">
                                            <input type="number" value={h.qty} onChange={(e) => update(h.id, 'qty', e.target.value)} className={`${input} py-1.5 text-right`} />
                                        </td>
                                        <td className="px-1">
                                            <input type="number" step="0.0001" value={h.price} onChange={(e) => update(h.id, 'price', e.target.value)} className={`${input} py-1.5 text-right`} />
                                        </td>
                                        <td className="px-1">
                                            <input type="number" step="0.0001" value={h.avgCost} onChange={(e) => update(h.id, 'avgCost', e.target.value)} className={`${input} py-1.5 text-right`} />
                                        </td>
                                        <td className="px-1 text-right font-mono text-gray-600">{gbp(h.valueGbp)}</td>
                                        <td className={`px-1 text-right font-mono font-semibold ${h.gainGbp >= 0 ? 'text-gray-700' : 'text-emerald-600'}`}>
                                            {gbp(h.gainGbp)}
                                            <span className="block text-[10px] font-normal text-gray-400">
                                                {(h.gainFraction * 100).toFixed(1)}% of value
                                            </span>
                                        </td>
                                        <td className="px-1">
                                            <div className="flex gap-1 justify-center">
                                                <button
                                                    title="Hold — never sell this line"
                                                    onClick={() => toggle(h.id, 'locked')}
                                                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${h.locked ? 'bg-brand text-white border-brand' : 'bg-white text-gray-400 border-gray-200 hover:border-brand'}`}
                                                >
                                                    Hold
                                                </button>
                                                <button
                                                    title="Force — always sell this line in full"
                                                    onClick={() => toggle(h.id, 'forced')}
                                                    className={`px-2 py-1 rounded-md text-[10px] font-bold border ${h.forced ? 'bg-brand3 text-white border-brand3' : 'bg-white text-gray-400 border-gray-200 hover:border-brand3'}`}
                                                >
                                                    Sell
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-1 text-right">
                                            <button onClick={() => removeRow(h.id)} className="text-gray-300 hover:text-brand3">
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Settings + target ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                <div className={`${card} p-5`}>
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Taxpayer</h3>
                    <div className="space-y-3">
                        <Field text="Gross annual income" prefix="£" value={income} onChange={setIncome} step="1000" />
                        <Field text="CGT allowance already used" prefix="£" value={allowanceUsed} onChange={setAllowanceUsed} step="100" />
                        <Field text="Losses carried forward" prefix="£" value={carriedLosses} onChange={setCarriedLosses} step="100" />
                        <Toggle text="Joint / spouse" hint="Doubles the exempt amount and the basic-rate band." checked={isJoint} onChange={setIsJoint} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                        Exempt amount {gbp(ctx.exemptAmount)} · basic-rate headroom {gbp(ctx.unusedBasicBand)} ·
                        rates {(CGT.LR_TAX * 100).toFixed(0)}% / {(CGT.HR_TAX * 100).toFixed(0)}%.
                    </p>
                </div>

                <div className={`${card} p-5`}>
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Assumptions</h3>
                    <div className="space-y-3">
                        <Field
                            text="FX conversion cost" prefix="%" value={fxSpreadPct} onChange={setFxSpreadPct} step="0.05"
                            title="Charged on proceeds from non-GBP holdings. The solver trades this off against tax."
                        />
                        <Toggle
                            text="Whole units only"
                            hint="Round each disposal to whole units, then top back up to the target."
                            checked={wholeUnits} onChange={setWholeUnits}
                        />
                        <Toggle
                            text={`${(CGT.MARKET_BUFFER * 100).toFixed(1)}% prudence buffer`}
                            hint="Nudges the sale price up so the tax provision errs high."
                            checked={useBuffer} onChange={setUseBuffer}
                        />
                        <Toggle
                            text="Avg cost is in the holding's currency"
                            hint="Off (recommended) = cost is GBP at purchase. On converts at today's rate, which ignores the FX part of the gain."
                            checked={avgCostInNative} onChange={setAvgCostInNative}
                        />
                    </div>
                </div>

                <div className={`${card} p-5`}>
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Target</h3>
                    <div className="space-y-1.5 mb-3">
                        {MODES.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setMode(m.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                    mode === m.id
                                        ? 'bg-brand-tint border-brand text-brand font-semibold'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-brand6'
                                }`}
                            >
                                {m.label}
                                <span className="block text-[11px] font-normal text-gray-400">{m.hint}</span>
                            </button>
                        ))}
                    </div>
                    {mode !== 'allowance' && (
                        <Field text="Amount" prefix="£" value={target} onChange={setTarget} step="1000" />
                    )}
                </div>
            </div>

            {/* ── Result ──────────────────────────────────────────────────── */}
            {!derived.length && (
                <div className={`${card} p-10 text-center`}>
                    <p className="text-sm text-gray-500">
                        Upload a portfolio to plan a sell-down. The template has the exact columns —
                        <strong> Name, Currency, Price, Qty, Avg Price</strong>.
                    </p>
                </div>
            )}

            {derived.length > 0 && !plan && (
                <div className={`${card} p-6 text-center text-sm text-amber-700 bg-amber-50/70 border-amber-200`}>
                    The sellable portfolio ({gbp(totals.sellableGbp)}) is smaller than the target.
                    Release a held line or lower the target.
                </div>
            )}

            {plan && (
                <>
                    {shortfall > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 mb-4 text-xs text-amber-700 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>
                                Selling everything sellable raises {gbp(plan.netCash)} net — {gbp(shortfall)} short
                                of the target. The plan below is the maximum achievable.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                        <Tile text="Gross proceeds" value={gbp(plan.grossProceeds)} />
                        <Tile text="Realised gain" value={gbp(plan.netGain)} tone={plan.netGain >= 0 ? 'default' : 'good'} />
                        <Tile text="CGT" value={gbp(plan.tax)} tone="bad"
                              sub={plan.taxDetail.taxableGain > 0
                                  ? `${gbp(plan.taxDetail.atLowerRate)} @18% · ${gbp(plan.taxDetail.atHigherRate)} @24%`
                                  : 'No taxable gain'} />
                        <Tile text="FX cost" value={gbp(plan.fxCost)} tone={plan.fxCost > 0 ? 'bad' : 'default'} />
                        <Tile text="Net to client" value={gbp(plan.netCash)} tone="brand" />
                        <Tile text="Trades" value={String(plan.tradeCount)}
                              sub={`${plan.trades.filter((t) => t.isFullDisposal).length} full disposals`} />
                    </div>

                    <div className={`${card} p-5 mb-5`}>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Sell-down plan</h3>
                                <p className="text-xs text-gray-500">
                                    Cheapest route to the target — {plan.orderingLabel?.toLowerCase()}.
                                    Total cost {gbp2(plan.totalCost)} ({(plan.costRatio * 100).toFixed(2)}% of net cash).
                                </p>
                            </div>
                            <button className={btnGhost} onClick={exportPlan}>
                                <Download size={14} /> Export plan
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead>
                                    <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="text-left pb-2">Holding</th>
                                        <th className="text-right pb-2 px-2">Units to sell</th>
                                        <th className="text-right pb-2 px-2">% of position</th>
                                        <th className="text-right pb-2 px-2">Proceeds (native)</th>
                                        <th className="text-right pb-2 px-2">Proceeds £</th>
                                        <th className="text-right pb-2 px-2">Gain £</th>
                                        <th className="text-right pb-2 pl-2">FX cost £</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.trades.map((t) => (
                                        <tr key={t.id} className="border-t border-gray-100">
                                            <td className="py-2 font-semibold text-gray-800">
                                                {t.name}
                                                {t.isFullDisposal && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-brand-tint text-brand text-[10px] font-bold">FULL</span>
                                                )}
                                            </td>
                                            <td className="text-right px-2 font-mono">{units(t.units)}</td>
                                            <td className="text-right px-2 font-mono text-gray-500">{(t.fraction * 100).toFixed(1)}%</td>
                                            <td className="text-right px-2 font-mono text-gray-500">
                                                {CURRENCY_SYMBOLS[t.currency] || ''}{new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(t.proceedsNative)}
                                            </td>
                                            <td className="text-right px-2 font-mono">{gbp(t.proceedsGbp)}</td>
                                            <td className={`text-right px-2 font-mono ${t.gainGbp < 0 ? 'text-emerald-600' : 'text-gray-700'}`}>{gbp(t.gainGbp)}</td>
                                            <td className="text-right pl-2 font-mono text-gray-500">{t.fxCostGbp ? gbp2(t.fxCostGbp) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {plan.alternative && (
                        <div className={`${card} p-5 mb-5 border-brand/30`}>
                            <h3 className="text-sm font-bold text-gray-800 mb-1">Fewer trades</h3>
                            <p className="text-xs text-gray-500 mb-3">
                                The same target in <strong>{plan.alternative.tradeCount}</strong> trades instead
                                of {plan.tradeCount} — costing {gbp2(plan.alternative.extraCost)} more
                                ({gbp2(plan.alternative.totalCost)} vs {gbp2(plan.totalCost)}).
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {plan.alternative.trades.map((t) => (
                                    <span key={t.id} className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px]">
                                        <span className="font-semibold text-gray-700">{t.name}</span>
                                        <span className="font-mono text-gray-400"> · {units(t.units)} units · {gbp(t.proceedsGbp)}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Caveats ─────────────────────────────────────────────────── */}
            <div className="text-[11px] text-gray-400 leading-relaxed mt-6 space-y-1.5 max-w-4xl">
                <p>
                    <strong>Section 104 pooling</strong> is assumed: one row per holding, priced at its average
                    cost. <strong>Same-day and 30-day “bed and breakfast” matching is not modelled</strong> — if any
                    of these holdings is re-purchased within 30 days, the gain must be recalculated.
                </p>
                <p>
                    In-year losses net off gains before the exempt amount; losses brought forward are used only
                    against gains above it. An estimate for planning discussion, not a tax computation.
                </p>
                {hasFx && (
                    <p>
                        {avgCostInNative
                            ? <><strong>Average cost is being read in each holding’s own currency</strong> and converted at today’s rate. That ignores the currency move since purchase, which forms part of a UK capital gain — the gains shown for non-GBP holdings are approximate.</>
                            : <>Average cost is treated as <strong>GBP at the purchase date</strong>, so the FX element of each gain is captured. Current values convert at live rates.</>}
                    </p>
                )}
            </div>
        </div>
    );
}
