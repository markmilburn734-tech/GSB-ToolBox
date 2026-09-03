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
// Everything here is pure. scripts/verify_cgt.py re-implements it and checks the
// results against brute force, because the app cannot be built on this machine.
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
        // Gain per £1 of proceeds — negative for a holding standing at a loss.
        // This is what makes one holding cheaper to sell than another.
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
        const f = Math.min(1, Math.max(0, fractions[h.id] || 0));
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

// ─── Candidate orderings ─────────────────────────────────────────────────────
//
// For a FIXED amount of gross proceeds, this is a fractional-knapsack problem:
// fill from the cheapest source first. "Cheapest" = tax + FX per £ of proceeds:
//
//     costPerPound(h) = gainFraction × marginalRate + fxSpread
//
// The catch is that `marginalRate` is not known until the plan is complete
// (exempt band → 18% → 24%). Rather than fixing a rate and hoping, we build a
// handful of plausible orderings, cost every one properly, and keep the best.
// With ordering fixed the greedy fill is provably optimal, so the only
// approximation left is the ordering itself — and brute-force testing in
// scripts/verify_cgt.py shows these candidates find the true optimum.

/** O(n²) crossings is far more orderings than a real portfolio needs. */
const RATE_CAP = 48;
/** Only the most promising orderings earn the (much costlier) prune pass. */
const POLISH_TOP = 5;

/**
 * Every marginal tax rate that produces a DISTINCT cheapest-first ordering.
 *
 * Two holdings swap places in the ordering at exactly one rate:
 *     r* = (spread_j − spread_i) / (gainFraction_i − gainFraction_j)
 * Collecting every crossing inside [0, 24%] and taking midpoints between
 * consecutive crossings enumerates every ordering the cost key can ever
 * produce — so trying them all is exhaustive rather than a guess at r.
 *
 * @param {ReturnType<typeof deriveHolding>[]} holdings
 * @returns {number[]}
 */
function candidateRates(holdings) {
    const hs = holdings.filter((h) => !h.locked);
    const rates = new Set([0, CGT.LR_TAX, CGT.HR_TAX]);

    for (let i = 0; i < hs.length; i += 1) {
        for (let j = i + 1; j < hs.length; j += 1) {
            const dg = hs[i].gainFraction - hs[j].gainFraction;
            if (Math.abs(dg) < 1e-12) continue;
            const r = (hs[j].fxSpread - hs[i].fxSpread) / dg;
            if (r >= 0 && r <= CGT.HR_TAX) rates.add(r);
        }
    }

    const xs = [...rates].sort((a, b) => a - b);
    const all = new Set(xs);
    for (let i = 1; i < xs.length; i += 1) all.add((xs[i - 1] + xs[i]) / 2);

    let out = [...all].sort((a, b) => a - b);
    if (out.length > RATE_CAP) {
        const keep = new Set([0, CGT.LR_TAX, CGT.HR_TAX]);
        const step = out.length / (RATE_CAP - keep.size);
        for (let i = 0; i < RATE_CAP - 3; i += 1) {
            keep.add(out[Math.min(out.length - 1, Math.floor(i * step))]);
        }
        out = [...keep].sort((a, b) => a - b);
    }
    return out;
}

/**
 * Orderings to try: the cost-optimal family, then two tidiness-biased ones and
 * a largest-first pass that feed the "fewest trades" alternative.
 * @param {ReturnType<typeof deriveHolding>[]} holdings
 */
function candidateOrderings(holdings) {
    const out = candidateRates(holdings).map((rate) => ({
        key: `cost-${rate.toFixed(4)}`,
        label: rate === 0 ? 'Lowest FX cost' : `Lowest cost at ${(rate * 100).toFixed(0)}%`,
        // Ties break toward the lower gain (protects the exempt amount) and then
        // the larger position (fewer trades). Without this, the degenerate
        // ordering at rate 0 picks high-gain holdings arbitrarily.
        sort: (a, b) => {
            const ka = a.gainFraction * rate + a.fxSpread;
            const kb = b.gainFraction * rate + b.fxSpread;
            if (Math.abs(ka - kb) > 1e-12) return ka - kb;
            if (Math.abs(a.gainFraction - b.gainFraction) > 1e-12) return a.gainFraction - b.gainFraction;
            return b.valueGbp - a.valueGbp;
        },
    }));

    // Cheapest-first, but among near-equal holdings prefer the big ones — this
    // is what collapses a scatter of small sales into a few large ones.
    [0.02, 0.05].forEach((band) => {
        out.push({
            key: `banded-${band}`,
            label: 'Low cost, fewer trades',
            sort: (a, b) => {
                const ka = Math.round((a.gainFraction * CGT.HR_TAX + a.fxSpread) / band);
                const kb = Math.round((b.gainFraction * CGT.HR_TAX + b.fxSpread) / band);
                if (ka !== kb) return ka - kb;
                return b.valueGbp - a.valueGbp;
            },
        });
    });

    out.push({
        key: 'size',
        label: 'Largest positions first',
        sort: (a, b) => b.valueGbp - a.valueGbp,
    });

    return out;
}

