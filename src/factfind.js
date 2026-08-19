// ─────────────────────────────────────────────────────────────────────────────
// factfind.js — Fact Find data model + mappers into Cash Planner & IHT.
//
// The Fact Find form (FactFindView) edits a single plain object of this shape.
// "Export" downloads it as JSON; "Import" reads that JSON back; "Load into tools"
// runs the mappers below to seed Cash Planner and the IHT calculator. Keeping the
// mapping here (pure functions) means each view just calls one function + setters.
// ─────────────────────────────────────────────────────────────────────────────

export const FACT_FIND_VERSION = 1;

/** A blank fact find with sensible planning defaults. */
export const EMPTY_FACT_FIND = {
  meta:   { version: FACT_FIND_VERSION, savedAt: '' },
  client: { firstName: '', lastName: '', dob: '', maritalStatus: 'single' },
  planning: {
    currentAge: 45, retirementAge: 60, forecastEndAge: 90,
    statePensionAge: 67, statePensionAmount: 11000,
    inflation: 3, annualSpending: 45000, otherIncome: 0,
  },
  assets:   [],   // { name, category, value, growth, ihtStatus }
  gifts:    [],   // { desc, amount, exempt, yearsAgo }
  policies: [],   // { provider, type, sumAssured, term, inTrust }
  iht:      { married: false, claimRNRB: true, charity: 0, pensionInEstate: false },
};

/** IHT asset statuses (must match IHTCalculatorView). */
export const IHT_STATUSES = ['Subject', 'Exempt', 'Pension', 'Business Relief'];
/** Asset categories offered in the form (drive growth + IHT-status defaults). */
export const ASSET_CATEGORIES = ['Cash', 'Savings', 'ISA', 'SIPP / Pension', 'Property', 'Investment', 'Loan / Mortgage', 'Other'];

const num  = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const uid  = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2));
const isPension = (cat) => /pension|sipp/i.test(cat || '');

/** Merge an imported/partial object onto the empty template so missing keys are safe. */
export function normaliseFactFind(raw) {
  const r = raw || {};
  return {
    meta:     { ...EMPTY_FACT_FIND.meta, ...(r.meta || {}) },
    client:   { ...EMPTY_FACT_FIND.client, ...(r.client || {}) },
    planning: { ...EMPTY_FACT_FIND.planning, ...(r.planning || {}) },
    assets:   Array.isArray(r.assets)   ? r.assets   : [],
    gifts:    Array.isArray(r.gifts)    ? r.gifts    : [],
    policies: Array.isArray(r.policies) ? r.policies : [],
    iht:      { ...EMPTY_FACT_FIND.iht, ...(r.iht || {}) },
  };
}

/** Fact Find → Cash Planner state pieces. */
export function factToCashCal(ff) {
  const p = ff.planning || {};
  const assets = (ff.assets || []).map(a => ({
    id: uid(), name: a.name || 'Asset', value: num(a.value), growth: num(a.growth, 2),
  }));
  const events = [
    { id: uid(), type: 'retirement', age: num(p.retirementAge, 60), amount: 0 },
    { id: uid(), type: 'end',        age: num(p.forecastEndAge, 90), amount: 0 },
  ];
  if (num(p.statePensionAge) > 0)
    events.push({ id: uid(), type: 'statepension', age: num(p.statePensionAge, 67), amount: num(p.statePensionAmount) });

  // Cash Planner has a single cover slot — aggregate the policies into it.
  const pol      = ff.policies || [];
  const coverSum = pol.reduce((s, x) => s + num(x.sumAssured), 0);
  const first    = pol[0] || {};

  return {
    assets, events,
    currentAge:  num(p.currentAge, 45),
    inflation:   num(p.inflation, 3),
    spending:    num(p.annualSpending, 45000),
    otherIncome: num(p.otherIncome, 0),
    ihtJoint:    !!(ff.iht && ff.iht.married),
    coverSum,
    coverType:  first.type || 'Whole of Life',
    coverTerm:  num(first.term, 20),
    coverTrust: first.inTrust !== false,
  };
}

/** Fact Find → IHT calculator state pieces. */
export function factToIHT(ff) {
  const assets = (ff.assets || []).map(a => ({
    id: uid(), name: a.name || 'Asset',
    currentPrice: num(a.value), units: 1,
    ihtStatus: a.ihtStatus || (isPension(a.category) ? 'Pension' : 'Subject'),
    reliefRate: 0,
  }));
  const gifts = (ff.gifts || []).map(g => ({
    id: uid(), desc: g.desc || 'Gift', amount: num(g.amount), exempt: num(g.exempt), yearsAgo: num(g.yearsAgo),
  }));
  const policies = (ff.policies || []).map(x => ({
    id: uid(), provider: x.provider || 'Policy', sumAssured: num(x.sumAssured),
    type: x.type || 'Level Term', term: num(x.term, 20), inTrust: x.inTrust !== false,
  }));
  return {
    assets, gifts, policies,
    married:         !!(ff.iht && ff.iht.married),
    claimRNRB:       !(ff.iht && ff.iht.claimRNRB === false),
    charity:         num(ff.iht && ff.iht.charity),
    pensionInEstate: !!(ff.iht && ff.iht.pensionInEstate),
  };
}
