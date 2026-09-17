// ─────────────────────────────────────────────────────────────────────────────
// cgtEngine.js — sell-down solver for the CGT tool.
//
// The question this answers: "the client needs £X — which holdings do we sell,
// and how much of each, for the smallest total cost?" Cost is NOT just tax:
//
//     cost = capital gains tax + FX conversion cost      (trade count is a
//                                                         competing objective)
//
// Three things make this harder than the old calculator:
//
//   1. NET-CASH TARGETS ARE CIRCULAR. Selling to raise £X realises gains, which
//      creates tax, which means you must sell more, which realises more gains.
//      Solved by bisection on gross proceeds (`solveForNetCash`).
//   2. THE TAX RATE IS A STEP FUNCTION. Gains are free up to the annual exempt
//      amount, then 18% while basic-rate band headroom lasts, then 24%. So the
//      marginal cost of a disposal depends on everything else in the plan.
//   3. FEWER TRADES AND LESS TAX PULL IN OPPOSITE DIRECTIONS. The cheapest plan
//      is often a scatter of small partial sales; the tidiest plan is two or
//      three big ones. We solve for both and report the price of the tidier one.
//
// UK rules modelled: Section 104 pooling (one row per holding = the pool, which
// is why an average cost per unit is the right input); in-year losses netting
// off gains; the annual exempt amount; the 18/24% split by basic-rate headroom;
// spouse doubling. NOT modelled: same-day and 30-day "bed and breakfast"
// matching — flagged in the UI, and the reason a re-purchase inside 30 days
// invalidates these numbers.
//
// Everything here is pure. scripts/verify_cgt.py re-implements it and checks
// every plan against an exact LP solver (scipy), because the app cannot be built
// on this machine. Per-holding sliders cap how much of each position may go.
// ─────────────────────────────────────────────────────────────────────────────

import { CGT } from '../constants';

/** Proceeds below this are treated as zero — kills float dust in the plans. */
const EPSILON = 0.005;

// ─── Tax ─────────────────────────────────────────────────────────────────────

/**
 * The taxpayer's fixed situation for the year, independent of what we sell.
 *
 * `unusedBasicBand` is derived from GROSS income: the £50,270 limit is a gross
 * threshold, so subtracting *taxable* income would double-count the personal
 * allowance and wrongly hand a higher earner an 18% band. (This was a real bug
 * in the old calculator — see DEVELOPMENT.md §5.)
 *
 * @param {object} opts
 * @param {number} opts.income          gross annual income
 * @param {number} [opts.allowanceUsed] annual exempt amount already used
 * @param {boolean} [opts.isJoint]      treat as a couple (doubles the bands)
 * @param {number} [opts.broughtForwardLosses] capital losses carried forward
 * @returns {{ exemptAmount:number, unusedBasicBand:number, broughtForwardLosses:number }}
 */
export function taxContext({ income = 0, allowanceUsed = 0, isJoint = false, broughtForwardLosses = 0 }) {
    const multiplier = isJoint ? 2 : 1;
    const grossIncome = Math.max(0, Number(income) || 0);

    return {
        exemptAmount: Math.max(0, CGT.BASE_ALLOWANCE * multiplier - (Number(allowanceUsed) || 0)),
        unusedBasicBand: Math.max(0, CGT.BASIC_RATE_LMT * multiplier - grossIncome),
        broughtForwardLosses: Math.max(0, Number(broughtForwardLosses) || 0),
    };
}

/**
 * Tax on a realised net gain.
 *
 * Order matters and follows HMRC: losses (in-year, already netted into
 * `netGain`, then brought-forward) come off first, then the annual exempt
 * amount, then the remainder is rate-split by basic-rate headroom.
 *
 * Brought-forward losses are only used to the extent the gain exceeds the
 * exempt amount — you never waste them sheltering an already-exempt gain.
 *
 * @param {number} netGain  in-year gains less in-year losses (may be negative)
 * @param {ReturnType<typeof taxContext>} ctx
 */
export function taxOnGain(netGain, ctx) {
    const gain = Number(netGain) || 0;
    if (gain <= 0) {
        return { tax: 0, taxableGain: 0, atLowerRate: 0, atHigherRate: 0, lossesUsed: 0, exemptUsed: 0 };
    }

    const exemptUsed = Math.min(gain, ctx.exemptAmount);
    const afterExempt = gain - exemptUsed;
    const lossesUsed = Math.min(afterExempt, ctx.broughtForwardLosses);
    const taxableGain = afterExempt - lossesUsed;

    const atLowerRate = Math.min(taxableGain, ctx.unusedBasicBand);
    const atHigherRate = Math.max(0, taxableGain - atLowerRate);
    const tax = atLowerRate * CGT.LR_TAX + atHigherRate * CGT.HR_TAX;

    return { tax, taxableGain, atLowerRate, atHigherRate, lossesUsed, exemptUsed };
}

