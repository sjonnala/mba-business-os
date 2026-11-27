# Case Gym concept mapping (Wave M5)

The M-402 drill bank proposed concept slugs before the portal ids were checked. Wave M5 maps every one of the 50 drills to a real concept id, and `src/test/caseGym.test.ts` asserts that all 50 resolve.

One link crosses courses: `gym-p5-05` is a MGMT 500 drill on succession, and it links to the MGMT 550 succession concept because Pillar 5 covers succession there.

| Drill | M-402 slug | Concept id in the portal |
|---|---|---|
| gym-p1-01 | `a500-02-accrual-rev-rec` | `a500-02-accrual-revenue-recognition` |
| gym-p1-02 | `a500-05-cash-flow-fcf` | `a500-05-cash-flow-fcf` |
| gym-p1-03 | `a500-06-capex-depreciation-gpu` | `a500-06-capex-depreciation` |
| gym-p1-04 | `a500-13-ma-goodwill` | `a500-13-ma-goodwill` |
| gym-p1-05 | `a500-11-earnings-quality` | `a500-11-earnings-quality` |
| gym-p1-06 | `a500-15-read-10k-routine` | `a500-15-read-10k-routine` |
| gym-p1-07 | `a501-02-contribution-margin-breakeven` | `a501-02-contribution-margin-breakeven` |
| gym-p1-08 | `a501-05-relevant-costs-build-buy` | `a501-05-relevant-costs-make-vs-buy` |
| gym-p1-09 | `a501-08-roi-ri-eva` | `a501-08-eva-residual-income` |
| gym-p1-10 | `a501-07-transfer-pricing` | `a501-07-transfer-pricing` |
| gym-p2-01 | `fin502-03-wacc-capm-beta` | `f502-03-wacc-capm-beta` |
| gym-p2-02 | `fin502-04-terminal-value-guard` | `f502-04-terminal-value-multiples` |
| gym-p2-03 | `fin502-07-roic-vs-wacc` | `f502-07-roic-vs-wacc` |
| gym-p2-04 | `fin502-06-capital-allocation` | `f502-06-capital-allocation-buybacks` |
| gym-p2-05 | `entre557-01-vc-method-valuation` | `e557-09-startup-valuation-vc-method` |
| gym-p2-06 | `entre557-05-runway-burn-multiple` | `e557-13-runway-bridge` |
| gym-p2-07 | `entre557-04-unit-economics-ltv-cac` | `e557-12-unit-economics-ltv-cac` |
| gym-p2-08 | `entre542-03-term-sheet-pool-prefs` | `e542-11-venture-term-sheets` |
| gym-p2-09 | `entre542-03-term-sheet-pool-prefs` | `e542-11-venture-term-sheets` |
| gym-p2-10 | `entre542-04-vc-fund-math` | `e542-14-vc-power-law-dpi-tvpi` |
| gym-p3-01 | `econ500-01-price-elasticity` | `be500-01-elasticity-pricing-power` |
| gym-p3-02 | `econ501-02-rates-cost-of-capital` | `be501-02-rates-monetary-policy-cost-of-capital` |
| gym-p3-03 | `mgmt502-02-five-forces` | `m502-02-five-forces-industry-structure` |
| gym-p3-04 | `mgmt502-06-seven-powers` | `m502-06-helmer-7-powers` |
| gym-p3-05 | `mgmt502-05-corporate-scope` | `m502-05-corporate-scope-integration-alliances` |
| gym-p3-06 | `opmgt502-01-process-flow-bottleneck` | `op502-01-process-flow-bottleneck` |
| gym-p3-07 | `opmgt502-02-littles-law` | `op502-02-littles-law-lead-time-cycle-time` |
| gym-p3-08 | `qmeth500-01-hypothesis-regression` | `qm500-01-hypothesis-testing-regression` |
| gym-p3-09 | `qmeth501-01-linear-programming` | `qm501-01-linear-integer-programming` |
| gym-p3-10 | `is500-01-data-quality-sql` | `is500-01-sql-data-quality-decisions` |
| gym-p4-01 | `entre510-01-strategy-compass` | `e510-01-entrepreneurial-strategy-compass` |
| gym-p4-02 | `entre510-02-hypothesis-driven` | `e510-02-hypothesis-driven-mvp-sequencing` |
| gym-p4-03 | `entre532-03-mikesell-playbook` | `e532-03-mikesell-deep-tech-risk-retirement` |
| gym-p4-04 | `entre532-01-pitch-four-beliefs` | `e532-01-pitch-narrative-four-beliefs` |
| gym-p4-05 | `entre532-04-startup-financial-model` | `e532-04-saas-financial-model-assumptions` |
| gym-p4-06 | `entre579-01-customer-discovery` | `e579-01-customer-discovery-interviews` |
| gym-p4-07 | `entre579-02-value-prop-ecosystem` | `e579-02-value-proposition-ecosystem-map` |
| gym-p4-08 | `mktg554-02-product-market-fit` | `mk554-02-pmf-needs-kano-jtbd` |
| gym-p4-09 | `mktg554-04-pricing-wtp-gbb` | `mk554-04-pricing-wtp-packaging` |
| gym-p4-10 | `mktg554-05-ai-unit-economics` | `mk554-05-ai-product-unit-economics-payback` |
| gym-p5-01 | `p5-mktg501-01-stp-positioning` | `mk501-01-three-cs-stp-positioning` |
| gym-p5-02 | `p5-mktg501-02-pricing-communication` | `mk501-04-value-based-pricing-price-communication` |
| gym-p5-03 | `p5-mktg600-01-community-brand` | `mk600-01-community-led-brand-after-acquisition` |
| gym-p5-04 | `p5-mgmt500-01-first-time-manager` | `m500-01-first-time-manager-motivation` |
| gym-p5-05 | `p5-mgmt500-02-succession` | `m550-04-ceo-succession-activism` |
| gym-p5-06 | `p5-bcmu501-01-executive-communication` | `m510-01-executive-communication-bottom-line-up-front` |
| gym-p5-07 | `p5-mgmt504-01-crisis-ethics` | `m504-01-crisis-response-stakeholder-trust` |
| gym-p5-08 | `p5-mgmt504-02-incentives-ethics` | `m504-02-incentives-ethical-breakdowns` |
| gym-p5-09 | `p5-mgmt550-01-board-composition` | `m550-01-fiduciary-duties-board-composition` |
| gym-p5-10 | `p5-mgmt550-02-control-related-party` | `m550-02-dual-class-control-related-party` |
