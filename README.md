# mba-business-os

A personal MBA knowledge portal: a pan-and-zoom mind map of the UW Foster MBA (5 pillars, 22 courses), deep concept cards, a live 3-statement linker, and a 5-minute daily routine. Wave M1 ships Pillar 1, ACCTG 500 Financial Accounting, with 15 concept nodes.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TypeScript, app and config
npm test           # Vitest
npm run build      # typecheck + production build into dist/
```

## The four views

1. **Mind map**: root → 5 pillars → 22 courses → ACCTG 500 concepts. Drag to pan, scroll or +/− to zoom, toggle thread edges, search or filter by tag. Mastery (new, reviewed, mastered) is saved in this browser.
2. **Concept drawer**: Hook → 20/80 with formulas → Reality check → 8 lenses with filter chips → Threads to pull → Boardroom drill with a click-to-reveal CFO answer, plus Mark reviewed / Mark mastered.
3. **3-statement linker**: sliders for revenue growth, gross margin, OpEx, DSO, DIO, DPO, annual CapEx, useful life and deferred revenue growth drive a 3-year income statement, balance sheet and cash flow statement. Cash is derived from the cash flow statement (with a minimum-cash revolver), so the green `Assets === Liabilities + Equity` badge holds for every slider state. An FCF bridge shows net income to free cash flow.
4. **5-minute routine**: a timer and four prompts per concept, saved in this browser, with one-click Markdown export.

## Layout

```
src/
  schema/knowledgeGraph.ts   ConceptNode types, runtime validation, link integrity
  data/catalog.ts            5 pillars and 22 courses
  data/pillar-1a-acctg500-financial.json   15 ACCTG 500 concept nodes
  data/graph.ts              validated concepts (parse fails loudly on bad data)
  lib/threeStatement.ts      linker engine, slider specs, seeded RNG
  lib/mindMapLayout.ts       radial layout and search filter
  lib/storage.ts             localStorage helpers (safe when storage is blocked)
  lib/routineMarkdown.ts     routine log → Markdown
  components/                MindMap, ConceptDrawer, LinkerSandbox, RoutineScratchpad
  test/                      schema, integrity, catalog, engine, storage, no-any
```

## Content rules (enforced by tests)

- Every node has a 2-sentence hook, a 20/80 summary with at least one formula, a reality check, all 8 lenses (each 2–3 sentences, or `null` for "Low signal — skipped"), at least 2 threads, a boardroom drill and at least 3 tagged sources, one of them `[Foster: ...]`.
- No filler text (TBD, TODO, placeholder and similar).
- Every thread resolves to a concept or a course; no self or duplicate links.
- The linker balances to within 1e-6 across 100 seeded random slider states.
- No explicit `any` anywhere in `src`.

## Data notes

- Drills marked *illustrative* use teaching numbers, not company disclosures.
- Cisco figures come from the Foster class excerpt of the fiscal 2020 annual report, which the course notes was modified for class purposes.
- Facts flagged "verify" (for example hyperscaler server useful-life changes) should be checked against current filings.
- MGMT 510 and B CMU 501 share one course slot, which is how the catalog reaches 22 courses.