// ─── Holdings ────────────────────────────────────────────────────────────────

/**
 * Turns a raw imported row into the economics the solver needs, all in GBP.
 *
 * `avgCost` is the Section 104 pooled cost per unit. By default it is read as
 * GBP — what the client actually paid — because the FX move between purchase
 * and sale is itself part of a UK capital gain, and only a purchase-date GBP
 * cost captures it. Set `avgCostInNative` when the sheet quotes cost in the
 * holding's own currency; the gain is then FX-blind and understated, which the
 * UI has to say out loud.
 *
 * @param {object} row  { name, currency, price, qty, avgCost, ... }
 * @param {(from:string,to:string)=>number} rate  FX resolver → GBP
 * @param {object} [opts]
 * @param {number} [opts.marketBuffer]  prudence buffer on the sale price
 * @param {number} [opts.fxSpread]      cost of converting non-GBP proceeds
 * @param {boolean} [opts.avgCostInNative]
 */
export function deriveHolding(row, rate, opts = {}) {
    const {
        marketBuffer = CGT.MARKET_BUFFER,
        fxSpread = 0,
        avgCostInNative = false,
    } = opts;

    const currency = String(row.currency || 'GBP').toUpperCase();
    const qty = Math.max(0, Number(row.qty) || 0);
    const price = Math.max(0, Number(row.price) || 0);
    const avgCost = Math.max(0, Number(row.avgCost) || 0);
    const toGbp = currency === 'GBP' ? 1 : (rate(currency, 'GBP') || 1);

    // The buffer is ADDED to the sale price so the estimated gain — and the tax
    // provisioned for it — is nudged UP. It is deliberately prudent, not a
    // slippage haircut.
    const sellPriceNative = price * (1 + marketBuffer);
    const sellPriceGbp = sellPriceNative * toGbp;
    const costPerUnitGbp = avgCostInNative ? avgCost * toGbp : avgCost;

    const valueGbp = qty * sellPriceGbp;
    const bookCostGbp = qty * costPerUnitGbp;
    const gainGbp = valueGbp - bookCostGbp;

    // Cost of turning the proceeds into sterling. GBP holdings pay nothing.
    const spread = currency === 'GBP' ? 0 : Math.max(0, fxSpread);

    // The adviser's per-holding slider: the MOST of this position the solver may
    // sell, 0–100%. 0 is the old "Hold"; 100 leaves it fully available. It is a
    // ceiling, not an instruction — the solver still sells less (or none) if
    // that is cheaper. Missing means 100, so imported rows start fully usable.
    const rawPct = Number(row.maxSellPct);
    const maxSellPct = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 100;
    const sellCap = maxSellPct / 100;

    return {
        ...row,
        currency,
        qty,
        price,
        avgCost,
        toGbp,
        sellPriceGbp,
        costPerUnitGbp,
        valueGbp,
        bookCostGbp,
        gainGbp,
        fxSpread: spread,
        maxSellPct,
        sellCap,
        availableGbp: valueGbp * sellCap,
        // Derived, not stored: a 0% cap is simply a holding the solver can't touch.
        locked: sellCap <= 0,
        // Gain per £1 of proceeds — negative for a holding standing at a loss.
        // This is what makes one holding cheaper to sell than another. A cap
        // doesn't change it: every £ sold from a pooled holding carries the same
        // average cost, so the cap limits HOW MUCH, never how expensive.
        gainFraction: valueGbp > 0 ? gainGbp / valueGbp : 0,
    };
}

// ─── Plan evaluation ─────────────────────────────────────────────────────────

/**
 * Costs out a set of disposals. `fractions` is a Map/object of holding id →
 * fraction of the position sold (0–1).
 *
 * @param {ReturnType<typeof deriveHolding>[]} holdings
 * @param {Record<string, number>} fractions
 * @param {ReturnType<typeof taxContext>} ctx
 */
