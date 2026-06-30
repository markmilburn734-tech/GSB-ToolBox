// ─────────────────────────────────────────────────────────────────────────────
// CashCalView.jsx — "will it last?" cash-flow / longevity projection.
//
// Models a pot forward on assumptions: expected return, inflation, contributions
// while working, then inflation-linked spending (net of other income) through to
// life expectancy. Surfaces whether the money lasts, and projects nominal vs
// real (today's-money) value year by year.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DollarSign } from './Icons';

function NumberField({ label, hint, value, onChange, prefix, suffix, step = 1 }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
      <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">{prefix}</span>}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          className={`w-full ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'} py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-semibold outline-none focus:border-brand`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CashCalView({ symbol = '$', currency = 'USD' }) {
  const [currentAge,    setCurrentAge]    = useState(45);
  const [retireAge,     setRetireAge]     = useState(65);
  const [lifeExp,       setLifeExp]       = useState(90);
  const [startingPot,   setStartingPot]   = useState(300000);
  const [contribution,  setContribution]  = useState(12000);
  const [expReturn,     setExpReturn]     = useState(5);
  const [inflation,     setInflation]     = useState(2.5);
  const [spending,      setSpending]      = useState(36000);
  const [otherIncome,   setOtherIncome]   = useState(11000);

  const fmt = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v || 0);

  const n = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);

  const result = useMemo(() => {
    const ca = n(currentAge, 0), ra = Math.max(n(retireAge), ca), le = Math.max(n(lifeExp), ca);
    const r = n(expReturn) / 100, infl = n(inflation) / 100;
    let pot = n(startingPot);
    const rows = [];
    let depletionAge = null;
    let potAtRetire = null;

    for (let age = ca; age <= le; age++) {
      const yrs = age - ca;
      const inflFactor = Math.pow(1 + infl, yrs);

      // Start-of-year cash flow, then growth for the year.
      const working = age < ra;
      const cashflow = working
        ? n(contribution) * inflFactor
        : -(Math.max(0, n(spending) - n(otherIncome))) * inflFactor;

      pot = (pot + cashflow) * (1 + r);
      if (age === ra) potAtRetire = pot;

      const floored = Math.max(pot, 0);
      rows.push({
        age,
        nominal: Math.round(floored),
        real: Math.round(floored / inflFactor),
        phase: working ? 'Saving' : 'Drawdown',
      });

      if (pot <= 0 && depletionAge == null) { depletionAge = age; break; }
    }

    const lasts = depletionAge == null;
    const finalReal = rows.length ? rows[rows.length - 1].real : 0;
    return { rows, depletionAge, lasts, finalReal, potAtRetire, retireAge: ra, lifeExp: le };
  }, [currentAge, retireAge, lifeExp, startingPot, contribution, expReturn, inflation, spending, otherIncome]);

  const { rows, depletionAge, lasts, finalReal, potAtRetire } = result;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-brand p-2 rounded-lg"><DollarSign className="w-6 h-6 text-white" /></div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Cash Flow Planner</h1>
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">Assumptions-based</span>
          </div>
          <p className="text-gray-500 ml-1">Project savings → drawdown to life expectancy · {currency}</p>
        </div>
        <div className={`p-5 rounded-xl shadow-sm border min-w-[260px] ${lasts ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-500">Outcome</p>
          {lasts ? (
            <>
              <p className="text-xl font-bold text-emerald-700 leading-tight">Funds last to age {result.lifeExp} ✓</p>
              <p className="text-xs text-emerald-600 mt-1">Projected surplus ≈ {fmt(finalReal)} <span className="text-gray-400">(today's money)</span></p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-rose-700 leading-tight">Runs out at age {depletionAge}</p>
              <p className="text-xs text-rose-600 mt-1">{result.lifeExp - depletionAge} year{result.lifeExp - depletionAge === 1 ? '' : 's'} short of life expectancy ({result.lifeExp})</p>
            </>
          )}
        </div>
      </header>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 mb-6">
        <NumberField label="Current age"          value={currentAge}   onChange={setCurrentAge} suffix="yrs" />
        <NumberField label="Retirement age"       value={retireAge}    onChange={setRetireAge}  suffix="yrs" />
        <NumberField label="Life expectancy"      value={lifeExp}      onChange={setLifeExp}    suffix="yrs" />
        <NumberField label="Current pot"          value={startingPot}  onChange={setStartingPot} prefix={symbol} step={1000} />
        <NumberField label="Annual contribution"  hint="While working; grows with inflation" value={contribution} onChange={setContribution} prefix={symbol} step={500} />
        <NumberField label="Expected return"      hint="Net of fund fees, p.a." value={expReturn} onChange={setExpReturn} suffix="%" step={0.1} />
        <NumberField label="Inflation"            value={inflation}    onChange={setInflation}  suffix="%" step={0.1} />
        <NumberField label="Annual spending"      hint="In retirement, today's money" value={spending} onChange={setSpending} prefix={symbol} step={500} />
        <NumberField label="Other income"         hint="Pension / state, today's money" value={otherIncome} onChange={setOtherIncome} prefix={symbol} step={500} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pot at retirement</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{potAtRetire != null ? fmt(potAtRetire) : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Net drawdown / yr</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{fmt(Math.max(0, n(spending) - n(otherIncome)))}</p>
          <p className="text-[10px] text-gray-400">today's money</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Real return</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{(n(expReturn) - n(inflation)).toFixed(1)}%</p>
          <p className="text-[10px] text-gray-400">return − inflation</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Horizon</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{Math.max(0, n(lifeExp) - n(currentAge))} yrs</p>
        </div>
      </div>

      {/* Projection chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">Projected Pot Value by Age</h3>
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-brand" /> Nominal</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-brand3" /> Real (today's £/$/€)</span>
          </div>
        </div>
        <div className="w-full h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashNominal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d0738" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#2d0738" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={60}
                tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v, name) => [fmt(v), name === 'nominal' ? 'Nominal' : 'Real']}
                labelFormatter={(age) => `Age ${age}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <ReferenceLine x={result.retireAge} stroke="#9966ff" strokeDasharray="4 4" label={{ value: 'Retire', position: 'top', fontSize: 10, fill: '#9966ff' }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Area type="monotone" dataKey="nominal" stroke="#2d0738" strokeWidth={2} fill="url(#cashNominal)" isAnimationActive={false} />
              <Area type="monotone" dataKey="real" stroke="#fc5b3f" strokeWidth={1.5} fill="none" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Simplified deterministic model: a single average return is applied every year (no sequence-of-returns risk or tax).
          Spending and other income grow with inflation; “real” values are deflated to today's money.
        </p>
      </div>
    </div>
  );
}
