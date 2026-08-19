// ─────────────────────────────────────────────────────────────────────────────
// FactFindView.jsx — client fact-find form.
//
//   • Structured form (client / planning / assets / gifts / protection / IHT).
//   • Export → downloads the fact find as a .json file (the "save").
//   • Import → uploads a .json fact find and re-populates the form.
//   • Load into tools → seeds Cash Planner + IHT from the current form
//     (via factToCashCal / factToIHT) and jumps to Cash Planner.
//
// The form owns its state locally; because all views stay mounted, it persists
// across tab switches (a full refresh clears it — export to keep it).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import { Plus, Trash2, Download, Check } from './Icons';
import { EMPTY_FACT_FIND, normaliseFactFind, ASSET_CATEGORIES, IHT_STATUSES } from '../factfind';

const Upload = ({ size = 15 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const card  = "bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mb-5";
const label = "block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1";
const input = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand";
const inNum = input + " font-mono";
const h3    = "text-sm font-bold text-gray-800 mb-3";

export default function FactFindView({ symbol = '£', onApply }) {
  const [ff, setFf]       = useState(EMPTY_FACT_FIND);
  const [applied, setApplied] = useState(false);
  const fileRef = useRef(null);

  // ── field helpers ───────────────────────────────────────────────────────────
  const setClient   = (f, v) => setFf(p => ({ ...p, client:   { ...p.client,   [f]: v } }));
  const setPlanning = (f, v) => setFf(p => ({ ...p, planning: { ...p.planning, [f]: v } }));
  const setIht      = (f, v) => setFf(p => ({ ...p, iht:      { ...p.iht,      [f]: v } }));

  const addRow = (key, row) => setFf(p => ({ ...p, [key]: [...p[key], row] }));
  const updRow = (key, i, f, v) => setFf(p => ({ ...p, [key]: p[key].map((r, j) => j === i ? { ...r, [f]: v } : r) }));
  const delRow = (key, i) => setFf(p => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }));

  // ── import / export ───────────────────────────────────────────────────────────
  const exportJSON = () => {
    const data = { ...ff, meta: { ...ff.meta, savedAt: new Date().toISOString() } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const who = [ff.client.lastName, ff.client.firstName].filter(Boolean).join('_') || 'client';
    a.download = `factfind_${who}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setFf(normaliseFactFind(JSON.parse(reader.result))); }
      catch { alert('That file is not a valid fact-find JSON.'); }
    };
    reader.readAsText(file);
    e.target.value = '';   // allow re-importing the same file
  };

  const apply = () => { onApply && onApply(ff); setApplied(true); setTimeout(() => setApplied(false), 2500); };

  const money = (f, v, onCh) => (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{symbol}</span>
      <input type="number" value={v} onChange={onCh} className={inNum + " pl-6"} placeholder="0" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Heading + actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Fact Find</h2>
          <p className="text-sm text-gray-500">Capture the client's details, save as a file, and load them into Cash Planner &amp; IHT.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={importJSON} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50"><Upload size={15} /> Import</button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50"><Download size={15} /> Export</button>
          <button onClick={apply} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand2">
            {applied ? <><Check size={15} /> Loaded</> : <>Load into Cash Planner &amp; IHT</>}
          </button>
        </div>
      </div>

      {/* Client */}
      <div className={card}>
        <h3 className={h3}>Client</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className={label}>First name</label><input value={ff.client.firstName} onChange={e => setClient('firstName', e.target.value)} className={input} /></div>
          <div><label className={label}>Last name</label><input value={ff.client.lastName} onChange={e => setClient('lastName', e.target.value)} className={input} /></div>
          <div><label className={label}>Date of birth</label><input type="date" value={ff.client.dob} onChange={e => setClient('dob', e.target.value)} className={input} /></div>
          <div><label className={label}>Marital status</label>
            <select value={ff.client.maritalStatus} onChange={e => setClient('maritalStatus', e.target.value)} className={input}>
              {['single', 'married', 'civil partnership', 'divorced', 'widowed'].map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Planning assumptions */}
      <div className={card}>
        <h3 className={h3}>Planning assumptions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div><label className={label}>Current age</label><input type="number" value={ff.planning.currentAge} onChange={e => setPlanning('currentAge', e.target.value)} className={inNum} /></div>
          <div><label className={label}>Retirement age</label><input type="number" value={ff.planning.retirementAge} onChange={e => setPlanning('retirementAge', e.target.value)} className={inNum} /></div>
          <div><label className={label}>Forecast end age</label><input type="number" value={ff.planning.forecastEndAge} onChange={e => setPlanning('forecastEndAge', e.target.value)} className={inNum} /></div>
          <div><label className={label}>Inflation %</label><input type="number" step="0.1" value={ff.planning.inflation} onChange={e => setPlanning('inflation', e.target.value)} className={inNum} /></div>
          <div><label className={label}>State pension age</label><input type="number" value={ff.planning.statePensionAge} onChange={e => setPlanning('statePensionAge', e.target.value)} className={inNum} /></div>
          <div><label className={label}>State pension {symbol}/yr</label>{money('sp', ff.planning.statePensionAmount, e => setPlanning('statePensionAmount', e.target.value))}</div>
          <div><label className={label}>Annual spending {symbol}</label>{money('sp2', ff.planning.annualSpending, e => setPlanning('annualSpending', e.target.value))}</div>
          <div><label className={label}>Other income {symbol}/yr</label>{money('oi', ff.planning.otherIncome, e => setPlanning('otherIncome', e.target.value))}</div>
        </div>
      </div>

      {/* Assets */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Assets &amp; savings</h3>
          <button onClick={() => addRow('assets', { name: 'New asset', category: 'Investment', value: 0, growth: 5, ihtStatus: 'Subject' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add asset</button>
        </div>
        {ff.assets.length === 0 ? <p className="text-xs text-gray-400 italic">No assets yet — add the client's savings, investments, pensions and property.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[720px]">
            <thead><tr className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
              <th className="py-2 px-2">Name</th><th className="py-2 px-2 w-40">Category</th><th className="py-2 px-2 w-36">Value</th><th className="py-2 px-2 w-24">Growth %</th><th className="py-2 px-2 w-40">IHT status</th><th className="py-2 px-2 w-10"></th>
            </tr></thead>
            <tbody>
              {ff.assets.map((a, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 px-2"><input value={a.name} onChange={e => updRow('assets', i, 'name', e.target.value)} className="w-full bg-transparent outline-none font-semibold text-gray-700" /></td>
                  <td className="py-1.5 px-2"><select value={a.category} onChange={e => updRow('assets', i, 'category', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none">{ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></td>
                  <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={a.value} onChange={e => updRow('assets', i, 'value', e.target.value)} className="w-full pl-5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                  <td className="py-1.5 px-2"><input type="number" step="0.1" value={a.growth} onChange={e => updRow('assets', i, 'growth', e.target.value)} className="w-full py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></td>
                  <td className="py-1.5 px-2"><select value={a.ihtStatus} onChange={e => updRow('assets', i, 'ihtStatus', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none">{IHT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                  <td className="py-1.5 px-2 text-right"><button onClick={() => delRow('assets', i)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p className="mt-2 text-[10px] text-gray-400">Value + Growth feed Cash Planner; Value + IHT status feed the IHT estate (use a negative value for a loan/mortgage).</p>
      </div>

      {/* Lifetime gifts */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Lifetime gifts (last 7 years)</h3>
          <button onClick={() => addRow('gifts', { desc: 'Gift', amount: 0, exempt: 0, yearsAgo: 1 })} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add gift</button>
        </div>
        {ff.gifts.length === 0 ? <p className="text-xs text-gray-400 italic">No gifts recorded.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[560px]">
            <thead><tr className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100"><th className="py-2 px-2">Description</th><th className="py-2 px-2 w-32">Amount</th><th className="py-2 px-2 w-32">Exemption</th><th className="py-2 px-2 w-24">Years ago</th><th className="py-2 px-2 w-10"></th></tr></thead>
            <tbody>
              {ff.gifts.map((g, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 px-2"><input value={g.desc} onChange={e => updRow('gifts', i, 'desc', e.target.value)} className="w-full bg-transparent outline-none font-semibold text-gray-700" /></td>
                  <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={g.amount} onChange={e => updRow('gifts', i, 'amount', e.target.value)} className="w-full pl-5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                  <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={g.exempt} onChange={e => updRow('gifts', i, 'exempt', e.target.value)} className="w-full pl-5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                  <td className="py-1.5 px-2"><input type="number" min="0" max="10" value={g.yearsAgo} onChange={e => updRow('gifts', i, 'yearsAgo', e.target.value)} className="w-20 py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></td>
                  <td className="py-1.5 px-2 text-right"><button onClick={() => delRow('gifts', i)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Protection */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Protection / life cover</h3>
          <button onClick={() => addRow('policies', { provider: 'Policy', type: 'Level Term', sumAssured: 0, term: 20, inTrust: true })} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add policy</button>
        </div>
        {ff.policies.length === 0 ? <p className="text-xs text-gray-400 italic">No policies. In-trust cover offsets IHT; non-trust cover adds to the estate.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[640px]">
            <thead><tr className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100"><th className="py-2 px-2">Provider</th><th className="py-2 px-2 w-40">Type</th><th className="py-2 px-2 w-36">Sum assured</th><th className="py-2 px-2 w-24">Term (yrs)</th><th className="py-2 px-2 w-24 text-center">In trust</th><th className="py-2 px-2 w-10"></th></tr></thead>
            <tbody>
              {ff.policies.map((pol, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 px-2"><input value={pol.provider} onChange={e => updRow('policies', i, 'provider', e.target.value)} className="w-full bg-transparent outline-none font-semibold text-gray-700" /></td>
                  <td className="py-1.5 px-2"><select value={pol.type} onChange={e => updRow('policies', i, 'type', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none">{['Level Term', 'Decreasing Term', 'Whole of Life'].map(o => <option key={o}>{o}</option>)}</select></td>
                  <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={pol.sumAssured} onChange={e => updRow('policies', i, 'sumAssured', e.target.value)} className="w-full pl-5 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                  <td className="py-1.5 px-2"><input type="number" value={pol.term} disabled={pol.type === 'Whole of Life'} onChange={e => updRow('policies', i, 'term', e.target.value)} className="w-20 py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none disabled:bg-gray-100 disabled:text-gray-300" /></td>
                  <td className="py-1.5 px-2 text-center"><input type="checkbox" checked={pol.inTrust} onChange={e => updRow('policies', i, 'inTrust', e.target.checked)} /></td>
                  <td className="py-1.5 px-2 text-right"><button onClick={() => delRow('policies', i)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* IHT options */}
      <div className={card}>
        <h3 className={h3}>IHT options</h3>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={ff.iht.married} onChange={e => setIht('married', e.target.checked)} /> Married / civil partner (transferable NRB &amp; RNRB)</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={ff.iht.claimRNRB} onChange={e => setIht('claimRNRB', e.target.checked)} /> Residence passes to direct descendants (claim RNRB)</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={ff.iht.pensionInEstate} onChange={e => setIht('pensionInEstate', e.target.checked)} /> Pensions in estate (Apr 2027)</label>
          <div><label className={label}>Charitable legacy {symbol}</label>{money('ch', ff.iht.charity, e => setIht('charity', e.target.value))}</div>
        </div>
      </div>
    </div>
  );
}