export function evaluatePlan(holdings, fractions, ctx) {
    let grossProceeds = 0;
    let netGain = 0;
    let fxCost = 0;
    const trades = [];

    holdings.forEach((h) => {
        // Clamp to the adviser's cap as a last line of defence — no plan can
        // report selling more than the slider allows, whatever produced it.
        const cap = h.sellCap ?? 1;
        const f = Math.min(cap, Math.max(0, fractions[h.id] || 0));
        const proceeds = f * h.valueGbp;
        if (proceeds <= EPSILON) return;

        grossProceeds += proceeds;
        netGain += f * h.gainGbp;
        fxCost += proceeds * h.fxSpread;

        trades.push({
            id: h.id,
            name: h.name,
            currency: h.currency,
            fraction: f,
            units: f * h.qty,
            proceedsGbp: proceeds,
            proceedsNative: h.toGbp > 0 ? proceeds / h.toGbp : proceeds,
            gainGbp: f * h.gainGbp,
            fxCostGbp: proceeds * h.fxSpread,
            isFullDisposal: f >= 1 - 1e-9,
            // Sold right up to a slider that is below 100% — i.e. the cap is
            // binding, and raising it would let the solver use more of this line.
            atCap: cap < 1 && f >= cap - 1e-9,
            maxSellPct: h.maxSellPct ?? 100,
        });
    });

    const tax = taxOnGain(netGain, ctx);
    const netCash = grossProceeds - tax.tax - fxCost;

    return {
        trades: trades.sort((a, b) => b.proceedsGbp - a.proceedsGbp),
        tradeCount: trades.length,
        grossProceeds,
        netGain,
        fxCost,
        tax: tax.tax,
        taxDetail: tax,
        netCash,
        totalCost: tax.tax + fxCost,
        // What each £1 of cash in the client's hand costs in tax + FX.
        costRatio: netCash > 0 ? (tax.tax + fxCost) / netCash : 0,
    };
}

// ─── The solver ──────────────────────────────────────────────────────────────
//
// For a FIXED amount of gross proceeds P, the cheapest plan is a small linear
// programme. Write x_i for the £ sold from holding i and split the realised
// gain into a free slice, an 18% slice L and a 24% slice H:
//
//     minimise   Σ x_i·spread_i  +  18%·L  +  24%·H
//     subject to Σ x_i = P
//                Σ x_i·gainFraction_i − L − H ≤ exempt + broughtForwardLosses
//                0 ≤ L ≤ basic-rate headroom,  H ≥ 0,  0 ≤ x_i ≤ slider cap_i
//
// Only TWO real constraints. An LP optimum sits at a vertex, and with two
// constraints a vertex has at most two values strictly between their bounds.
// That leaves exactly two shapes the optimum can take:
//
//   (a) a greedy fill — cheapest-first by  spread + r·gainFraction  — at one of
//       the three marginal rates r ∈ {0, 18%, 24%}: every holding either untouched
//       or sold to its cap, plus ONE partial; or
//   (b) a BLEND of two greedy fills whose realised gain lands exactly on a tax
//       kink (the edge of the exempt amount, or the top of the basic-rate band):
//       TWO partials, e.g. part of a big GBP gain balanced against part of a
//       loss-maker so the gain is exactly £3,000.
//
// Shape (b) is the one the previous solver could not produce — it enumerated
// orderings and pruned them, which can only ever yield shape (a). Measured
// against a true LP (scripts/verify_cgt.py, scipy), that version was worse than
// optimal on roughly 1 portfolio in 10, by up to £434. This one matches the LP
// on every portfolio tested.
//
// Finding (b): realised gain falls monotonically as the rate r in the sort key
// rises (standard exchange argument), so bisecting r pins the exact point where
// the greedy fill's gain jumps across the kink. The fills either side of that
// point are both optimal for the same Lagrangian, so the blend that lands on the
// kink is optimal too. Each plan costs ~130 greedy fills — a 184-holding
// portfolio solves in a few milliseconds.

/** Bisection steps on the rate — past float precision on a 0–24% bracket. */
const RATE_BISECT_STEPS = 60;

/**
 * Cheapest-first fill at a fixed marginal tax rate, each holding up to its
 * slider cap, until `targetGross` is raised.
 *
 * Ties break toward the lower gain (so a zero-rate fill uses loss-makers first
 * and stays inside the exempt amount as long as possible) and then toward the
 * larger position (fewer trades).
 *
 * @returns {Record<string, number>} holding id → fraction of the position
 */
