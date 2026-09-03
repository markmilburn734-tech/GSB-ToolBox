---
name: cgt-selldown-solver
description: The CGT tab is an optimiser (upload portfolio → cheapest disposals); design decisions, the two load-bearing tricks, and how it's proven
metadata:
  type: project
---

Built 2026-08-19. The CGT tab was a 5-row estimator; it is now a **sell-down solver**: upload a portfolio, name a target, get which holdings to sell and how much of each. Engine in `src/cgt/cgtEngine.js` (pure), import in `src/cgt/portfolioImport.js`, UI in `TaxCalculatorView.jsx`. Full detail in DEVELOPMENT.md §11.

**Owner's brief, verbatim on the strategy question:** *"iterate through different selling amounts of each holding and then basically find which creates the least tax bill, but also have a look at currency conversion cost + amount of trades needs to minimal."* So the objective is **tax + FX cost**, with trade count as a competing goal — not tax alone. Import format they specified: **name, Currency, Price, qty, avg price**. Cost basis in **GBP** (their choice — correct, since the FX move since purchase is part of a UK gain). All three target modes wanted (net cash / gross / fill the allowance).

**Two tricks that are load-bearing — don't "simplify" them away:**
1. `candidateRates()` enumerates every marginal tax rate at which two holdings swap places in the cost ordering, instead of guessing 18%/24%. Fixed orderings alone lost to brute force by up to £1,087.
2. `prunePlan()` drops disposals that earn their place in the ordering but not in the plan — once total gain is already inside the exempt amount, extra losses are worth nothing, so a small loss-maker with an FX charge gets bought in for free. Removing this pass makes the solver lose to brute force on 3 of 60 portfolios.

**Proof:** `python scripts/verify_cgt.py` — matches brute force exactly (worst gap £0.0000 over 60 random portfolios, all 720 permutations each). Also `scripts/make_sample_portfolio.py` builds `scripts/sample-portfolio.csv` from the real Holdings.xlsx roster + live prices for end-to-end testing. Observed on that sample (£942k portfolio, £60k income): £100k net → zero CGT via loss harvesting, 3 trades; £800k net → £817k gross, £16,497 CGT, 16 trades. Net always lands exactly on the ask.

**Still unverified:** the React UI has never been rendered (no Node here — see [[local-build-env]]). `xlsx` (SheetJS) is a new dependency, lazily imported. Also note `CGT` in `constants.js` still holds 2024/25 rates — flagged in-file for an April check.
