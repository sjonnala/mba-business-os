# mba-business-os

A personal MBA knowledge portal: a pan-and-zoom mind map of the UW Foster MBA (5 pillars, 22 courses, 90 deep concept cards), a spaced-repetition Case Gym with 50 three-minute drills, a live 3-statement linker, a DCF and WACC studio, a cap table lab, an operations bottleneck lab, an AI product unit economics lab, and a 5-minute daily routine. It runs entirely in the browser; progress is saved in localStorage and nothing is sent anywhere.

Waves: M1 ACCTG 500 (15 concepts) · M2 ACCTG 501 and Pillar 2 Finance, Valuation & VC (24) · M3 Pillar 3 Strategy, Economics, Operations & Analytics (18) · M4 Pillar 4 SWE → AI Founder & Strategic PM (16) · **M5 Pillar 5 Marketing, Leadership, Ethics & Board Governance (17) plus the Case Gym**, for 90 live concepts across all 22 courses.

## Quickstart (3 commands)

Needs Node 20 or later (CI uses Node 22) and git.

```bash
git clone -b feat/wave-m5-pillar5-case-gym-and-pages https://github.com/sjonnala/mba-business-os.git && cd mba-business-os
npm install
npm run dev
```

Open the local address Vite prints (usually http://localhost:5173). Once PRs #1–#5 are merged, drop `-b feat/wave-m5-pillar5-case-gym-and-pages` and clone `main`.

### Branches and merge order

The five waves are stacked draft PRs, each based on the one before it, so the Wave M5 branch already contains every wave. To preview everything, check out that one branch (the quickstart does this). To land them on `main`, merge in order and retarget each next PR to `main` after its base merges (GitHub does this automatically when the merged branch is deleted):

1. PR #1 `feat/portal-scaffold-and-acctg500` → `main` (Wave M1)
2. PR #2 `feat/wave-m2-managerial-acctg-and-finance-vc` (Wave M2)
3. PR #3 `feat/wave-m3-strategy-econ-ops-qmeth` (Wave M3)
4. PR #4 `feat/wave-m4-entre-pm-and-mikesell-playbook` (Wave M4)
5. PR #5 `feat/wave-m5-pillar5-case-gym-and-pages` (Wave M5)

## Architecture

```
  JSON content (src/data/*.json)            pure engines (src/lib/*.ts)
  pillar-1a … pillar-5, case gym      threeStatement · valuation · capTable · opsBottleneck
            │                         unitEconomics · caseGym (SM-2) · mindMapLayout
            ▼                                     │
  schema/knowledgeGraph.ts                        │
  parseConcepts + checkGraphIntegrity             │
  (throws at load on any rule break)              │
            │                                     │
            ▼                                     ▼
  data/graph.ts · data/caseGym.ts  ───────►  React views (src/components)  ◄──►  lib/storage.ts
  90 concepts, 50 drills                     App.tsx tabs + concept drawer        localStorage, try/catch
```

- **Content is data.** Every concept and drill lives in JSON and is validated at load time and in tests, so a bad edit fails the build instead of shipping.
- **Engines are pure TypeScript** with no React, which keeps them unit-testable (154 Vitest tests).
- **State stays in the browser.** Mastery, routine logs, Case Gym schedules and theme use `localStorage` through `lib/storage.ts`, which keeps working in memory when storage is blocked.
- **Static build.** `vite build` with a relative base produces a `dist/` folder that runs from any static host, including GitHub Pages.

## Commands

```bash
npm run dev        # local dev server
npm run typecheck  # strict TypeScript, app and config
npm test           # Vitest (npx vitest run)
npm run build      # typecheck + production build into dist/
npm run check:any  # zero explicit any in src
npm run verify     # all four, the same checks CI runs
```

## CI and GitHub Pages

- `.github/workflows/ci.yml` runs on pushes and pull requests: `npm ci`, typecheck, Vitest, build and the zero-any guard.
- `.github/workflows/pages.yml` builds the app and deploys `dist/` to GitHub Pages. **Pages is not enabled on this repository.** To turn it on, the owner sets Settings > Pages > Source to GitHub Actions, then runs the workflow by hand or sets the repository variable `PAGES_ENABLED=true` so each push to `main` deploys. A Pages site is a public website even when the repository is private, so it would put every concept card, drill and source note in this repo on the open web at a findable address.

## The nine views

1. **Mind map**: root → 5 pillars → 22 courses → concepts of the live courses. Each course gets a sector sized by its concept count, so neighbouring fans never overlap. Drag to pan, scroll or +/− to zoom, toggle thread edges, search or filter by tag. Mastery (new, reviewed, mastered) is saved in this browser.
2. **Concept drawer**: Hook → 20/80 with formulas → Reality check → 8 lenses with filter chips → Threads to pull → Boardroom drill with a click-to-reveal CFO answer, plus Mark reviewed / Mark mastered.
3. **3-statement linker**: sliders for revenue growth, gross margin, OpEx, DSO, DIO, DPO, annual CapEx, useful life and deferred revenue growth drive a 3-year income statement, balance sheet and cash flow statement. Cash is derived from the cash flow statement (with a minimum-cash revolver), so the green `Assets === Liabilities + Equity` badge holds for every slider state. An FCF bridge shows net income to free cash flow.
4. **DCF & WACC studio (Lab #2)**: CAPM cost of equity with asset beta relevered to the target D/E, WACC, a 5-year FCFF forecast (EBIT × (1 − t) + D&A − CapEx − ΔNWC), Gordon terminal value, the bridge to equity value per share, a 5 × 5 WACC-versus-g heatmap, and DuPont ROIC (NOPAT margin × capital turnover) against WACC. A WACC > g guard rejects any terminal value where growth meets or exceeds the discount rate, in the headline and cell by cell.
5. **Cap table lab (Lab #3)**: founders and an existing pool, stacked post-money SAFEs (cap and discount), a Series A with the option pool shuffle inside the pre-money, the effective pre-money, and a 1x liquidation waterfall comparing non-participating and participating preferred at any exit. Ownership uses whole basis points (largest remainder), so it always totals exactly 100.00%.
6. **Ops bottleneck lab (Lab #4)**: a 2–6 stage pipeline with presets for a robot assembly line, the OPMGT 502 sandwich flow line, an LLM inference service and an ML labeling pipeline. Arrival rate and variability plus each stage's resources, service time and variability drive capacity (m ÷ p), the bottleneck, throughput = min(demand, capacity), utilization, cycle time, Sakasegawa queue waits, lead time and Little's Law WIP. A seeded discrete-event simulation plays the queue buildup over time, and a "double this stage" table proves non-bottleneck capacity adds zero throughput.
7. **Unit economics lab (Lab #5)**: per-account unit economics and customer payback for AI products, with presets for the Carbon Robotics LaserWeeder seed plan, PranaScan B2C, PranaScan B2B and an enterprise AI SaaS account. Up-front price and COGS, monthly price, platform fee, serving cost with an annual decline (the GPU inference cost curve), CAC, monthly churn, discount rate and horizon drive churn-weighted, discounted LTV, LTV/CAC, churn-adjusted and simple CAC payback, recurring and blended gross margin, customer payback and value capture. A cumulative cash curve marks the payback month, a ±20% tornado ranks which driver moves LTV/CAC most, and a solver finds the monthly price that reaches 3×.
8. **Case Gym**: 50 three-minute drills, 10 per pillar, from the M-402 drill bank. Filter by pillar, course and difficulty, start the 3-minute countdown, answer out loud, then reveal the CFO or founder answer and the anti-pattern trap (the timer reveals both when it runs out). Grade yourself Again, Good or Easy: SM-2-style scheduling (intervals 1, 6, then interval × ease; Again resets and lowers ease, Easy adds a bonus) decides when each drill comes back, saved in this browser. An Up next list orders due drills first, and every drill links straight to its concept card on the mind map.
9. **5-minute routine**: a timer and four prompts per concept, saved in this browser, with one-click Markdown export.

## Layout

```
src/
  schema/knowledgeGraph.ts   ConceptNode types, runtime validation, link integrity
  data/catalog.ts            5 pillars and 22 courses
  data/pillar-1a-acctg500-financial.json   15 ACCTG 500 concept nodes
  data/pillar-1b-acctg501-managerial.json  10 ACCTG 501 concept nodes
  data/pillar-2-fin502-entre557-entre542.json  14 FIN 502 / ENTRE 557 / ENTRE 542 nodes
  data/pillar-3-econ-mgmt502-ops-qmeth.json    18 B ECON / MGMT 502 / OPMGT 502 / QMETH / I S 500 nodes
  data/pillar-4-entre-pm-mikesell.json         16 ENTRE 510 / ENTRE 532 / ENTRE 579 / MKTG 554 nodes
  data/pillar-5-mktg-leadership-governance.json  17 MKTG 501 / MKTG 600 / MGMT 500 / MGMT 510 / B CMU 501 / MGMT 504 / MGMT 550 nodes
  data/case-gym-50-drills.json  50 Case Gym drills with reconciled concept links
  data/caseGym.ts            validated drills
  data/graph.ts              validated concepts (parse fails loudly on bad data)
  lib/threeStatement.ts      linker engine, slider specs, seeded RNG
  lib/valuation.ts           CAPM, beta relevering, WACC, FCFF, DCF, WACC > g guard, 5 × 5 grid, DuPont ROIC
  lib/capTable.ts            SAFE and note conversion, pool shuffle, basis-point ownership, liquidation waterfall
  lib/opsBottleneck.ts       capacity, bottleneck, queue waits, Little's Law, seeded discrete-event simulation, presets
  lib/unitEconomics.ts       per-account LTV, CAC payback, serving cost curve, customer payback, sensitivity, price solver, presets
  lib/caseGym.ts             drill parser, SM-2 scheduling, queue order, filters and stats
  lib/mindMapLayout.ts       radial layout and search filter
  lib/storage.ts             localStorage helpers (safe when storage is blocked)
  lib/routineMarkdown.ts     routine log → Markdown
  components/                MindMap, ConceptDrawer, CaseGym, LinkerSandbox, DcfStudio, CapTableLab, OpsBottleneckLab, UnitEconomicsLab, RoutineScratchpad
  test/                      schema, integrity, catalog, caseGym, engine, valuation, capTable, opsBottleneck, unitEconomics, unitEconomicsLab, storage, no-any
docs/case-gym-concept-mapping.md   M-402 slug → portal concept id for all 50 drills
scripts/check-no-any.mjs           zero-any guard used by CI
.github/workflows/                 ci.yml and pages.yml
```

## Content rules (enforced by tests)

- Every node has a 2-sentence hook, a 20/80 summary with at least one formula, a reality check, all 8 lenses (each 2–3 sentences, or `null` for "Low signal — skipped"), at least 2 threads, a boardroom drill and at least 3 tagged sources, one of them `[Foster: ...]`.
- No filler text (TBD, TODO, placeholder and similar).
- Every thread resolves to a concept or a course; no self or duplicate links.
- The linker balances to within 1e-6 across 100 seeded random slider states.
- Wave M2 nodes each link outside their own course; Pillar 2 links back to the ACCTG 500 statements and ACCTG 501 links forward to Pillar 2.
- Every Wave M3 node links to Pillar 1, Pillar 2 or a future course and outside its own course; all 18 link back into Pillars 1-2.
- Every Wave M4 node links back into Pillars 1-3 and to another Pillar 4 course; the earlier course-level threads to ENTRE 510, ENTRE 532 and MKTG 554 now point at specific Pillar 4 concepts.
- Every Wave M5 node links back into Pillars 1-4 and to another Pillar 5 course; the earlier course-level threads to MGMT 550, MKTG 501 and MGMT 504 now point at specific Pillar 5 concepts, and no node repeats a target.
- All 50 Case Gym drills resolve to a real concept on the same pillar (50/50), 10 per pillar; only `gym-p5-05` links across courses, by design. SM-2 intervals, ease floors, queue order and storage round-trips are tested.
- The unit economics lab matches closed-form LTV (with and without discounting), churn-adjusted payback and serving-cost decline, reproduces the Carbon Robotics seed-plan margin (≈ 70.8%) and 36-month customer payback, and keeps LTV/CAC monotonic in price, churn and CAC across 200 seeded random inputs.
- The ops lab reproduces the sandwich line (60 / 40 / 120 per hour, 67% / 100% / 33% utilization, 3-minute minimum lead time), matches M/M/1 waits, shows zero throughput gain from every non-bottleneck in every preset, and its simulation obeys Little's Law within 5%.
- The DCF reproduces hand-computed FCFF and Gordon values, rejects WACC ≤ g, and the 5 × 5 grid moves the right way in both directions.
- The cap table reproduces Foster examples (VCIC 36% / 14% / 50%, Cap Table Template 64% / 16% / 20%, note converting at $4.00 for 125,000 shares) and sums to exactly 10,000 basis points across 300 seeded random rounds; the waterfall always pays out exactly the exit proceeds.
- No explicit `any` anywhere in `src`.

## Data notes

- Drills marked *illustrative* use teaching numbers, not company disclosures.
- Cisco figures come from the Foster class excerpt of the fiscal 2020 annual report, which the course notes was modified for class purposes.
- Facts flagged "verify" (for example hyperscaler server useful-life changes) should be checked against current filings.
- Wave M2 class problems (Smith's Pub, SW Products, Noontime, Better Birding, Griffindor, HP Case 4.1, Hargrove, VCIC, Cap Table Template) come from allow-listed Foster course folders. Hargrove's equity beta is shown unrounded (≈ 37.87% cost of equity versus 37.85% with the beta rounded to 6.57).
- Benchmarks such as LTV/CAC above 3, the Rule of 40 and burn multiple thresholds are commonly cited heuristics and marked illustrative.
- Wave M3 draws on allow-listed Foster folders for B ECON 500/501, MGMT 502, OPMGT 502, The Goal study guide, QMETH 500/501 and I S 500. Licensed case readings are cited by title only. The source deck's sandwich-line utilization figures contain a typo, so the lab uses the corrected math.
- Wave M4 draws on allow-listed Foster folders for ENTRE 510, ENTRE 532, ENTRE 579 and MKTG 554, the I-Corps materials, The Lean Startup, The Almanack of Naval Ravikant, the Paul Mikesell talk deck and Satish's Mikesell case study v2. Slides from the deck's MISSION section onward are marked proprietary and are not used. Licensed cases are cited by title only, and no student, TA or teammate names appear.
- Lab #5's Carbon Robotics preset takes COGS (~$35k), price (~$120k with three years of service) and the ~3-year farm payback from the early seed-pitch slide; the churn, CAC, serving cost and 5-year life are illustrative. The PranaScan and enterprise AI presets are fully illustrative.
- Wave M5 draws on the allow-listed MKTG 501, MGMT 500 and MGMT 504 course folders, the MGMT 550 Executive Governance and Product Pricing Playbook (built from MGMT 550 and Corporate Governance Matters) and the M-402 drill bank. No MGMT 510 or B CMU 501 folder was found, and the MKTG 600 independent study folder was outside the allow-list, so those concepts cite the course by title and rest on public records and standard texts. Licensed cases and readings are cited by title only, and no student or TA names appear.
- Public-record cases in Pillar 5 (Netflix 2011, Microsoft and Mojang 2014, Johnson & Johnson Tylenol 1982, Wells Fargo 2016, Theranos, WeWork 2019, Disney 2022–2024) are marked "verify before reuse".
- The Case Gym drill bank proposed concept slugs before the portal ids existed; Wave M5 maps all 50 to real ids and keeps the original slug as `sourceConceptSlug` (see `docs/case-gym-concept-mapping.md`).
- MGMT 510 and B CMU 501 share one course slot, which is how the catalog reaches 22 courses.