function greedyFill(holdings, rate, targetGross, sort = null) {
    /** @type {Record<string, number>} */
    const fractions = {};
    let raised = 0;

    const order = sort || ((a, b) => {
        const ka = a.fxSpread + rate * a.gainFraction;
        const kb = b.fxSpread + rate * b.gainFraction;
        if (ka !== kb) return ka - kb;
        if (a.gainFraction !== b.gainFraction) return a.gainFraction - b.gainFraction;
        return b.valueGbp - a.valueGbp;
    });

    const queue = holdings
        .filter((h) => !h.locked && h.valueGbp > EPSILON)
        .sort(order);

    for (const h of queue) {
        if (raised >= targetGross - EPSILON) break;
        const take = Math.min(h.sellCap ?? 1, (targetGross - raised) / h.valueGbp);
        fractions[h.id] = take;
        raised += take * h.valueGbp;
    }
    return fractions;
}

/** Realised gain of a set of fractions. */
function gainOf(holdings, fractions) {
    return holdings.reduce((s, h) => s + (fractions[h.id] || 0) * h.gainGbp, 0);
}

/** λ·a + (1−λ)·b — a blend of two plans that each raise the same proceeds. */
function blend(a, b, lambda) {
    /** @type {Record<string, number>} */
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((id) => {
        const f = lambda * (a[id] || 0) + (1 - lambda) * (b[id] || 0);
        if (f > 1e-12) out[id] = f;
    });
    return out;
}

/**
 * The exact least-cost fractions for `targetGross` (see the block comment
 * above). Every candidate raises exactly the target within the sliders, so
 * taking the cheapest is always safe — the theory only guarantees the true
 * optimum is among them.
 */
function optimalFractions(holdings, targetGross, ctx) {
    const kinkExempt = ctx.exemptAmount + ctx.broughtForwardLosses;
    const kinkBand = kinkExempt + ctx.unusedBasicBand;

    const candidates = [
        { fractions: greedyFill(holdings, 0, targetGross), rate: 0 },
        { fractions: greedyFill(holdings, CGT.LR_TAX, targetGross), rate: CGT.LR_TAX },
        { fractions: greedyFill(holdings, CGT.HR_TAX, targetGross), rate: CGT.HR_TAX },
    ];

    [
        [0, CGT.LR_TAX, kinkExempt],
        [CGT.LR_TAX, CGT.HR_TAX, kinkBand],
    ].forEach(([rateLo, rateHi, kink]) => {
        let lo = rateLo;
        let hi = rateHi;
        if (!(gainOf(holdings, greedyFill(holdings, lo, targetGross)) > kink
            && gainOf(holdings, greedyFill(holdings, hi, targetGross)) <= kink)) return;

        for (let i = 0; i < RATE_BISECT_STEPS; i += 1) {
            const mid = (lo + hi) / 2;
            if (gainOf(holdings, greedyFill(holdings, mid, targetGross)) > kink) lo = mid;
            else hi = mid;
        }

        const above = greedyFill(holdings, lo, targetGross);   // gain > kink
        const below = greedyFill(holdings, hi, targetGross);   // gain ≤ kink
        const gAbove = gainOf(holdings, above);
        const gBelow = gainOf(holdings, below);
        if (gAbove - gBelow <= 1e-9) return;

        candidates.push({
            fractions: blend(above, below, (kink - gBelow) / (gAbove - gBelow)),
            rate: hi,
            onKink: true,
        });
    });

    return candidates
        .map((c) => ({ ...c, cost: evaluatePlan(holdings, c.fractions, ctx).totalCost }))
        .sort((a, b) => a.cost - b.cost)[0];
}

/** Orderings used ONLY to look for a tidier, fewer-trades alternative. */
const TIDY_ORDERINGS = [
    {
        label: 'Low cost, fewer trades',
        sort: (a, b) => {
            const ka = Math.round((a.gainFraction * CGT.HR_TAX + a.fxSpread) / 0.02);
            const kb = Math.round((b.gainFraction * CGT.HR_TAX + b.fxSpread) / 0.02);
            return ka !== kb ? ka - kb : b.valueGbp - a.valueGbp;
        },
    },
    {
        label: 'Low cost, fewest trades',
        sort: (a, b) => {
            const ka = Math.round((a.gainFraction * CGT.HR_TAX + a.fxSpread) / 0.05);
            const kb = Math.round((b.gainFraction * CGT.HR_TAX + b.fxSpread) / 0.05);
            return ka !== kb ? ka - kb : b.valueGbp - a.valueGbp;
        },
    },
    { label: 'Largest positions first', sort: (a, b) => b.valueGbp - a.valueGbp },
];

