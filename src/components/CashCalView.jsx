// ─────────────────────────────────────────────────────────────────────────────
// CashCalView.jsx — multi-asset cash-flow / longevity planner.
//
//   • Assets list with category quick-add (House, SIPP, ISA, Loan…), each with
//     its own freely-editable growth/return rate.
//   • Drag-and-drop Events timeline: drag Retirement / State Pension /
//     Inheritance / Lump Expense / Forecast End onto an age track.
//   • Stacked bar projection — one colour per asset — showing growth then
//     drawdown to the forecast-end age.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DollarSign, Plus, Trash2, X } from './Icons';
import { estimateIHT } from '../constants';

const COLORS = ['#2d0738', '#9966ff', '#00a0f0', '#fc5b3f', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#0ea5e9', '#a855f7'];

// Quick-add asset categories (seed a name + a sensible default growth rate).
const ASSET_TEMPLATES = [
  { name: 'Cash / Current account', growth: 0.5 },
  { name: 'Savings',                growth: 2 },
  { name: 'ISA',                    growth: 5 },
  { name: 'SIPP / Pension',         growth: 5 },
  { name: 'House / Property',       growth: 3 },
  { name: 'Other investments',      growth: 6 },
  { name: 'Loan / Mortgage',        growth: 4, liability: true },
];

// Timeline event types.
const EVENT_TYPES = [
  { type: 'retirement',   label: 'Retirement',    color: '#9966ff', amount: false, single: true },
  { type: 'statepension', label: 'State Pension', color: '#00a0f0', amount: true },
  { type: 'inheritance',  label: 'Inheritance',   color: '#10b981', amount: true },
  { type: 'expense',      label: 'Lump Expense',  color: '#fc5b3f', amount: true },
  { type: 'end',          label: 'Forecast End',  color: '#64748b', amount: false, single: true },
];
const ETYPE = Object.fromEntries(EVENT_TYPES.map(e => [e.type, e]));
const defaultAmount = (type) => ({ statepension: 11000, inheritance: 50000, expense: 20000 }[type] ?? 0);

let _idc = 0;
const uid = () => `x${++_idc}`;

export default function CashCalView({ symbol = '$', currency = 'USD' }) {
  const [assets, setAssets] = useState([
    { id: uid(), name: 'Savings',             value: 112000, growth: 2 },
    { id: uid(), name: 'House / Property',    value: 565000, growth: 3 },
    { id: uid(), name: 'Investment portfolio',value: 408000, growth: 6 },
  ]);
  const [events, setEvents] = useState([
    { id: uid(), type: 'retirement', age: 60, amount: 0 },
    { id: uid(), type: 'end',        age: 90, amount: 0 },
  ]);
  const [currentAge,  setCurrentAge]  = useState(45);
  const [inflation,   setInflation]   = useState(3);
  const [spending,    setSpending]    = useState(45000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [ihtJoint,   setIhtJoint]   = useState(false);
  const [coverSum,   setCoverSum]   = useState(0);
  const [coverType,  setCoverType]  = useState('Whole of Life');
  const [coverTerm,  setCoverTerm]  = useState(20);
  const [coverTrust, setCoverTrust] = useState(true);
  const [addOpen,     setAddOpen]     = useState(false);
  const [selEvent,    setSelEvent]    = useState(null);

  const trackRef = useRef(null);

  const n   = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
  const fmt  = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v || 0);
  const fmtk = (v) => `${symbol}${Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`;

  // ── Assets ─────────────────────────────────────────────────────────────────
  const addAsset = (tpl) => {
    setAssets(p => [...p, { id: uid(), name: tpl ? tpl.name : 'New asset', value: tpl?.liability ? -50000 : 0, growth: tpl ? tpl.growth : 2 }]);
    setAddOpen(false);
  };
  const removeAsset = (id) => setAssets(p => p.filter(a => a.id !== id));
  const updateAsset = (id, field, val) =>
    setAssets(p => p.map(a => a.id === id ? { ...a, [field]: field === 'name' ? val : (val === '' ? '' : parseFloat(val)) } : a));

  const totalStart = assets.reduce((s, a) => s + n(a.value), 0);
  const avgGrowth  = totalStart > 0 ? assets.reduce((s, a) => s + n(a.value) * n(a.growth), 0) / totalStart : 0;

  // ── Events / timeline ────────────────────────────────────────────────────────
  const retireAge   = n(events.find(e => e.type === 'retirement')?.age, 60);
  const forecastEnd = Math.max(n(events.find(e => e.type === 'end')?.age, 90), n(currentAge) + 1);
  const startAge    = n(currentAge);
  const span        = Math.max(1, forecastEnd - startAge);
  const ageToPct    = (age) => Math.min(100, Math.max(0, ((age - startAge) / span) * 100));

  const dropToAge = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(startAge + frac * span);
  };
  const onTrackDrop = (e) => {
    e.preventDefault();
    let p; try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    const age = dropToAge(e.clientX);
    if (p.kind === 'new') {
      setEvents(prev => {
        const next = ETYPE[p.type]?.single ? prev.filter(ev => ev.type !== p.type) : prev;
        return [...next, { id: uid(), type: p.type, age, amount: defaultAmount(p.type) }];
      });
    } else if (p.kind === 'move') {
      setEvents(prev => prev.map(ev => ev.id === p.id ? { ...ev, age } : ev));
    }
  };
  const updateEvent = (id, field, val) =>
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, [field]: val === '' ? '' : parseFloat(val) } : ev));
  const removeEvent = (id) => { setEvents(prev => prev.filter(ev => ev.id !== id)); setSelEvent(null); };

  // ── Projection ──────────────────────────────────────────────────────────────
  const { rows, depletionAge, lasts, finalTotal } = useMemo(() => {
    const ca = startAge, ra = Math.max(retireAge, ca), ea = forecastEnd;
    const infl = n(inflation) / 100;
    let bal = assets.map(a => ({ id: a.id, v: n(a.value) }));
    const out = [];
    let depAge = null;

    const positives = (b) => b.reduce((s, x) => s + Math.max(0, x.v), 0);
    const applyLump = (b, amt) => {                       // amt + (add) or − (spend), from positives
      const pos = positives(b);
      if (amt >= 0) {
        if (pos > 0) b.forEach(x => { if (x.v > 0) x.v += amt * (x.v / pos); });
        else if (b.length) b[0].v += amt;
      } else {
        const need = -amt;
        if (pos <= need) b.forEach(x => { if (x.v > 0) x.v = 0; });
        else b.forEach(x => { if (x.v > 0) x.v -= need * (x.v / pos); });
      }
    };

    for (let age = ca; age <= ea; age++) {
      if (age > ca) {
        const inflFactor = Math.pow(1 + infl, age - ca);
        bal = bal.map((b, i) => ({ ...b, v: b.v * (1 + n(assets[i].growth) / 100) }));

        // lump events landing on this age (today's money → inflated)
        events.filter(e => e.age === age && (e.type === 'inheritance' || e.type === 'expense')).forEach(e => {
          applyLump(bal, (e.type === 'inheritance' ? 1 : -1) * n(e.amount) * inflFactor);
        });

        // retirement drawdown, net of (other income + any active state pensions)
        if (age >= ra) {
          const pension = events.filter(e => e.type === 'statepension' && age >= e.age).reduce((s, e) => s + n(e.amount), 0);
          const net = Math.max(0, n(spending) - n(otherIncome) - pension) * inflFactor;
          if (net > 0) {
            if (positives(bal) <= net) { bal.forEach(b => { if (b.v > 0) b.v = 0; }); if (depAge == null) depAge = age; }
            else applyLump(bal, -net);
          }
        }
      }
      const row = { age };
      assets.forEach((a, i) => { row[a.id] = Math.round(bal[i].v); });
      out.push(row);
    }

    const last = out.length ? assets.reduce((s, a) => s + (out[out.length - 1][a.id] || 0), 0) : 0;
    return { rows: out, depletionAge: depAge, lasts: depAge == null, finalTotal: last };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, events, currentAge, inflation, spending, otherIncome, retireAge, forecastEnd]);

  // Estate / IHT at the forecast-end age (nominal estate vs today's frozen bands),
  // with an optional life policy — a term policy that has expired by the forecast
  // age provides no cover; in-trust cover offsets the bill, non-trust adds to it.
  const ihtEstate     = Math.max(0, finalTotal);
  const yearsToEnd    = Math.max(0, forecastEnd - n(currentAge));
  const coverInForce  = coverType === 'Whole of Life' || yearsToEnd <= n(coverTerm);
  const activeCover   = coverInForce ? n(coverSum) : 0;
  const estateForIht  = ihtEstate + (coverInForce && !coverTrust ? activeCover : 0);
  const ihtDue        = estimateIHT(estateForIht, { joint: ihtJoint });
  const coverOffset   = coverInForce && coverTrust ? activeCover : 0;
  const ihtAfterCover = Math.max(0, ihtDue - coverOffset);
  const netToHeirs    = estateForIht - ihtDue + coverOffset;
  const termLapsed    = coverType !== 'Whole of Life' && n(coverSum) > 0 && yearsToEnd > n(coverTerm);

  // Draggable palette chip
  const PaletteChip = ({ et }) => (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'new', type: et.type })); e.dataTransfer.effectAllowed = 'copy'; }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-grab active:cursor-grabbing border select-none"
      style={{ color: et.color, borderColor: `${et.color}40`, backgroundColor: `${et.color}10` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: et.color }} /> {et.label}
    </div>
  );

  const selectedEvent = events.find(e => e.id === selEvent);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in">
      {/* Header + outcome */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cash Planner</h1>
          </div>
          <p className="text-gray-500 ml-1">Project assets, events & drawdown to the forecast-end age · {currency}</p>
        </div>
        <div className={`p-5 rounded-xl shadow-sm border min-w-[260px] ${lasts ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-500">Outcome</p>
          {lasts ? (
            <>
              <p className="text-xl font-bold text-emerald-700 leading-tight">Funds last to age {forecastEnd} ✓</p>
              <p className="text-xs text-emerald-600 mt-1">Projected balance ≈ {fmt(finalTotal)} <span className="text-gray-400">(nominal)</span></p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-rose-700 leading-tight">Runs out at age {depletionAge}</p>
              <p className="text-xs text-rose-600 mt-1">{forecastEnd - depletionAge} year(s) short of forecast end</p>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Assets list */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Assets, savings & investments</h3>
            <div className="relative">
              <button onClick={() => setAddOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand2">
                <Plus size={14} /> Add asset
              </button>
              {addOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white/75 backdrop-blur-sm rounded-xl border border-gray-200 shadow-xl p-2 z-20 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick add category</div>
                    {ASSET_TEMPLATES.map(t => (
                      <button key={t.name} onClick={() => addAsset(t)} className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg">
                        <span>{t.name}</span><span className="text-gray-400 font-mono">{t.growth}%</span>
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => addAsset(null)} className="w-full text-left px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">+ Blank asset</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {assets.map((a, i) => (
            <div key={a.id} className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <input type="text" value={a.name} onChange={(e) => updateAsset(a.id, 'name', e.target.value)}
                className="flex-1 min-w-0 font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand outline-none text-sm py-0.5" />
              <div className="relative w-32 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span>
                <input type="number" step={1000} value={a.value} onChange={(e) => updateAsset(a.id, 'value', e.target.value)}
                  className="w-full pl-5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-semibold outline-none focus:border-brand" />
              </div>
              <div className="relative w-20 shrink-0" title="Annual growth / return">
                <input type="number" step={0.1} value={a.growth} onChange={(e) => updateAsset(a.id, 'growth', e.target.value)}
                  className="w-full pl-2 pr-5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-brand" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
              </div>
              <button onClick={() => removeAsset(a.id)} className="p-1.5 text-gray-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}

          <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-500 font-semibold">Net total at start: <span className="text-gray-900 font-bold ml-1">{fmt(totalStart)}</span></span>
            <span className="text-gray-500 font-semibold">Avg growth: <span className="text-brand font-bold ml-1">{avgGrowth.toFixed(2)}%</span></span>
          </div>
        </div>

        {/* Assumptions */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Assumptions</h3>
          <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            {[
              ['Current age', currentAge, setCurrentAge, 'yrs', 1],
              ['Inflation rate', inflation, setInflation, '%', 0.1],
            ].map(([label, val, setter, suffix, step]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-gray-500">{label}</label>
                <div className="relative w-28">
                  <input type="number" step={step} value={val} onChange={(e) => setter(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-2 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-semibold outline-none focus:border-brand" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">{suffix}</span>
                </div>
              </div>
            ))}
            <div className="h-px bg-gray-100" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Retirement spending (today's money)</p>
            {[['Annual spending', spending, setSpending], ['Other income', otherIncome, setOtherIncome]].map(([label, val, setter]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-gray-500">{label}</label>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span>
                  <input type="number" step={500} value={val} onChange={(e) => setter(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full pl-5 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-semibold outline-none focus:border-brand" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estate & IHT at forecast end */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-0.5">Estate & IHT at age {forecastEnd}</h3>
            <p className="text-xs text-gray-400">Estimated UK inheritance tax on the projected estate (nominal · today's bands · £2m RNRB taper).</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={ihtJoint} onChange={(e) => setIhtJoint(e.target.checked)} /> Joint / married (double bands)
          </label>
        </div>

        {/* Life cover row */}
        <div className="flex flex-wrap items-end gap-3 mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Life cover</label>
            <div className="relative w-32"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span>
              <input type="number" step={10000} value={coverSum} onChange={(e) => setCoverSum(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></div>
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
            <select value={coverType} onChange={(e) => setCoverType(e.target.value)} className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none"><option>Whole of Life</option><option>Level Term</option><option>Decreasing Term</option></select></div>
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Term (yrs)</label>
            <input type="number" disabled={coverType === 'Whole of Life'} value={coverTerm} onChange={(e) => setCoverTerm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-20 py-1.5 px-2 bg-white border border-gray-200 rounded-lg font-mono text-sm outline-none disabled:bg-gray-100 disabled:text-gray-300" /></div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 pb-1.5"><input type="checkbox" checked={coverTrust} onChange={(e) => setCoverTrust(e.target.checked)} /> In trust</label>
          {termLapsed && <span className="text-[11px] font-bold text-rose-600 pb-1.5">⚠ Term lapses at age {n(currentAge) + n(coverTerm)} — no cover at {forecastEnd}</span>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Estate at death</p><p className="text-xl font-bold text-gray-900 font-mono">{fmt(estateForIht)}</p></div>
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-100"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Estimated IHT</p><p className="text-xl font-bold text-rose-600 font-mono">{fmt(ihtDue)}</p></div>
          <div className="bg-white/75 backdrop-blur-sm rounded-xl p-4 border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">After cover</p><p className={`text-xl font-bold font-mono ${ihtAfterCover > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{ihtAfterCover > 0 ? fmt(ihtAfterCover) : 'Covered ✓'}</p></div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Net to heirs</p><p className="text-xl font-bold text-emerald-600 font-mono">{fmt(netToHeirs)}</p></div>
        </div>
      </div>

      {/* Events & timeline (drag-and-drop) */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mt-6">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Events & Timeline</h3>
        <p className="text-xs text-gray-400 mb-3">Drag an event onto the timeline. Drag a placed event to move it; click it to edit or delete.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {EVENT_TYPES.map(et => <PaletteChip key={et.type} et={et} />)}
        </div>

        <div
          ref={trackRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onTrackDrop}
          className="relative h-24 bg-gray-50 border border-dashed border-gray-300 rounded-xl"
        >
          {/* retirement shading */}
          <div className="absolute top-0 bottom-6 bg-brand6/40 rounded-l-xl pointer-events-none"
            style={{ left: `${ageToPct(retireAge)}%`, right: 0 }} />
          {/* placed events */}
          {events.map(ev => {
            const et = ETYPE[ev.type];
            return (
              <div
                key={ev.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'move', id: ev.id })); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => setSelEvent(ev.id)}
                className="absolute -translate-x-1/2 top-2 px-2 py-1 rounded-md text-[10px] font-bold text-white cursor-grab active:cursor-grabbing shadow-sm whitespace-nowrap"
                style={{ left: `${ageToPct(ev.age)}%`, backgroundColor: et?.color, outline: selEvent === ev.id ? '2px solid #111' : 'none' }}
                title={`${et?.label} @ age ${ev.age}`}
              >
                {et?.label} · {ev.age}
              </div>
            );
          })}
          {/* axis ticks */}
          <div className="absolute bottom-0 left-0 right-0 h-6 flex justify-between px-1 text-[9px] font-mono text-gray-400">
            {Array.from({ length: 6 }).map((_, k) => {
              const age = Math.round(startAge + (span * k) / 5);
              return <span key={k}>{age}</span>;
            })}
          </div>
        </div>

        {/* selected-event editor */}
        {selectedEvent && (
          <div className="mt-3 flex flex-wrap items-end gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <span className="text-xs font-bold text-gray-700">{ETYPE[selectedEvent.type]?.label}</span>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Age</label>
              <input type="number" value={selectedEvent.age} onChange={(e) => updateEvent(selectedEvent.id, 'age', e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-brand" />
            </div>
            {ETYPE[selectedEvent.type]?.amount && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Amount {selectedEvent.type === 'statepension' ? '(/yr)' : ''} · today's money</label>
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span>
                  <input type="number" step={500} value={selectedEvent.amount} onChange={(e) => updateEvent(selectedEvent.id, 'amount', e.target.value)}
                    className="w-full pl-5 pr-2 py-1 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-brand" />
                </div>
              </div>
            )}
            <button onClick={() => removeEvent(selectedEvent.id)} className="flex items-center gap-1 px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold">
              <Trash2 size={13} /> Remove
            </button>
            <button onClick={() => setSelEvent(null)} className="ml-auto p-1 text-gray-400 hover:text-gray-700"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Stacked bar projection */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-gray-800">How assets change over time</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500">
            {assets.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} /> {a.name}</span>
            ))}
          </div>
        </div>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(rows.length / 12))} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={48} tickFormatter={fmtk} />
              <Tooltip formatter={(v, name) => [fmt(v), assets.find(a => a.id === name)?.name || name]} labelFormatter={(age) => `Age ${age}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <ReferenceLine x={retireAge} stroke="#9966ff" strokeDasharray="4 4" label={{ value: 'Retire', position: 'top', fontSize: 10, fill: '#9966ff' }} />
              {assets.map((a, i) => (
                <Bar key={a.id} dataKey={a.id} stackId="s" fill={COLORS[i % COLORS.length]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Each asset compounds at its own rate; events (inheritance, lump expense, state pension) and inflation-linked drawdown
          from the retirement age are applied to the projection. Deterministic — no sequence-of-returns risk or tax. Values nominal.
        </p>
      </div>
    </div>
  );
}