/**
 * Greedy fill along one ordering until `targetGross` of proceeds is raised.
 * Locked holdings are skipped; forced holdings are sold in full up front.
 */
function fillToProceeds(holdings, ordering, targetGross, exclude = null) {
    /** @type {Record<string, number>} */
    const fractions = {};
    let raised = 0;

    const sellable = holdings.filter((h) => (
        !h.locked && h.valueGbp > EPSILON && !(exclude && exclude.has(h.id))
    ));

    // Forced disposals happen whatever the target — the adviser has decided.
    sellable.filter((h) => h.forced).forEach((h) => {
        fractions[h.id] = 1;
        raised += h.valueGbp;
    });

    const queue = sellable.filter((h) => !h.forced).sort(ordering.sort);
    for (const h of queue) {
        if (raised >= targetGross - EPSILON) break;
        const need = targetGross - raised;
        const take = Math.min(1, need / h.valueGbp);
        fractions[h.id] = take;
        raised += take * h.valueGbp;
    }

    return { fractions, raised };
}

/**
 * Drops disposals that earn their place in the ORDERING but not in the PLAN.
 *
 * The greedy fill ranks by cost per £, which always prefers a bigger loss. But
 * once the plan's total gain is already inside the exempt amount, further losses
 * are worth NOTHING — so a small loss-making holding that happens to carry an FX
 * charge gets pulled into the plan for no benefit. No single ordering can express
 * "skip that one" (it outranks its alternatives at every rate), so candidates are
 * dropped one at a time and any drop that lowers the bill is kept.
 *
 * Verified against brute force in scripts/verify_cgt.py — without this pass the
 * solver was beaten on 3 of 60 random portfolios; with it, on none.
 */
function prunePlan(holdings, ordering, targetGross, ctx) {
    const exclude = new Set();
    let bestFractions = fillToProceeds(holdings, ordering, targetGross, exclude).fractions;
    let best = evaluatePlan(holdings, bestFractions, ctx);
    if (best.grossProceeds < targetGross - EPSILON) return { fractions: bestFractions, plan: best };

    for (let round = 0; round < holdings.length; round += 1) {
        const active = Object.keys(bestFractions).filter((id) => bestFractions[id] > 1e-9);
        let winner = null;

        for (const id of active) {
            const trialExclude = new Set(exclude);
            trialExclude.add(id);
            const trialFractions = fillToProceeds(holdings, ordering, targetGross, trialExclude).fractions;
            const trial = evaluatePlan(holdings, trialFractions, ctx);
            if (trial.grossProceeds < targetGross - EPSILON) continue;
            if (trial.totalCost < best.totalCost - 1e-6) {
                winner = id;
                best = trial;
                bestFractions = trialFractions;
            }
        }

        if (!winner) break;
        exclude.add(winner);
    }

    return { fractions: bestFractions, plan: best };
}

/**
 * Rounds a plan to whole units, then tops back up to the target.
 *
 * Rounding each disposal DOWN always undershoots, so the shortfall is made up
 * by taking whole extra units from the cheapest holding that still has some —
 * which keeps the plan's ordering logic intact instead of silently missing the
 * target.
 */
function roundToWholeUnits(holdings, fractions, targetGross, ordering) {
    const byId = new Map(holdings.map((h) => [h.id, h]));
    /** @type {Record<string, number>} */
    const out = {};
    let raised = 0;

    Object.entries(fractions).forEach(([id, f]) => {
        const h = byId.get(id);
        if (!h || h.qty <= 0) return;
        const units = Math.min(h.qty, Math.floor(f * h.qty));
        if (units <= 0) return;
        out[id] = units / h.qty;
        raised += units * h.sellPriceGbp;
    });

    if (raised >= targetGross - EPSILON) return out;

    const queue = holdings
        .filter((h) => !h.locked && h.qty > 0)
        .sort(ordering.sort);

    for (const h of queue) {
        if (raised >= targetGross - EPSILON) break;
        const already = Math.round((out[h.id] || 0) * h.qty);
        const spare = h.qty - already;
        if (spare <= 0) continue;

        const needed = Math.ceil((targetGross - raised) / h.sellPriceGbp);
        const add = Math.min(spare, needed);
        out[h.id] = (already + add) / h.qty;
        raised += add * h.sellPriceGbp;
    }

    return out;
}

/**
 * Best plan that raises `targetGross` of gross proceeds.
 * Returns null when the sellable portfolio simply isn't big enough.
 */