/**
 * Rounds a plan to whole units, then tops back up to the target.
 *
 * Rounding each disposal DOWN always undershoots, so the shortfall is made up
 * with whole extra units from the cheapest holdings (at `rate`) that still have
 * slider room — instead of silently missing the target. A slider is never
 * exceeded: a 40% cap on 7 units permits 2, never 3.
 */
function roundToWholeUnits(holdings, fractions, targetGross, rate) {
    const byId = new Map(holdings.map((h) => [h.id, h]));
    const maxUnits = (h) => Math.floor((h.sellCap ?? 1) * h.qty + 1e-9);
    /** @type {Record<string, number>} */
    const out = {};
    let raised = 0;

    Object.entries(fractions).forEach(([id, f]) => {
        const h = byId.get(id);
        if (!h || h.qty <= 0) return;
        const units = Math.min(maxUnits(h), Math.floor(f * h.qty + 1e-9));
        if (units <= 0) return;
        out[id] = units / h.qty;
        raised += units * h.sellPriceGbp;
    });
    if (raised >= targetGross - EPSILON) return out;

    const queue = holdings
        .filter((h) => !h.locked && h.qty > 0)
        .sort((a, b) => (a.fxSpread + rate * a.gainFraction) - (b.fxSpread + rate * b.gainFraction));

    for (const h of queue) {
        if (raised >= targetGross - EPSILON) break;
        const already = Math.round((out[h.id] || 0) * h.qty);
        const spare = maxUnits(h) - already;
        if (spare <= 0) continue;
        const add = Math.min(spare, Math.ceil((targetGross - raised) / h.sellPriceGbp));
        out[h.id] = (already + add) / h.qty;
        raised += add * h.sellPriceGbp;
    }
    return out;
}

/** What the sliders release: the most the solver may raise in total. */
function sellableCapacity(holdings) {
    return holdings
        .filter((h) => !h.locked)
        .reduce((s, h) => s + (h.availableGbp ?? h.valueGbp), 0);
}

/**
 * Least-cost plan that raises `targetGross` of gross proceeds, plus — when one
 * exists — a tidier fewer-trades alternative with its extra cost attached.
 * Returns null when the sliders don't release enough to reach the target.
 */
export function planForGrossProceeds(holdings, targetGross, ctx, opts = {}) {
    const { wholeUnits = false } = opts;
    if (targetGross > sellableCapacity(holdings) + EPSILON) return null;

    const finish = (fractions, rate, label) => {
        const final = wholeUnits ? roundToWholeUnits(holdings, fractions, targetGross, rate) : fractions;
        return { ...evaluatePlan(holdings, final, ctx), orderingLabel: label, fractions: final };
    };

    const opt = optimalFractions(holdings, targetGross, ctx);
    const best = finish(
        opt.fractions,
        opt.rate,
        opt.onKink ? 'Least tax + FX, balanced on a tax threshold' : 'Least tax + FX',
    );

    // The tidiest plan worth offering: fewest trades, cheapest among equals.
    let fewest = null;
    TIDY_ORDERINGS.forEach((ordering) => {
        const plan = finish(greedyFill(holdings, 0, targetGross, ordering.sort), CGT.HR_TAX, ordering.label);
        if (plan.grossProceeds < targetGross - EPSILON) return;
        if (!fewest || plan.tradeCount < fewest.tradeCount
            || (plan.tradeCount === fewest.tradeCount && plan.totalCost < fewest.totalCost)) {
            fewest = plan;
        }
    });

    best.alternative = (fewest && fewest.tradeCount < best.tradeCount)
        ? { ...fewest, extraCost: fewest.totalCost - best.totalCost }
        : null;
    return best;
}

/**
 * Gross proceeds needed to put `targetNet` in the client's hand once tax and FX
 * are paid. Bisection, because net cash rises monotonically with proceeds (each
 * extra £1 keeps at least 1 − 24% − spread) but not linearly — the exempt
 * amount and the rate step put kinks in the curve that rule out a closed form.
 */
