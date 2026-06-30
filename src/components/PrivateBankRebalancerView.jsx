// ─────────────────────────────────────────────────────────────────────────────
// PrivateBankRebalancerView.jsx
//
// A rebalancer for private-banking: multi-currency holdings (native + base
// value side by side), per-trade transaction charges via the bank's CHF-tiered
// schedule (live FX), selectable bank, and configurable loan lines (liability
// and/or drawable to fund purchases).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { resolveRate, computeTransactionFee, mapBankClass, CURRENCY_SYMBOLS, PB_CHARGES } from '../constants';
import { Plus, Trash2, DollarSign, TrendingUp, Check, X } from './Icons';

const CCYS = ['USD', 'GBP', 'EUR', 'AUD', 'CHF', 'AED'];
const sym = (c) => CURRENCY_SYMBOLS[c] || (c === 'CHF' ? 'Fr' : c + ' ');

export default function PrivateBankRebalancerView({ pricesData = {}, liveRates = {}, charges = null, currency = 'USD' }) {
  const schedule = charges || PB_CHARGES;
  const banks = Object.keys(schedule);

  const [bank, setBank]     = useState(banks[0] || 'Schroders');
  const [base, setBase]     = useState(currency);
  const [cashFlow, setCash] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const [holdings, setHoldings] = useState([
    { id: crypto.randomUUID(), name: 'iShares Core S&P 500', isin: 'IE00B5BMR087', ccy: 'USD', price: 794, units: 200, target: 50, cls: 'Equity', feeClass: '' },
    { id: crypto.randomUUID(), name: 'Dimensional Global Short FI', isin: 'IE00B3QL0Y14', ccy: 'EUR', price: 8.54, units: 20000, target: 30, cls: 'Bond', feeClass: '' },
    { id: crypto.randomUUID(), name: 'Cash', isin: 'Cash', ccy: 'CHF', price: 1, units: 100000, target: 20, cls: 'Cash', feeClass: '' },
  ]);
  const [loans, setLoans] = useState([]);

  const bankClasses = useMemo(() => Object.keys(schedule[bank]?.classes || {}), [schedule, bank]);

  // Re-default each holding's fee category when the bank changes.
  useEffect(() => {
    setHoldings(prev => prev.map(h => ({ ...h, feeClass: mapBankClass(h.cls, bankClasses) })));
  }, [bank, bankClasses]);

  const fmtBase = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: base, maximumFractionDigits: 0 }).format(v || 0);
  const fmtN = (v, d = 2) => (v == null ? '—' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));

  const updateH = (id, field, val) => setHoldings(prev => prev.map(h => h.id === id ? { ...h, [field]: val } : h));
  const removeH = (id) => setHoldings(prev => prev.filter(h => h.id !== id));
  const addBlank = () => { setHoldings(prev => [...prev, { id: crypto.randomUUID(), name: 'New holding', isin: '', ccy: base, price: '', units: '', target: '', cls: 'Equity', feeClass: mapBankClass('Equity', bankClasses) }]); setAddOpen(false); };
  const addFromPool = (asset, ticker) => {
    setHoldings(prev => [...prev, {
      id: crypto.randomUUID(), name: asset.name, isin: asset.isin, ccy: asset.currency || base,
      price: asset.price, units: '', target: '', cls: asset.assetClass || 'Equity',
      feeClass: mapBankClass(asset.assetClass || 'Equity', bankClasses),
    }]);
    setAddOpen(false);
  };

  const addLoan    = () => setLoans(prev => [...prev, { id: crypto.randomUUID(), name: 'Lombard loan', amount: 0, ccy: base, rate: 3, drawable: true }]);
  const updateLoan = (id, field, val) => setLoans(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  const removeLoan = (id) => setLoans(prev => prev.filter(l => l.id !== id));

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const av = holdings.reduce((s, h) => s + (parseFloat(h.price) || 0) * (parseFloat(h.units) || 0) * resolveRate(h.ccy, base, liveRates), 0);
    const loanBase = loans.reduce((s, l) => s + (parseFloat(l.amount) || 0) * resolveRate(l.ccy, base, liveRates), 0);
    const drawable = loans.reduce((s, l) => s + (l.drawable ? (parseFloat(l.amount) || 0) * resolveRate(l.ccy, base, liveRates) : 0), 0);
    const cf = parseFloat(cashFlow) || 0;
    return { assetBase: av, loanBase, drawable, netWorth: av - loanBase, investable: av + cf + drawable };
  }, [holdings, loans, cashFlow, base, liveRates]);

  const totalWeight = holdings.reduce((s, h) => s + (parseFloat(h.target) || 0), 0);

  // ── Directives ───────────────────────────────────────────────────────────────
  const directives = useMemo(() => {
    return holdings.map(h => {
      const baseVal   = (parseFloat(h.price) || 0) * (parseFloat(h.units) || 0) * resolveRate(h.ccy, base, liveRates);
      const idealBase = totals.investable * ((parseFloat(h.target) || 0) / 100);
      const deltaBase = idealBase - baseVal;
      const deltaNat  = deltaBase * resolveRate(base, h.ccy, liveRates);   // in holding ccy
      const tradeNat  = Math.abs(deltaNat);
      const f = computeTransactionFee(tradeNat, h.ccy, h.feeClass, bank, liveRates, schedule);
      const feeBase = f.fee * resolveRate(h.ccy, base, liveRates);
      const units = (parseFloat(h.price) || 0) > 0 ? deltaNat / (parseFloat(h.price) || 1) : 0;
      return { h, baseVal, deltaBase, deltaNat, tradeNat, fee: f.fee, feeBase, rate: f.rate, appliedMin: f.appliedMin, units, isBuy: deltaBase > 0 };
    });
  }, [holdings, totals.investable, base, liveRates, bank, schedule]);

  const totalFees = directives.reduce((s, d) => s + (Math.abs(d.deltaBase) > 1 ? d.feeBase : 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 mb-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-brand6 rounded-xl flex items-center justify-center text-brand"><DollarSign size={22} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Private Bank Rebalancer</h2>
            <p className="text-xs text-gray-400">Multi-currency · live FX · {bank} transaction charges</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bank</label>
            <select value={bank} onChange={(e) => setBank(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none">
              {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Base currency</label>
            <select value={base} onChange={(e) => setBase(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none">
              {CCYS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cash flow ({base})</label>
            <input type="number" value={cashFlow} onChange={(e) => setCash(e.target.value)} placeholder="0"
              className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-brand" />
          </div>
          <div className="relative">
            <button onClick={() => setAddOpen(o => !o)} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand2"><Plus size={15} /> Add</button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-2 z-20">
                  <button onClick={addBlank} className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg">+ Blank holding</button>
                  <div className="border-t border-gray-100 my-1" />
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">From data pool</div>
                  <div className="max-h-56 overflow-y-auto">
                    {Object.entries(pricesData).map(([t, a]) => (
                      <button key={t} onClick={() => addFromPool(a, t)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 rounded-md flex justify-between gap-2">
                        <span className="truncate font-semibold text-gray-700">{a.name}</span>
                        <span className="text-gray-400 font-mono shrink-0">{a.currency}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-56">Holding</th>
                <th className="py-3 px-3">ISIN</th>
                <th className="py-3 px-2">Ccy</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Units</th>
                <th className="py-3 px-3 text-right">Native value</th>
                <th className="py-3 px-3 text-right">Base ({base})</th>
                <th className="py-3 px-3">Fee category</th>
                <th className="py-3 px-3 text-center">Target %</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holdings.map(h => {
                const nat = (parseFloat(h.price) || 0) * (parseFloat(h.units) || 0);
                return (
                  <tr key={h.id} className="hover:bg-gray-50/40">
                    <td className="py-2 px-4"><input value={h.name} onChange={(e) => updateH(h.id, 'name', e.target.value)} className="w-full font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-brand" /></td>
                    <td className="py-2 px-3"><input value={h.isin} onChange={(e) => updateH(h.id, 'isin', e.target.value.toUpperCase())} className="w-28 font-mono text-xs text-gray-500 bg-transparent outline-none border-b border-transparent focus:border-brand" /></td>
                    <td className="py-2 px-2">
                      <select value={h.ccy} onChange={(e) => updateH(h.id, 'ccy', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md px-1 py-1 text-xs font-bold outline-none">
                        {CCYS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right"><input type="number" value={h.price} onChange={(e) => updateH(h.id, 'price', e.target.value)} className="w-20 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono" /></td>
                    <td className="py-2 px-3 text-right"><input type="number" value={h.units} onChange={(e) => updateH(h.id, 'units', e.target.value)} className="w-24 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono" /></td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-700 font-mono">{sym(h.ccy)}{fmtN(nat, 0)}</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900 font-mono">{fmtBase(nat * resolveRate(h.ccy, base, liveRates))}</td>
                    <td className="py-2 px-3">
                      <select value={h.feeClass} onChange={(e) => updateH(h.id, 'feeClass', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1 text-[11px] font-semibold text-gray-700 outline-none max-w-[150px]">
                        {bankClasses.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center"><input type="number" value={h.target} onChange={(e) => updateH(h.id, 'target', e.target.value)} className="w-14 text-center bg-gray-50 border border-gray-100 rounded-md px-1 py-1 outline-none font-bold text-xs" />%</td>
                    <td className="py-2 px-3 text-right"><button onClick={() => removeH(h.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">Portfolio value: <b className="text-gray-900">{fmtBase(totals.assetBase)}</b></span>
          <span className="text-gray-500">Net worth (− loans): <b className="text-gray-900">{fmtBase(totals.netWorth)}</b></span>
          <span className="text-gray-500">Investable: <b className="text-brand">{fmtBase(totals.investable)}</b></span>
          <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold flex items-center gap-1 ${Math.abs(totalWeight - 100) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) < 0.01 ? <Check size={11} /> : <X size={11} />}
          </span>
        </div>
      </div>

      {/* Loans */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Loans / Lombard facilities</h3>
          <button onClick={addLoan} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add loan</button>
        </div>
        {loans.length === 0 ? <p className="text-xs text-gray-400 italic">No loans. Add a Lombard facility to borrow against the portfolio.</p> : (
          <div className="space-y-2">
            {loans.map(l => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <input value={l.name} onChange={(e) => updateLoan(l.id, 'name', e.target.value)} className="flex-1 min-w-[120px] font-semibold text-gray-800 bg-transparent outline-none text-sm" />
                <div className="relative w-32"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{sym(l.ccy)}</span>
                  <input type="number" value={l.amount} onChange={(e) => updateLoan(l.id, 'amount', parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none" /></div>
                <select value={l.ccy} onChange={(e) => updateLoan(l.id, 'ccy', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none">{CCYS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <div className="relative w-20"><input type="number" value={l.rate} onChange={(e) => updateLoan(l.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full pl-2 pr-5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span></div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600"><input type="checkbox" checked={l.drawable} onChange={(e) => updateLoan(l.id, 'drawable', e.target.checked)} /> Drawable</label>
                <button onClick={() => removeLoan(l.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <p className="text-[10px] text-gray-400">Drawable loans add to investable capital (leverage); all loans reduce net worth. Total loans: {fmtBase(totals.loanBase)}.</p>
          </div>
        )}
      </div>

      {/* Directives */}
      {totalWeight > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2"><TrendingUp size={18} className="text-brand" /><h3 className="font-bold text-gray-900">Rebalance directives & charges</h3></div>
            <span className="text-sm font-bold text-gray-500">Total cost: <span className="text-brand3">{fmtBase(totalFees)}</span></span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {directives.map(d => {
              if (Math.abs(d.deltaBase) < 1) return null;
              return (
                <div key={d.h.id} className={`p-4 rounded-xl border ${d.isBuy ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/20 border-rose-100'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-gray-800 truncate">{d.h.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${d.isBuy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{d.isBuy ? 'BUY' : 'SELL'}</span>
                  </div>
                  <div className="space-y-1 text-xs border-t border-gray-100/60 pt-2">
                    <div className="flex justify-between"><span className="text-gray-400">Trade ({d.h.ccy}):</span><span className="font-mono font-bold text-gray-700">{sym(d.h.ccy)}{fmtN(d.tradeNat, 0)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">≈ Base:</span><span className="font-mono text-gray-600">{fmtBase(Math.abs(d.deltaBase))}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Est. units:</span><span className="font-mono">{d.isBuy ? '+' : ''}{fmtN(d.units, 2)}</span></div>
                    <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span className="text-gray-500 font-semibold">Charge {d.appliedMin ? '(min)' : `(${(d.rate * 100).toFixed(3)}%)`}:</span><span className="font-mono font-bold text-brand3">{fmtBase(d.feeBase)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
