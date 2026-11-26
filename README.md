# mba-business-os

A personal MBA knowledge portal: a pan-and-zoom mind map of the UW Foster MBA (5 pillars, 22 courses), deep concept cards, a live 3-statement linker, a DCF and WACC studio, a cap table lab, an operations bottleneck lab, and a 5-minute daily routine. Wave M1 shipped ACCTG 500 Financial Accounting (15 concept nodes). Wave M2 adds ACCTG 501 Managerial Accounting (10 nodes) and Pillar 2 Finance, Valuation & VC across FIN 502, ENTRE 557 and ENTRE 542 (14 nodes). Wave M3 adds Pillar 3 Strategy, Economics, Operations & Analytics across B ECON 500/501, MGMT 502, OPMGT 502, QMETH 500/501 and I S 500 (18 nodes), for 57 live concepts.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TypeScript, app and config
npm test           # Vitest
npm run build      # typecheck + production build into dist/
```

## The seven views

1. **Mind map**: root → 5 pillars → 22 courses → concepts of the live courses. Each course gets a sector sized by its concept count, so neighbouring fans never overlap. Drag to pan, scroll or +/− to zoom, toggle thread edges, search or filter by tag. Mastery (new, reviewed, mastered) is saved in this browser.
2. **Concept drawer**: Hook → 20/80 with formulas → Reality check → 8 lenses with filter chips → Threads to pull → Boardroom drill with a click-to-reveal CFO answer, plus Mark reviewed / Mark mastered.
3. **3-statement linker**: sliders for revenue growth, gross margin, OpEx, DSO, DIO, DPO, annual CapEx, useful life and deferred revenue growth drive a 3-year income statement, balance sheet and cash flow statement. Cash is derived from the cash flow statement (with a minimum-cash revolver), so the green `Assets === Liabilities + Equity` badge holds for every slider state. An FCF bridge shows net income to free cash flow.
4. **DCF & WACC studio (Lab #2)**: CAPM cost of equity with asset beta relevered to the target D/E, WACC, a 5-year FCFF forecast (EBIT × (1 − t) + D&A − CapEx − ΔNWC), Gordon terminal value, the bridge to equity value per share, a 5 × 5 WACC-versus-g heatmap, and DuPont ROIC (NOPAT margin × capital turnover) against WACC. A WACC > g guard rejects any terminal value where growth meets or exceeds the discount rate, in the headline and cell by cell.
5. **Cap table lab (Lab #3)**: founders and an existing pool, stacked post-money SAFEs (cap and discount), a Series A with the option pool shuffle inside the pre-money, the effective pre-money, and a 1x liquidation waterfall comparing non-participating and participating preferred at any exit. Ownership uses whole basis points (largest remainder), so it always totals exactly 100.00%.
6. **Ops bottleneck lab (Lab #4)**: a 2–6 stage pipeline with presets for a robot assembly line, the OPMGT 502 sandwich flow line, an LLM inference service and an ML labeling pipeline. Arrival rate and variability plus each stage's resources, service time and variability drive capacity (m ÷ p), the bottleneck, throughput = min(demand, capacity), utilization, cycle time, Sakasegawa queue waits, lead time and Little's Law WIP. A seeded discrete-event simulation plays the queue buildup over time, and a "double this stage" table proves non-bottleneck capacity adds zero throughput.
7. **5-minute routine**: a timer and four prompts per concept, saved in this browser, with one-click Markdown export.

## Layout

```
src/
  schema/knowledgeGraph.ts   ConceptNode types, runtime validation, link integrity
  data/catalog.ts            5 pillars and 22 courses
  data/pillar-1a-acctg500-financial.json   15 ACCTG 500 concept nodes
  data/pillar-1b-acctg501-managerial.json  10 ACCTG 501 concept nodes
  data/pillar-2-fin502-entre557-entre542.json  14 FIN 502 / ENTRE 557 / ENTRE 542 nodes
  data/pillar-3-econ-mgmt502-ops-qmeth.json    18 B ECON / MGMT 502 / OPMGT 502 / QMETH / I S 500 nodes
  data/graph.ts              validated concepts (parse fails loudly on bad data)
  lib/threeStatement.ts      linker engine, slider specs, seeded RNG
  lib/valuation.ts           CAPM, beta relevering, WACC, FCFF, DCF, WACC > g guard, 5 × 5 grid, DuPont ROIC
  lib/capTable.ts            SAFE and note conversion, pool shuffle, basis-point ownership, liquidation waterfall
  lib/opsBottleneck.ts       capacity, bottleneck, queue waits, Little's Law, seeded discrete-event simulation, presets
  lib/mindMapLayout.ts       radial layout and search filter
  lib/storage.ts             localStorage helpers (safe when storage is blocked)
  lib/routineMarkdown.ts     routine log → Markdown
  components/                MindMap, ConceptDrawer, LinkerSandbox, DcfStudio, CapTableLab, OpsBottleneckLab, RoutineScratchpad
  test/                      schema, integrity, catalog, engine, valuation, capTable, opsBottleneck, storage, no-any
```

## Content rules (enforced by tests)

- Every node has a 2-sentence hook, a 20/80 summary with at least one formula, a reality check, all 8 lenses (each 2–3 sentences, or `null` for "Low signal — skipped"), at least 2 threads, a boardroom drill and at least 3 tagged sources, one of them `[Foster: ...]`.
- No filler text (TBD, TODO, placeholder and similar).
- Every thread resolves to a concept or a course; no self or duplicate links.
- The linker balances to within 1e-6 across 100 seeded random slider states.
- Wave M2 nodes each link outside their own course; Pillar 2 links back to the ACCTG 500 statements and ACCTG 501 links forward to Pillar 2.
- Every Wave M3 node links to Pillar 1, Pillar 2 or a future course and outside its own course; all 18 link back into Pillars 1-2.
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
- MGMT 510 and B CMU 501 share one course slot, which is how the catalog reaches 22 courses.