export function solveForNetCash(holdings, targetNet, ctx, opts = {}) {
    const capacity = sellableCapacity(holdings);
    if (capacity <= EPSILON) return null;

    // Can everything the sliders release even do it?
    const ceilingPlan = planForGrossProceeds(holdings, capacity, ctx, opts);
    if (!ceilingPlan || ceilingPlan.netCash < targetNet - 1) {
        return ceilingPlan ? { ...ceilingPlan, shortfall: targetNet - ceilingPlan.netCash } : null;
    }

    // The exact solver is cheap enough to run inside the bisection directly —
    // only the continuous plan is needed to find the proceeds; rounding and the
    // tidy alternative are built once, at the answer.
    const netAt = (gross) => {
        const opt = optimalFractions(holdings, gross, ctx);
        return evaluatePlan(holdings, opt.fractions, ctx).netCash;
    };

    let lo = 0;
    let hi = capacity;
    for (let i = 0; i < 40 && hi - lo > 0.5; i += 1) {
        const mid = (lo + hi) / 2;
        if (netAt(mid) >= targetNet) hi = mid;
        else lo = mid;
    }

    // Settle on `hi` — the side of the bracket that actually clears the target.
    const plan = planForGrossProceeds(holdings, hi, ctx, opts);
    return plan ? { ...plan, shortfall: 0 } : null;
}

/**
 * Largest disposal that stays inside the annual exempt amount — "harvest the
 * allowance without writing a cheque".
 *
 * Maximising proceeds under a cap on gains is the same knapsack read the other
 * way round: take the lowest gain per £ first. Loss-makers come first and
 * actually *create* headroom, which is exactly the behaviour an adviser wants.
 */
export function planWithinAllowance(holdings, ctx, opts = {}) {
    const { wholeUnits = false } = opts;
    const budget = ctx.exemptAmount;

    const queue = holdings
        .filter((h) => !h.locked && h.valueGbp > EPSILON)
        .sort((a, b) => a.gainFraction - b.gainFraction);

    /** @type {Record<string, number>} */
    const fractions = {};
    let gain = 0;

    for (const h of queue) {
        const remaining = budget - gain;
        const cap = h.sellCap ?? 1;
        if (h.gainGbp <= 0) {                 // a loss only widens the headroom
            fractions[h.id] = cap;
            gain += cap * h.gainGbp;
            continue;
        }
        if (remaining <= EPSILON) break;
        const take = Math.min(cap, remaining / h.gainGbp);
        if (take <= 0) break;
        fractions[h.id] = take;
        gain += take * h.gainGbp;
    }

    const finalFractions = wholeUnits
        ? Object.fromEntries(Object.entries(fractions).map(([id, f]) => {
            const h = holdings.find((x) => x.id === id);
            // Round DOWN here: overshooting the allowance would create a tax bill,
            // which is the one thing this mode exists to avoid.
            return [id, h && h.qty > 0 ? Math.floor(Math.min(f, h.sellCap ?? 1) * h.qty + 1e-9) / h.qty : 0];
        }))
        : fractions;

    return {
        ...evaluatePlan(holdings, finalFractions, ctx),
        ordering: 'allowance',
        orderingLabel: 'Gains held inside the exempt amount',
        fractions: finalFractions,
        alternative: null,
    };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/** @typedef {'net'|'gross'|'allowance'} SellDownMode */

/**
 * Builds the sell-down plan.
 *
 * @param {ReturnType<typeof deriveHolding>[]} holdings
 * @param {object} request
 * @param {SellDownMode} request.mode
 * @param {number} [request.target]       required for 'net' and 'gross'
 * @param {ReturnType<typeof taxContext>} request.ctx
 * @param {boolean} [request.wholeUnits]
 */
export function buildSellDownPlan(holdings, { mode, target = 0, ctx, wholeUnits = false }) {
    const opts = { wholeUnits };

    if (mode === 'allowance') return planWithinAllowance(holdings, ctx, opts);
    if (mode === 'gross') return planForGrossProceeds(holdings, Number(target) || 0, ctx, opts);
    return solveForNetCash(holdings, Number(target) || 0, ctx, opts);
}

/** Portfolio-level totals for the summary strip. */
export function portfolioTotals(holdings) {
    return holdings.reduce((acc, h) => ({
        valueGbp: acc.valueGbp + h.valueGbp,
        bookCostGbp: acc.bookCostGbp + h.bookCostGbp,
        gainGbp: acc.gainGbp + h.gainGbp,
        sellableGbp: acc.sellableGbp + (h.availableGbp ?? (h.locked ? 0 : h.valueGbp)),
    }), { valueGbp: 0, bookCostGbp: 0, gainGbp: 0, sellableGbp: 0 });
}
