// ─────────────────────────────────────────────────────────────────────────────
// PrivateBankRebalancerView.jsx
//
// Private-banking rebalancer:
//   • Multi-currency holdings (native + base value), live FX.
//   • Add individual assets OR whole MODELS (added as an expandable wrapper:
//     the model carries one overall % of the portfolio, its constituents show
//     their own allocation underneath). Searchable add menu.
//   • Current allocation + skew vs target per line.
//   • Bank-specific, CHF-tiered transaction charges per trade.
//   • Buys round DOWN to the nearest 5 units, sells round UP — building a cash
//     margin (toggle for exact units).
//   • Configurable loans (liability and/or drawable for leverage).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { resolveRate, computeTransactionFee, mapBankClass, isCash, CURRENCY_SYMBOLS, PB_CHARGES } from '../constants';
import { Plus, Trash2, DollarSign, TrendingUp, Check, X, ChevronRight, Download } from './Icons';

const CCYS = ['USD', 'GBP', 'EUR', 'AUD', 'CHF', 'AED'];
const sym = (c) => CURRENCY_SYMBOLS[c] || (c === 'CHF' ? 'Fr ' : c + ' ');
const uid = () => crypto.randomUUID();

const Printer = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
);
const Lock = ({ size = 13, open = false }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    {open ? <path d="M7 11V7a5 5 0 0 1 9.9-1" /> : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
  </svg>
);

// Equity/bond split for the mixed "Funds" class, tiered off the sheet's risk rating.
// Confirmed against the fund names themselves (LifeStrategy 20% → Low, etc.).
const VOL_TIER = { 'low': [0.2, 0.8], 'below average': [0.4, 0.6], 'average': [0.6, 0.4], 'above average': [0.8, 0.2], 'high': [1.0, 0.0] };
// Returns [equityFraction, bondFraction]; the remainder (1-eq-bd) is treated as cash.
const classifyEB = (cls, vol, bucket) => {
  if (bucket === 'equity') return [1, 0];
  if (bucket === 'bond')   return [0, 1];
  if (bucket === 'cash')   return [0, 0];
  const c = (cls || '').toLowerCase(), v = (vol || '').toLowerCase();
  if (c.includes('money market')) return [0, 0];
  if (c.includes('bond'))         return [0, 1];
  if (c.includes('equit'))        return [1, 0];   // Equity Funds, Equities / ETFs
  if (c === 'funds')              return VOL_TIER[v] || [0.6, 0.4];
  return [1, 0];
};
const BUCKETS = [['auto', 'Auto'], ['equity', 'Eq'], ['bond', 'Bd'], ['cash', 'Csh']];

export default function PrivateBankRebalancerView({ presets = {}, pricesData = {}, liveRates = {}, charges = null, currency = 'USD' }) {
  const schedule = charges || PB_CHARGES;
  const banks = Object.keys(schedule);

  const [bank, setBank]     = useState(banks[0] || 'Schroders');
  const [base, setBase]     = useState(currency);
  const [cashFlow, setCash] = useState('');
  const [rounding, setRounding] = useState('margin');   // 'margin' (±5) | 'exact'
  const [addOpen, setAddOpen]   = useState(false);
  const [search, setSearch]     = useState('');

  // Equity/bond ratio optimiser controls.
  const [ratioOn, setRatioOn]   = useState(false);
  const [eqTarget, setEqTarget] = useState(60);   // % equity; bond = 100 - eqTarget
  const [drift, setDrift]       = useState(0);     // allowed +/- drift from model weight (% of portfolio)

  const [items, setItems] = useState([]);   // mix of {kind:'asset'} and {kind:'model', children:[…]}
  const [loans, setLoans] = useState([]);

  const bankClasses = useMemo(() => Object.keys(schedule[bank]?.classes || {}), [schedule, bank]);
  const defFee = (cls) => mapBankClass(cls, bankClasses);

  const lookupMeta = (k) => {
    const key = (k || '').trim().toUpperCase();
    if (!key) return null;
    return pricesData[key] || Object.values(pricesData).find((a) => a.isin === key) || null;
  };

  // Reverse-lookup a ticker from the price pool by ISIN (for CSV/receipt output).
  const tickerForIsin = (isin) => {
    const key = (isin || '').trim().toUpperCase();
    if (!key || key === 'CASH' || key === 'N/A') return '';
    const hit = Object.entries(pricesData).find(([, a]) => (a.isin || '').toUpperCase() === key);
    return hit ? hit[0] : '';
  };

  // Negatives guard: prices are never negative; units never negative except a Cash
  // line (which may legitimately hold a negative balance).
  const isCashNode = (n) => isCash(n.isin) || String(n.name || '').trim().toLowerCase() === 'cash';
  const clampUnits = (v, node) => (isCashNode(node) ? v : (parseFloat(v) < 0 ? '0' : v));
  const clampPrice = (v) => (parseFloat(v) < 0 ? '0' : v);

  // Re-default fee categories when the bank changes.
  useEffect(() => {
    setItems((prev) => prev.map((it) => it.kind === 'asset'
      ? { ...it, feeClass: defFee(it.cls) }
      : { ...it, children: it.children.map((ch) => ({ ...ch, feeClass: defFee(ch.cls) })) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, bankClasses]);

  const fmtBase = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: base, maximumFractionDigits: 0 }).format(v || 0);
  const fmtN = (v, d = 2) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));

  // ── Add menu data ─────────────────────────────────────────────────────────
  const allModels = useMemo(() => {
    const out = [];
    Object.entries(presets).forEach(([strat, byCur]) =>
      Object.entries(byCur).forEach(([cur, byProf]) =>
        Object.entries(byProf).forEach(([prof, holds]) =>
          out.push({ key: `${strat}|${cur}|${prof}`, strategy: strat, currency: cur, profile: prof, label: `${strat} · ${prof}`, sub: `${cur} · ${holds.length} assets`, holdings: holds }))));
    return out;
  }, [presets]);

  const q = search.trim().toLowerCase();
  const modelHits = q ? allModels.filter((m) => `${m.label} ${m.currency}`.toLowerCase().includes(q)) : allModels;
  const assetHits = useMemo(() => {
    const rows = Object.entries(pricesData).map(([t, a]) => ({ ticker: t, ...a }));
    return q ? rows.filter((r) => `${r.name} ${r.ticker} ${r.isin}`.toLowerCase().includes(q)) : rows;
  }, [pricesData, q]);

  // ── Add handlers ────────────────────────────────────────────────────────────
  const usedTarget = () => items.reduce((s, it) => s + (parseFloat(it.target) || 0), 0);
  const addBlank = () => { setItems((p) => [...p, { id: uid(), kind: 'asset', name: 'New holding', isin: '', ccy: base, price: '', units: '', target: '', cls: 'Equity', feeClass: defFee('Equity'), vol: '', bucket: 'auto', locked: false }]); setAddOpen(false); };
  const addAsset = (a, ticker) => {
    setItems((p) => [...p, { id: uid(), kind: 'asset', name: a.name, isin: a.isin, ccy: a.currency || base, price: a.price, units: '', target: '', cls: a.assetClass || 'Equity', feeClass: defFee(a.assetClass || 'Equity'), vol: a.volatility || '', bucket: 'auto', locked: false }]);
    setAddOpen(false); setSearch('');
  };
  const addModel = (m) => {
    const children = m.holdings.map((h) => {
      const cash = isCash(h.ticker) || isCash(h.isin);
      const meta = cash ? null : lookupMeta(h.ticker || h.isin);
      const cls = cash ? 'Cash' : (meta?.assetClass || 'Equity');
      return { id: uid(), name: h.name, isin: h.isin || (cash ? 'Cash' : ''), ccy: m.currency, price: cash ? 1 : (meta?.price ?? ''), units: '', weight: h.target, cls, feeClass: defFee(cls), vol: cash ? '' : (meta?.volatility || ''), bucket: 'auto', locked: false };
    });
    setItems((p) => [...p, { id: uid(), kind: 'model', name: m.profile, label: m.label, target: Math.max(0, 100 - usedTarget()), expanded: true, children }]);
    setAddOpen(false); setSearch('');
  };

  // ── Mutators ──────────────────────────────────────────────────────────────
  const updItem  = (id, f, v) => setItems((p) => p.map((it) => it.id === id ? { ...it, [f]: v } : it));
  const updChild = (mid, cid, f, v) => setItems((p) => p.map((it) => it.id === mid ? { ...it, children: it.children.map((ch) => ch.id === cid ? { ...ch, [f]: v } : ch) } : it));
  const delItem  = (id) => setItems((p) => p.filter((it) => it.id !== id));
  const delChild = (mid, cid) => setItems((p) => p.map((it) => it.id === mid ? { ...it, children: it.children.filter((ch) => ch.id !== cid) } : it));
  const toggle   = (id) => setItems((p) => p.map((it) => it.id === id ? { ...it, expanded: !it.expanded } : it));

  const addLoan = () => setLoans((p) => [...p, { id: uid(), name: 'Lombard loan', amount: 0, ccy: base, rate: 3, drawable: true }]);
  const updLoan = (id, f, v) => setLoans((p) => p.map((l) => l.id === id ? { ...l, [f]: v } : l));
  const delLoan = (id) => setLoans((p) => p.filter((l) => l.id !== id));

  // ── Flatten to leaves + totals ───────────────────────────────────────────────
  const rate = (ccy) => resolveRate(ccy, base, liveRates);
  const baseVal = (n) => (parseFloat(n.price) || 0) * (parseFloat(n.units) || 0) * rate(n.ccy);

  const leaves = useMemo(() => {
    const out = [];
    const enrich = (node, meta) => {
      const [eqf, bdf] = classifyEB(node.cls, node.vol, node.bucket);
      return { ...meta, node, eqf, bdf, locked: !!node.locked };
    };
    items.forEach((it) => {
      if (it.kind === 'asset') out.push(enrich(it, { ref: { id: it.id }, effTarget: parseFloat(it.target) || 0, modelName: null }));
      else (it.children || []).forEach((ch) => out.push(enrich(ch, { ref: { mid: it.id, id: ch.id }, effTarget: (parseFloat(it.target) || 0) * (parseFloat(ch.weight) || 0) / 100, modelName: it.name })));
    });
    return out;
  }, [items]);

  const totals = useMemo(() => {
    const assetBase = leaves.reduce((s, l) => s + baseVal(l.node), 0);
    const loanBase  = loans.reduce((s, l) => s + (parseFloat(l.amount) || 0) * rate(l.ccy), 0);
    const drawable  = loans.reduce((s, l) => s + (l.drawable ? (parseFloat(l.amount) || 0) * rate(l.ccy) : 0), 0);
    const investable = assetBase + (parseFloat(cashFlow) || 0) + drawable;
    return { assetBase, loanBase, drawable, netWorth: assetBase - loanBase, investable };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, loans, cashFlow, base, liveRates]);

  const totalTarget = items.reduce((s, it) => s + (parseFloat(it.target) || 0), 0);
  const pct = (b) => (totals.assetBase > 0 ? (b / totals.assetBase) * 100 : 0);

  // model aggregates
  const modelStat = (it) => {
    const b = (it.children || []).reduce((s, ch) => s + baseVal(ch), 0);
    return { base: b, pct: pct(b) };
  };

  // ── Equity / bond exposure + ratio optimiser ────────────────────────────────
  const P = totals.investable;

  // Current equity/bond split of the invested portfolio (fractional; mixed funds
  // contribute per their risk-tiered split).
  const exposure = useMemo(() => {
    let eq = 0, bd = 0;
    leaves.forEach((l) => { const b = baseVal(l.node); eq += b * l.eqf; bd += b * l.bdf; });
    const inv = totals.assetBase;
    return { eq, bd, eqPct: inv > 0 ? eq / inv * 100 : 0, bdPct: inv > 0 ? bd / inv * 100 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, base, liveRates, totals.assetBase]);

  // Solve to the target equity/bond ratio with the fewest / cheapest trades:
  //   • cash (non-locked) is deployed first;
  //   • locked lines and mixed funds are held fixed (their exposure counts);
  //   • pure equity/bond lines are traded, most under/over-weight first, allowed
  //     to drift up to `drift`% of the portfolio past their model weight.
  // Returns per-leaf target %, plus the projected resulting split — verified in Python.
  const opt = useMemo(() => {
    if (!ratioOn || P <= 0) return null;
    const driftAbs = (parseFloat(drift) || 0) / 100 * P;
    const eqP = Math.min(100, Math.max(0, parseFloat(eqTarget) || 0));
    const targetEq = eqP / 100 * P, targetBd = (100 - eqP) / 100 * P;

    const cur = {}; leaves.forEach((l) => { cur[l.ref.id] = baseVal(l.node); });
    const newVal = {}; leaves.forEach((l) => { newVal[l.ref.id] = cur[l.ref.id]; });

    let fixedEq = 0, fixedBd = 0;
    leaves.forEach((l) => {
      const held = l.locked || (l.eqf > 0 && l.eqf < 1) || (l.bdf > 0 && l.bdf < 1);
      if (held) { fixedEq += cur[l.ref.id] * l.eqf; fixedBd += cur[l.ref.id] * l.bdf; }
      else if (l.eqf === 0 && l.bdf === 0) newVal[l.ref.id] = 0;   // deploy free cash
    });
    const eqT = leaves.filter((l) => !l.locked && l.eqf === 1);
    const bdT = leaves.filter((l) => !l.locked && l.bdf === 1);

    const alloc = (cands, targetSleeve) => {
      const curSleeve = cands.reduce((s, l) => s + cur[l.ref.id], 0);
      const need = targetSleeve - curSleeve;
      const mv = {}; cands.forEach((l) => { mv[l.ref.id] = (l.effTarget / 100) * P; });
      if (need >= 0) {   // net buy → fill most-underweight first
        const order = [...cands].sort((a, b) => (mv[b.ref.id] - cur[b.ref.id]) - (mv[a.ref.id] - cur[a.ref.id]));
        let rem = need;
        order.forEach((l) => { const cap = Math.max(0, mv[l.ref.id] + driftAbs - cur[l.ref.id]); const buy = Math.min(cap, rem); newVal[l.ref.id] = cur[l.ref.id] + buy; rem -= buy; });
        if (rem > 1e-6 && order.length) newVal[order[0].ref.id] += rem;
      } else {           // net sell → trim most-overweight first
        const order = [...cands].sort((a, b) => (cur[b.ref.id] - mv[b.ref.id]) - (cur[a.ref.id] - mv[a.ref.id]));
        let rem = -need;
        order.forEach((l) => { const cap = Math.min(cur[l.ref.id], Math.max(0, cur[l.ref.id] - (mv[l.ref.id] - driftAbs))); const sell = Math.min(cap, rem); newVal[l.ref.id] = cur[l.ref.id] - sell; rem -= sell; });
        if (rem > 1e-6 && order.length) newVal[order[0].ref.id] -= Math.min(rem, newVal[order[0].ref.id]);
      }
    };
    alloc(eqT, targetEq - fixedEq);
    alloc(bdT, targetBd - fixedBd);

    const targets = {}; let projEq = 0, projBd = 0, invested = 0;
    leaves.forEach((l) => { targets[l.ref.id] = P > 0 ? newVal[l.ref.id] / P * 100 : 0; projEq += newVal[l.ref.id] * l.eqf; projBd += newVal[l.ref.id] * l.bdf; invested += newVal[l.ref.id]; });
    return { targets, projEqPct: P > 0 ? projEq / P * 100 : 0, projBdPct: P > 0 ? projBd / P * 100 : 0, cashLeftPct: P > 0 ? (P - invested) / P * 100 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratioOn, eqTarget, drift, leaves, P, base, liveRates]);

  // ── Directives (with margin rounding) ────────────────────────────────────────
  // Price-banded rounding step so high-priced funds round finely: over £100/unit
  // → 1 unit, £50–100 → 2 units, under £50 → 5 units. Buys round DOWN, sells UP.
  const marginIncrement = (price) => {
    const p = parseFloat(price) || 0;
    if (p > 100) return 1;
    if (p >= 50) return 2;
    return 5;
  };
  const roundUnits = (raw, price) => {
    if (rounding === 'exact' || !isFinite(raw)) return raw;
    const inc = marginIncrement(price);
    return raw >= 0 ? Math.floor(raw / inc) * inc : -Math.ceil(Math.abs(raw) / inc) * inc;
  };

  const directives = useMemo(() => {
    return leaves.map((l) => {
      const n = l.node;
      // Only the synthetic Cash line (ISIN "Cash") is charge-free — real money-
      // market FUNDS are securities the bank still charges on.
      const cash = isCash(n.isin) || String(n.name || '').trim().toLowerCase() === 'cash';
      const curBase  = baseVal(n);
      // In ratio mode the optimiser supplies each line's target; otherwise use the model target.
      const effTgt = (opt && opt.targets[l.ref.id] != null) ? opt.targets[l.ref.id] : l.effTarget;
      const idealBase = totals.investable * (effTgt / 100);
      const deltaBase = idealBase - curBase;
      const price = parseFloat(n.price) || 0;
      const rawUnits = price > 0 ? (deltaBase * resolveRate(base, n.ccy, liveRates)) / price : 0;
      const units = roundUnits(rawUnits, price);
      const tradedNat = units * price;
      const tradedBase = Math.abs(tradedNat) * rate(n.ccy);
      // Cash is not a security — no transaction charge.
      const f = cash ? { fee: 0, rate: 0, appliedMin: false } : computeTransactionFee(Math.abs(tradedNat), n.ccy, n.feeClass, bank, liveRates, schedule);
      const feeBase = f.fee * rate(n.ccy);
      // Locked lines never trade.
      const skip = l.locked || Math.abs(rawUnits) < 0.5 || Math.abs(units) < 1;
      return { id: n.id, name: n.name, isin: n.isin || '', ticker: tickerForIsin(n.isin), modelName: l.modelName, ccy: n.ccy, units, tradedNat, tradedBase, feeBase, rate: f.rate, appliedMin: f.appliedMin, cash, isBuy: units > 0, skip };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, totals.investable, base, liveRates, bank, schedule, rounding, opt]);

  const totalFees = directives.reduce((s, d) => s + (d.skip ? 0 : d.feeBase), 0);

  // ── Trade receipt (print + CSV) ──────────────────────────────────────────────
  const activeDirectives = directives.filter((d) => !d.skip);
  const buysBase  = activeDirectives.filter((d) => d.isBuy).reduce((s, d) => s + d.tradedBase, 0);
  const sellsBase = activeDirectives.filter((d) => !d.isBuy).reduce((s, d) => s + d.tradedBase, 0);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const printReceipt = () => {
    const when = new Date().toLocaleString('en-GB');
    const rows = activeDirectives.map((d) => {
      const after = d.isBuy ? d.tradedBase + d.feeBase : d.tradedBase - d.feeBase;
      return `<tr>
        <td>${esc(d.name)}${d.modelName ? `<div class="sub">${esc(d.modelName)}</div>` : ''}</td>
        <td class="${d.isBuy ? 'buy' : 'sell'}">${d.isBuy ? 'BUY' : 'SELL'}</td>
        <td class="r">${d.isBuy ? '+' : ''}${d.units}</td>
        <td class="r">${d.ccy} ${fmtN(Math.abs(d.tradedNat), 0)}</td>
        <td class="r">${fmtBase(d.tradedBase)}</td>
        <td class="r">${d.feeBase > 0 ? (d.isBuy ? '+' : '-') : ''}${fmtBase(d.feeBase)}</td>
        <td class="r b">${fmtBase(after)}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rebalance Instructions</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px}
      h1{font-size:18px;margin:0 0 2px} .meta{color:#666;font-size:11px;margin-bottom:16px}
      .sum{display:flex;gap:26px;margin:12px 0 18px} .sum div{font-size:11px;color:#666} .sum b{display:block;color:#111;font-size:14px}
      table{width:100%;border-collapse:collapse} th,td{padding:7px 8px;border-bottom:1px solid #e5e5e5;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;color:#888;letter-spacing:.05em}
      td.r,th.r{text-align:right;font-variant-numeric:tabular-nums} td.b{font-weight:bold}
      .buy{color:#059669;font-weight:bold} .sell{color:#dc2626;font-weight:bold} .sub{color:#999;font-size:10px}
      tfoot td{font-weight:bold;border-top:2px solid #111} .note{color:#999;font-size:10px;margin-top:16px}
      @media print{body{margin:12px}}</style></head><body>
      <h1>Private Bank Rebalance — Trade Instructions</h1>
      <div class="meta">${esc(bank)} &middot; Base ${base} &middot; ${when}</div>
      <div class="sum">
        <div>Portfolio value<b>${fmtBase(totals.assetBase)}</b></div>
        <div>Investable<b>${fmtBase(totals.investable)}</b></div>
        <div>Total buys<b>${fmtBase(buysBase)}</b></div>
        <div>Total sells<b>${fmtBase(sellsBase)}</b></div>
        <div>Total charges<b>${fmtBase(totalFees)}</b></div>
      </div>
      <table><thead><tr><th>Holding</th><th>Action</th><th class="r">Units</th><th class="r">Trade</th><th class="r">Before</th><th class="r">Charge</th><th class="r">After</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No trades required.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5">Total charges (${base})</td><td class="r"></td><td class="r">${fmtBase(totalFees)}</td></tr></tfoot></table>
      <div class="note">Estimated instructions and charges for guidance only — charges use the ${esc(bank)} schedule at live FX. Verify before dealing.</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const exportCSV = () => {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    // Fund Name, ISIN, Ticker, BUY/SELL, Units, then native trade + base Before/Charge/After.
    const head = ['Fund Name', 'ISIN', 'Ticker', 'BUY/SELL', 'Units', 'Model', 'Currency',
      'Trade (native)', `Price Before Charges (${base})`, `Charges (${base})`, `Amount After (${base})`];
    const lines = activeDirectives.map((d) => {
      const after = d.isBuy ? d.tradedBase + d.feeBase : d.tradedBase - d.feeBase;
      return [q(d.name), d.isin || (d.cash ? 'Cash' : 'MANUAL'), d.ticker, d.isBuy ? 'BUY' : 'SELL',
        d.units, q(d.modelName || ''), d.ccy, Math.abs(d.tradedNat).toFixed(2),
        d.tradedBase.toFixed(2), d.feeBase.toFixed(2), after.toFixed(2)].join(',');
    });
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent([head.join(','), ...lines].join('\n'));
    link.download = `pb_rebalance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const skewBadge = (skew) => (
    <span className={`font-mono text-xs font-bold ${Math.abs(skew) < 0.5 ? 'text-gray-300' : skew > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
      {skew >= 0 ? '+' : ''}{skew.toFixed(1)}
    </span>
  );
  const ccySelect = (val, onChange) => (
    <select value={val} onChange={onChange} className="bg-gray-50 border border-gray-200 rounded-md px-1 py-1 text-xs font-bold outline-none">
      {CCYS.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  const feeSelect = (val, onChange) => (
    <select value={val} onChange={onChange} className="bg-gray-50 border border-gray-200 rounded-md px-1 py-1 text-[11px] font-semibold text-gray-700 outline-none max-w-[140px]">
      {bankClasses.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  // Lock toggle + (in ratio mode) equity/bond bucket override + delete.
  const rowActions = (node, onBucket, onLock, onDel) => (
    <div className="flex items-center justify-end gap-1">
      {ratioOn && (
        <select value={node.bucket || 'auto'} onChange={onBucket} title="Equity / Bond bucket used by the ratio solver (Auto = derived from class & risk)" className="bg-gray-50 border border-gray-200 rounded px-0.5 py-0.5 text-[10px] font-bold text-gray-600 outline-none">
          {BUCKETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      <button onClick={onLock} title={node.locked ? "Locked — won't be traded" : 'Lock from trading'} className={`p-1 rounded ${node.locked ? 'text-brand bg-brand6' : 'text-gray-300 hover:text-gray-500'}`}><Lock size={13} open={!node.locked} /></button>
      <button onClick={onDel} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Page heading */}
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">Private Bank Rebalancer</h2>
        <p className="text-sm text-gray-500">Multi-currency · live FX · {bank} charges</p>
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-4 bg-white/75 backdrop-blur-sm p-5 rounded-2xl border border-gray-200 mb-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bank</label>
            <select value={bank} onChange={(e) => setBank(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none">{banks.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Base</label>
            <select value={base} onChange={(e) => setBase(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none">{CCYS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cash flow ({base})</label>
            <input type="number" value={cashFlow} onChange={(e) => setCash(e.target.value)} placeholder="0" className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-brand" /></div>
          <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Units</label>
            <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-0.5">
              {[['margin', 'Margin'], ['exact', 'Exact']].map(([k, l]) => (
                <button key={k} onClick={() => setRounding(k)} title={k === 'margin' ? 'Round trades to a sensible whole-unit margin (buys down, sells up) — step scales with unit price' : 'Exact fractional units'} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${rounding === k ? 'bg-white/75 backdrop-blur-sm text-brand shadow-sm' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div></div>
          <div className="relative">
            <button onClick={() => setAddOpen((o) => !o)} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand2"><Plus size={15} /> Add</button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setAddOpen(false); setSearch(''); }} />
                <div className="absolute right-0 mt-2 w-80 bg-white/75 backdrop-blur-sm rounded-xl border border-gray-200 shadow-xl p-2 z-20">
                  <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models or assets…" className="w-full px-2.5 py-1.5 mb-1 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand" />
                  <button onClick={addBlank} className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">+ Blank holding</button>
                  <div className="max-h-72 overflow-y-auto mt-1">
                    {modelHits.length > 0 && <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase">Models (adds all holdings)</div>}
                    {modelHits.slice(0, 40).map((m) => (
                      <button key={m.key} onClick={() => addModel(m)} className="w-full text-left px-2.5 py-1.5 hover:bg-brand6/40 rounded-lg flex flex-col">
                        <span className="text-xs font-bold text-gray-700">{m.label}</span>
                        <span className="text-[10px] text-gray-400">{m.sub}</span>
                      </button>
                    ))}
                    <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase">Individual assets</div>
                    {assetHits.slice(0, 60).map((a) => (
                      <button key={a.ticker} onClick={() => addAsset(a, a.ticker)} className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 rounded-lg flex justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-gray-700">{a.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono shrink-0">{a.currency}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Holdings & models table */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-brand shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-64">Holding / Model</th>
                <th className="py-3 px-2">Ccy</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Units</th>
                <th className="py-3 px-3 text-right">Base ({base})</th>
                <th className="py-3 px-3 text-right">Curr %</th>
                <th className="py-3 px-3 text-center">Target %</th>
                <th className="py-3 px-2 text-right">Skew</th>
                <th className="py-3 px-3">Fee cat.</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-gray-400 italic">Add a model or individual asset to begin.</td></tr>
              )}
              {items.flatMap((it) => {
                if (it.kind === 'asset') {
                  const b = baseVal(it); const cp = pct(b); const tgt = parseFloat(it.target) || 0;
                  return [(
                    <tr key={it.id} className="hover:bg-gray-50/40">
                      <td className="py-2 px-4"><input value={it.name} onChange={(e) => updItem(it.id, 'name', e.target.value)} className="w-full font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-brand" /></td>
                      <td className="py-2 px-2">{ccySelect(it.ccy, (e) => updItem(it.id, 'ccy', e.target.value))}</td>
                      <td className="py-2 px-3 text-right"><input type="number" value={it.price} onChange={(e) => updItem(it.id, 'price', clampPrice(e.target.value))} className="w-20 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono" /></td>
                      <td className="py-2 px-3 text-right"><input type="number" value={it.units} onChange={(e) => updItem(it.id, 'units', clampUnits(e.target.value, it))} className="w-24 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono" /></td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900 font-mono">{fmtBase(b)}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-600">{cp.toFixed(1)}%</td>
                      <td className="py-2 px-3 text-center"><input type="number" step="0.01" value={it.target} onChange={(e) => updItem(it.id, 'target', e.target.value)} className="w-16 text-center bg-gray-50 border border-gray-100 rounded-md px-1 py-1 outline-none font-bold text-xs" /></td>
                      <td className="py-2 px-2 text-right">{skewBadge(cp - tgt)}</td>
                      <td className="py-2 px-3">{feeSelect(it.feeClass, (e) => updItem(it.id, 'feeClass', e.target.value))}</td>
                      <td className="py-2 px-2">{rowActions(it, (e) => updItem(it.id, 'bucket', e.target.value), () => updItem(it.id, 'locked', !it.locked), () => delItem(it.id))}</td>
                    </tr>
                  )];
                }
                // model wrapper
                const ms = modelStat(it); const tgt = parseFloat(it.target) || 0;
                const wsum = (it.children || []).reduce((s, ch) => s + (parseFloat(ch.weight) || 0), 0);
                const wOk = Math.abs(wsum - 100) < 0.1;
                const header = (
                  <tr key={it.id} className="bg-brand6/20 border-y border-brand6/40">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggle(it.id)} className="flex items-center gap-1.5 font-bold text-brand2">
                          <ChevronRight size={15} className={it.expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
                          {it.name} <span className="text-[10px] font-semibold text-gray-400">({it.label} · {it.children.length})</span>
                        </button>
                        <span title="Sum of this model's constituent weights — should total 100%" className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-0.5 ${wOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {wsum.toFixed(1)}% {wOk ? <Check size={9} /> : <X size={9} />}
                        </span>
                      </div>
                    </td>
                    <td colSpan={3} className="py-2 px-3 text-[10px] text-gray-400 uppercase font-bold">Model wrapper</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900 font-mono">{fmtBase(ms.base)}</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-700 font-bold">{ms.pct.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-center"><input type="number" step="0.01" value={it.target} onChange={(e) => updItem(it.id, 'target', e.target.value)} className="w-16 text-center bg-white border border-brand3/40 rounded-md px-1 py-1 outline-none font-bold text-xs text-brand" /></td>
                    <td className="py-2 px-2 text-right">{skewBadge(ms.pct - tgt)}</td>
                    <td></td>
                    <td className="py-2 px-2 text-right"><button onClick={() => delItem(it.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button></td>
                  </tr>
                );
                const kids = it.expanded ? it.children.map((ch) => {
                  const b = baseVal(ch); const cp = pct(b);
                  const eff = tgt * (parseFloat(ch.weight) || 0) / 100;
                  return (
                    <tr key={ch.id} className="hover:bg-gray-50/40">
                      <td className="py-1.5 px-4 pl-9"><input value={ch.name} onChange={(e) => updChild(it.id, ch.id, 'name', e.target.value)} className="w-full text-xs text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-brand" /></td>
                      <td className="py-1.5 px-2">{ccySelect(ch.ccy, (e) => updChild(it.id, ch.id, 'ccy', e.target.value))}</td>
                      <td className="py-1.5 px-3 text-right"><input type="number" value={ch.price} onChange={(e) => updChild(it.id, ch.id, 'price', clampPrice(e.target.value))} className="w-20 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono text-xs" /></td>
                      <td className="py-1.5 px-3 text-right"><input type="number" value={ch.units} onChange={(e) => updChild(it.id, ch.id, 'units', clampUnits(e.target.value, ch))} className="w-24 text-right bg-transparent outline-none border-b border-transparent focus:border-brand font-mono text-xs" /></td>
                      <td className="py-1.5 px-3 text-right font-mono text-gray-700 text-xs">{fmtBase(b)}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-gray-500 text-xs">{cp.toFixed(1)}%</td>
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" value={ch.weight} onChange={(e) => updChild(it.id, ch.id, 'weight', e.target.value)} className="w-12 text-center bg-gray-50 border border-gray-100 rounded px-0.5 py-0.5 outline-none text-[11px] font-mono" title="Weight within model" />
                          <span className="text-[9px] text-gray-300">→{eff.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right">{skewBadge(cp - eff)}</td>
                      <td className="py-1.5 px-3">{feeSelect(ch.feeClass, (e) => updChild(it.id, ch.id, 'feeClass', e.target.value))}</td>
                      <td className="py-1.5 px-2">{rowActions(ch, (e) => updChild(it.id, ch.id, 'bucket', e.target.value), () => updChild(it.id, ch.id, 'locked', !ch.locked), () => delChild(it.id, ch.id))}</td>
                    </tr>
                  );
                }) : [];
                return [header, ...kids];
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">Portfolio: <b className="text-gray-900">{fmtBase(totals.assetBase)}</b></span>
          <span className="text-gray-500">Net worth: <b className="text-gray-900">{fmtBase(totals.netWorth)}</b></span>
          <span className="text-gray-500">Investable: <b className="text-brand">{fmtBase(totals.investable)}</b></span>
          <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold flex items-center gap-1 ${Math.abs(totalTarget - 100) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            Target {totalTarget.toFixed(1)}% {Math.abs(totalTarget - 100) < 0.01 ? <Check size={11} /> : <X size={11} />}
          </span>
        </div>
      </div>

      {/* Equity / Bond ratio optimiser */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-800 cursor-pointer">
            <input type="checkbox" checked={ratioOn} onChange={(e) => setRatioOn(e.target.checked)} className="w-4 h-4 accent-brand" />
            Equity / Bond ratio rebalance
            <span className="text-[10px] font-semibold text-gray-400">least-charge · cash first · respects locks</span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Equity %</label>
              <input type="number" step="0.01" value={eqTarget} onChange={(e) => setEqTarget(e.target.value)} disabled={!ratioOn} className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-brand disabled:opacity-40" /></div>
            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bond %</label>
              <div className="w-20 px-2 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-600">{(100 - (parseFloat(eqTarget) || 0)).toFixed(2)}</div></div>
            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1" title="How far a holding may drift from its model weight to save trades">Drift %</label>
              <input type="number" step="0.5" value={drift} onChange={(e) => setDrift(e.target.value)} disabled={!ratioOn} className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-brand disabled:opacity-40" /></div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs border-t border-gray-100 pt-3">
          <span className="text-gray-500">Current split: <b className="text-gray-800">{exposure.eqPct.toFixed(1)}% eq / {exposure.bdPct.toFixed(1)}% bd</b></span>
          {ratioOn && opt && (
            <>
              <ChevronRight size={12} className="text-gray-300" />
              <span className="text-gray-500">Target: <b className="text-brand">{(parseFloat(eqTarget) || 0).toFixed(1)}% / {(100 - (parseFloat(eqTarget) || 0)).toFixed(1)}%</b></span>
              <span className="text-gray-500">Projected: <b className="text-emerald-600">{opt.projEqPct.toFixed(1)}% eq / {opt.projBdPct.toFixed(1)}% bd</b></span>
              {opt.cashLeftPct > 0.05 && <span className="text-amber-600 font-semibold">Uninvested cash: {opt.cashLeftPct.toFixed(1)}%</span>}
              <span className="text-gray-500">Est. charges: <b className="text-brand3">{fmtBase(totalFees)}</b></span>
            </>
          )}
          {ratioOn && !opt && <span className="text-gray-400 italic">Add holdings to solve.</span>}
        </div>
        {ratioOn && <p className="mt-2 text-[10px] text-gray-400">Mixed “Funds” are split by risk rating (Low 20/80 → High 100/0); use the Eq/Bd/Csh selector on a row to override. Locked lines are held fixed; free cash is deployed first. Resulting trades show in the directives panel below.</p>}
      </div>

      {/* Loans */}
      <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Loans / Lombard facilities</h3>
          <button onClick={addLoan} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add loan</button>
        </div>
        {loans.length === 0 ? <p className="text-xs text-gray-400 italic">No loans. Add a Lombard facility to borrow against the portfolio.</p> : (
          <div className="space-y-2">
            {loans.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <input value={l.name} onChange={(e) => updLoan(l.id, 'name', e.target.value)} className="flex-1 min-w-[120px] font-semibold text-gray-800 bg-transparent outline-none text-sm" />
                <div className="relative w-32"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{sym(l.ccy)}</span>
                  <input type="number" value={l.amount} onChange={(e) => updLoan(l.id, 'amount', parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none" /></div>
                {ccySelect(l.ccy, (e) => updLoan(l.id, 'ccy', e.target.value))}
                <div className="relative w-20"><input type="number" value={l.rate} onChange={(e) => updLoan(l.id, 'rate', parseFloat(e.target.value) || 0)} className="w-full pl-2 pr-5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span></div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600"><input type="checkbox" checked={l.drawable} onChange={(e) => updLoan(l.id, 'drawable', e.target.checked)} /> Drawable</label>
                <button onClick={() => delLoan(l.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <p className="text-[10px] text-gray-400">Drawable loans add to investable capital; all loans reduce net worth. Total loans: {fmtBase(totals.loanBase)}.</p>
          </div>
        )}
      </div>

      {/* Directives */}
      {(totalTarget > 0 || ratioOn) && (
        <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2"><TrendingUp size={18} className="text-brand" /><h3 className="font-bold text-gray-900">Rebalance trades & charges</h3>
              {ratioOn && opt && <span className="px-2 py-0.5 rounded bg-brand6 text-brand text-[10px] font-extrabold">{(parseFloat(eqTarget) || 0).toFixed(0)}/{(100 - (parseFloat(eqTarget) || 0)).toFixed(0)} ratio</span>}
              <span className="text-[10px] text-gray-400 font-semibold">{rounding === 'margin' ? 'buys round down · sells round up' : 'exact units'}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={printReceipt} disabled={activeDirectives.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 disabled:opacity-40"><Printer size={14} /> Print trades</button>
              <button onClick={exportCSV} disabled={activeDirectives.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 disabled:opacity-40"><Download size={14} /> CSV</button>
              <span className="text-sm font-bold text-gray-500 ml-1">Total cost: <span className="text-brand3">{fmtBase(totalFees)}</span></span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {directives.filter((d) => !d.skip).map((d) => (
              <div key={d.id} className={`p-4 rounded-xl border ${d.isBuy ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/20 border-rose-100'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-gray-800 truncate">{d.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${d.isBuy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{d.isBuy ? 'BUY' : 'SELL'}</span>
                </div>
                {d.modelName && <p className="text-[10px] text-gray-400 mb-2">{d.modelName}</p>}
                <div className="space-y-1 text-xs border-t border-gray-100/60 pt-2">
                  <div className="flex justify-between"><span className="text-gray-400">Units:</span><span className="font-mono font-bold">{d.isBuy ? '+' : ''}{d.units}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Trade ({d.ccy}):</span><span className="font-mono text-gray-600">{sym(d.ccy)}{fmtN(Math.abs(d.tradedNat), 0)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">{d.isBuy ? 'Before charges' : 'Proceeds before'}:</span><span className="font-mono text-gray-700">{fmtBase(d.tradedBase)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 font-semibold">Charge {d.cash ? '(cash · none)' : d.appliedMin ? '(min)' : `(${(d.rate * 100).toFixed(3)}%)`}:</span><span className="font-mono font-bold text-brand3">{d.feeBase > 0 ? (d.isBuy ? '+' : '−') : ''}{fmtBase(d.feeBase)}</span></div>
                  <div className="flex justify-between border-t border-gray-100 pt-1 mt-1"><span className="text-gray-800 font-bold">{d.isBuy ? 'Cost after charges' : 'Net proceeds'}:</span><span className="font-mono font-bold text-gray-900">{fmtBase(d.isBuy ? d.tradedBase + d.feeBase : d.tradedBase - d.feeBase)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
