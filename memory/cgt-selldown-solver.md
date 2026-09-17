---
name: cgt-selldown-solver
description: CGT tab is an exact LP-backed sell-down optimiser with per-holding max-to-sell sliders; why the old ordering/prune solver was replaced and how it's proven
metadata:
  type: project
---

Built 2026-08-19, rebuilt 2026-09-17. Upload a portfolio, name a target, get which holdings to sell and how much of each. Engine `src/cgt/cgtEngine.js` (pure), import `src/cgt/portfolioImport.js`, UI `TaxCalculatorView.jsx`. Full detail in DEVELOPMENT.md §11.

**Owner's brief on strategy, verbatim:** *"iterate through different selling amounts of each holding and then basically find which creates the least tax bill, but also have a look at currency conversion cost + amount of trades needs to minimal."* Objective = tax + FX cost; trade count competes. Import format they chose: name, Currency, Price, qty, avg price (avg cost in **GBP**). Three modes: net cash / gross / fill the allowance.

**Per-holding sliders (2026-09-17, owner's request):** each row has a 0–100% "max to sell" slider replacing Hold/Sell buttons — a ceiling, not an instruction. 0% = hold. **Force-sell was dropped** (the owner asked for a max slider); if they want it back, the natural shape is a min handle on the same slider.

**Solver — exact, do not regress:** for a fixed target it's an LP with two real constraints, so the optimum is either a greedy fill at r = 0/18/24% (one partial) or a blend of two greedy fills landing exactly on a tax kink (two partials). `optimalFractions()` builds both. The earlier `candidateRates()` + `prunePlan()` design could only make one-partial plans; it was "verified" against a permutation brute force with the same blind spot, so both agreed and both were wrong — up to £434 worse than optimal on ~1 in 10 portfolios. Caught only when the sliders forced a real LP oracle. Lesson: [[local-build-env]] means Python ports are the only tests, so the ORACLE must be independent of the algorithm's assumptions.

**Proof:** `python scripts/verify_cgt.py` (needs `pip install scipy`) — every plan vs `scipy.optimize.linprog`, 1,290 portfolios up to the 184-holding roster, with random sliders: exact, worst gap £0.0000. Sample: `scripts/make_sample_portfolio.py`. On that sample (£942k, £60k income): £600k net now costs £338 vs £372 before (a kink blend); £800k net → £817,183 gross, £16,497 CGT; capping the 3 biggest-gain holdings at 30% raises the £800k bill by £683.

**Still unverified:** the React UI has never been rendered here — owner runs `npm run dev`.