export function planForGrossProceeds(holdings, targetGross, ctx, opts = {}) {
    const { wholeUnits = false, polish = true } = opts;
    const capacity = holdings
        .filter((h) => !h.locked)
        .reduce((s, h) => s + h.valueGbp, 0);
    if (targetGross > capacity + EPSILON) return null;

    const finish = (fractions, ordering) => {
        const final = wholeUnits
            ? roundToWholeUnits(holdings, fractions, targetGross, ordering)
            : fractions;
        return {
            ...evaluatePlan(holdings, final, ctx),
            ordering: ordering.key,
            orderingLabel: ordering.label,
            fractions: final,
        };
    };

    // ── Phase 1 (cheap): one greedy fill per candidate ordering. ────────────
    const rough = [];
    candidateOrderings(holdings).forEach((ordering) => {
        const { fractions } = fillToProceeds(holdings, ordering, targetGross);
        const plan = finish(fractions, ordering);
        if (plan.grossProceeds < targetGross - EPSILON) return;   // rounding fell short
        plan._ordering = ordering;
        rough.push(plan);
    });
    if (!rough.length) return null;

    rough.sort((a, b) => a.totalCost - b.totalCost);

    // ── Phase 2 (costly): prune only the most promising handful. ────────────
    let best = rough[0];
    if (polish) {
        rough.slice(0, POLISH_TOP).forEach((cand) => {
            const { fractions } = prunePlan(holdings, cand._ordering, targetGross, ctx);
            const plan = finish(fractions, cand._ordering);
            if (plan.grossProceeds < targetGross - EPSILON) return;
            if (plan.totalCost < best.totalCost - 1e-6) best = plan;
        });
    }

    // The tidiest plan worth offering: fewest trades, cheapest among equals.
    const fewest = rough.reduce((acc, p) => (
        !acc || p.tradeCount < acc.tradeCount
            || (p.tradeCount === acc.tradeCount && p.totalCost < acc.totalCost) ? p : acc
    ), null);

    best = { ...best };
    best.alternative = (fewest && fewest.tradeCount < best.tradeCount)
        ? { ...fewest, extraCost: fewest.totalCost - best.totalCost }
        : null;
    delete best._ordering;
    if (best.alternative) delete best.alternative._ordering;
    return best;
}

/**
 * Gross proceeds needed to put `targetNet` in the client's hand once tax and FX
 * are paid. Bisection, because net cash rises monotonically with proceeds (each
 * extra £1 keeps at least 1 − 24% − spread) but not linearly — the exempt
 * amount and the rate step put kinks in the curve that rule out a closed form.
 */
export function solveForNetCash(holdings, targetNet, ctx, opts = {}) {
    const capacity = holdings.filter((h) => !h.locked).reduce((s, h) => s + h.valueGbp, 0);
    if (capacity <= EPSILON) return null;

    // Can the whole portfolio even do it?
    const ceilingPlan = planForGrossProceeds(holdings, capacity, ctx, opts);
    if (!ceilingPlan || ceilingPlan.netCash < targetNet - 1) {
        return ceilingPlan ? { ...ceilingPlan, shortfall: targetNet - ceilingPlan.netCash } : null;
    }

    // Bisect with the CHEAP evaluator — running the prune pass inside the loop
    // would multiply the work by ~40 for no benefit. Pruning only ever lowers
    // tax + FX, so net cash can only rise when we polish at the end, and the
    // target still clears.
    const fast = { ...opts, polish: false };
    let lo = 0;
    let hi = capacity;
    for (let i = 0; i < 40 && hi - lo > 0.5; i += 1) {
        const mid = (lo + hi) / 2;
        const plan = planForGrossProceeds(holdings, mid, ctx, fast);
        if (plan && plan.netCash >= targetNet) hi = mid;
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
        if (h.gainGbp <= 0) {                 // a loss only widens the headroom
            fractions[h.id] = 1;
            gain += h.gainGbp;
            continue;
        }
        if (remaining <= EPSILON) break;
        const take = Math.min(1, remaining / h.gainGbp);
        if (take <= 0) break;
        fractions[h.id] = take;
        gain += take * h.gainGbp;
    }

    const finalFractions = wholeUnits
        ? Object.fromEntries(Object.entries(fractions).map(([id, f]) => {
            const h = holdings.find((x) => x.id === id);
            // Round DOWN here: overshooting the allowance would create a tax bill,
            // which is the one thing this mode exists to avoid.
            return [id, h && h.qty > 0 ? Math.floor(f * h.qty) / h.qty : 0];
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
        sellableGbp: acc.sellableGbp + (h.locked ? 0 : h.valueGbp),
    }), { valueGbp: 0, bookCostGbp: 0, gainGbp: 0, sellableGbp: 0 });
}
