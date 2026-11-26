/**
 * A deliberately small 3-statement model for the Linker sandbox.
 *
 * Cash is never an input: it is the output of the cash flow statement, and a revolver draws or
 * repays to hold a minimum cash balance. Because every balance sheet change is driven by the same
 * flows that feed the income and cash flow statements, Assets = Liabilities + Equity holds for any
 * slider combination. Year 0 is a fixed, illustrative base company that balances by construction.
 */

export interface LinkerInputs {
  /** Revenue growth per year, in percent. */
  revenueGrowthPct: number;
  /** Gross margin, in percent of revenue. */
  grossMarginPct: number;
  /** Cash operating expenses (excluding depreciation), in percent of revenue. */
  opexPct: number;
  /** Days sales outstanding (receivables). */
  dso: number;
  /** Days inventory outstanding. */
  dio: number;
  /** Days payables outstanding. */
  dpo: number;
  /** Capital expenditure per year, in $M. */
  annualCapex: number;
  /** Useful life of new CapEx, in years (straight-line, no salvage). */
  usefulLifeYears: number;
  /** Deferred revenue growth per year, in percent. */
  deferredRevenueGrowthPct: number;
}

export type InputKey = keyof LinkerInputs;

export interface InputSpec {
  key: InputKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: '%' | 'days' | '$M' | 'yrs';
  help: string;
}

export const INPUT_SPECS: readonly InputSpec[] = [
  { key: 'revenueGrowthPct', label: 'Revenue growth', min: -30, max: 100, step: 1, unit: '%', help: 'Year-over-year growth in revenue.' },
  { key: 'grossMarginPct', label: 'Gross margin', min: 10, max: 90, step: 1, unit: '%', help: 'Revenue minus COGS, as a share of revenue.' },
  { key: 'opexPct', label: 'OpEx', min: 5, max: 80, step: 1, unit: '%', help: 'Cash operating expenses (R&D, S&M, G&A) as a share of revenue.' },
  { key: 'dso', label: 'DSO', min: 0, max: 120, step: 1, unit: 'days', help: 'Receivables = Revenue × DSO / 365.' },
  { key: 'dio', label: 'DIO', min: 0, max: 180, step: 1, unit: 'days', help: 'Inventory = COGS × DIO / 365.' },
  { key: 'dpo', label: 'DPO', min: 0, max: 120, step: 1, unit: 'days', help: 'Payables = COGS × DPO / 365.' },
  { key: 'annualCapex', label: 'Annual CapEx', min: 0, max: 60, step: 1, unit: '$M', help: 'Cash spent on PP&E each year; capitalized, then depreciated.' },
  { key: 'usefulLifeYears', label: 'Useful life', min: 2, max: 10, step: 1, unit: 'yrs', help: 'Straight-line life of new CapEx.' },
  { key: 'deferredRevenueGrowthPct', label: 'Deferred revenue growth', min: -50, max: 100, step: 1, unit: '%', help: 'Growth in customer prepayments (a liability that funds the business).' },
];

export const DEFAULT_INPUTS: LinkerInputs = {
  revenueGrowthPct: 25,
  grossMarginPct: 60,
  opexPct: 35,
  dso: 45,
  dio: 60,
  dpo: 30,
  annualCapex: 12,
  usefulLifeYears: 5,
  deferredRevenueGrowthPct: 20,
};

/** Fixed modelling assumptions shown in the UI so nothing is hidden. */
export const ASSUMPTIONS = {
  taxRatePct: 21,
  revolverRatePct: 8,
  minimumCash: 5,
  existingPpeLifeYears: 5,
  years: 3,
} as const;

/** Illustrative Year 0 base company ($M). Retained earnings is the plug that makes it balance. */
export const YEAR0 = {
  revenue: 100,
  cogs: 40,
  cash: 20,
  receivables: 12,
  inventory: 7,
  netPpe: 40,
  payables: 4,
  deferredRevenue: 20,
  revolver: 0,
  commonStock: 30,
} as const;

export interface YearResult {
  year: number;
  // Income statement
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  depreciation: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  // Balance sheet
  cash: number;
  receivables: number;
  inventory: number;
  netPpe: number;
  totalAssets: number;
  payables: number;
  deferredRevenue: number;
  revolver: number;
  totalLiabilities: number;
  commonStock: number;
  retainedEarnings: number;
  totalEquity: number;
  // Cash flow statement
  changeReceivables: number;
  changeInventory: number;
  changePayables: number;
  changeDeferredRevenue: number;
  cfo: number;
  capex: number;
  cfi: number;
  netBorrowing: number;
  cff: number;
  netChangeInCash: number;
  fcf: number;
  /** Assets − (Liabilities + Equity); zero up to floating-point noise. */
  balanceGap: number;
}

export interface ModelResult {
  inputs: LinkerInputs;
  years: YearResult[];
  /** Largest |Assets − (L + E)| across all years. */
  maxBalanceGap: number;
  balanced: boolean;
}

export const BALANCE_TOLERANCE = 1e-6;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamps every input into its slider range, so the engine never sees impossible values. */
export function sanitizeInputs(inputs: LinkerInputs): LinkerInputs {
  const out = { ...inputs };
  for (const spec of INPUT_SPECS) out[spec.key] = clamp(inputs[spec.key], spec.min, spec.max);
  out.usefulLifeYears = Math.round(out.usefulLifeYears);
  return out;
}

function year0(): YearResult {
  const totalAssets = YEAR0.cash + YEAR0.receivables + YEAR0.inventory + YEAR0.netPpe;
  const totalLiabilities = YEAR0.payables + YEAR0.deferredRevenue + YEAR0.revolver;
  const retainedEarnings = totalAssets - totalLiabilities - YEAR0.commonStock;
  const grossProfit = YEAR0.revenue - YEAR0.cogs;
  return {
    year: 0,
    revenue: YEAR0.revenue,
    cogs: YEAR0.cogs,
    grossProfit,
    opex: 0,
    depreciation: 0,
    ebit: 0,
    interest: 0,
    ebt: 0,
    tax: 0,
    netIncome: 0,
    cash: YEAR0.cash,
    receivables: YEAR0.receivables,
    inventory: YEAR0.inventory,
    netPpe: YEAR0.netPpe,
    totalAssets,
    payables: YEAR0.payables,
    deferredRevenue: YEAR0.deferredRevenue,
    revolver: YEAR0.revolver,
    totalLiabilities,
    commonStock: YEAR0.commonStock,
    retainedEarnings,
    totalEquity: YEAR0.commonStock + retainedEarnings,
    changeReceivables: 0,
    changeInventory: 0,
    changePayables: 0,
    changeDeferredRevenue: 0,
    cfo: 0,
    capex: 0,
    cfi: 0,
    netBorrowing: 0,
    cff: 0,
    netChangeInCash: 0,
    fcf: 0,
    balanceGap: totalAssets - (totalLiabilities + YEAR0.commonStock + retainedEarnings),
  };
}

export function runModel(rawInputs: LinkerInputs): ModelResult {
  const inputs = sanitizeInputs(rawInputs);
  const g = inputs.revenueGrowthPct / 100;
  const gm = inputs.grossMarginPct / 100;
  const opexRate = inputs.opexPct / 100;
  const drGrowth = inputs.deferredRevenueGrowthPct / 100;
  const tax = ASSUMPTIONS.taxRatePct / 100;
  const rate = ASSUMPTIONS.revolverRatePct / 100;
  const existingDep = YEAR0.netPpe / ASSUMPTIONS.existingPpeLifeYears;

  const years: YearResult[] = [year0()];
  for (let t = 1; t <= ASSUMPTIONS.years; t += 1) {
    const prev = years[t - 1];
    if (!prev) throw new Error('missing prior year');

    const revenue = prev.revenue * (1 + g);
    const cogs = revenue * (1 - gm);
    const grossProfit = revenue - cogs;
    const opex = revenue * opexRate;

    // Straight-line vintages: CapEx is spent at the start of each year and depreciates for its life.
    let depreciation = t <= ASSUMPTIONS.existingPpeLifeYears ? existingDep : 0;
    for (let v = 1; v <= t; v += 1) {
      if (t - v < inputs.usefulLifeYears) depreciation += inputs.annualCapex / inputs.usefulLifeYears;
    }

    const ebit = grossProfit - opex - depreciation;
    const interest = prev.revolver * rate;
    const ebt = ebit - interest;
    const taxExpense = Math.max(0, ebt) * tax;
    const netIncome = ebt - taxExpense;

    const receivables = (revenue * inputs.dso) / 365;
    const inventory = (cogs * inputs.dio) / 365;
    const payables = (cogs * inputs.dpo) / 365;
    const deferredRevenue = prev.deferredRevenue * (1 + drGrowth);

    const changeReceivables = receivables - prev.receivables;
    const changeInventory = inventory - prev.inventory;
    const changePayables = payables - prev.payables;
    const changeDeferredRevenue = deferredRevenue - prev.deferredRevenue;

    const cfo = netIncome + depreciation - changeReceivables - changeInventory + changePayables + changeDeferredRevenue;
    const capex = inputs.annualCapex;
    const cfi = -capex;

    // Revolver: draw to hold minimum cash, repay when there is surplus.
    const cashBeforeFinancing = prev.cash + cfo + cfi;
    let netBorrowing = 0;
    if (cashBeforeFinancing < ASSUMPTIONS.minimumCash) {
      netBorrowing = ASSUMPTIONS.minimumCash - cashBeforeFinancing;
    } else if (prev.revolver > 0) {
      netBorrowing = -Math.min(prev.revolver, cashBeforeFinancing - ASSUMPTIONS.minimumCash);
    }
    const cff = netBorrowing;
    const netChangeInCash = cfo + cfi + cff;

    const cash = prev.cash + netChangeInCash;
    const netPpe = prev.netPpe + capex - depreciation;
    const revolver = prev.revolver + netBorrowing;
    const retainedEarnings = prev.retainedEarnings + netIncome;
    const commonStock = prev.commonStock;

    const totalAssets = cash + receivables + inventory + netPpe;
    const totalLiabilities = payables + deferredRevenue + revolver;
    const totalEquity = commonStock + retainedEarnings;

    years.push({
      year: t,
      revenue,
      cogs,
      grossProfit,
      opex,
      depreciation,
      ebit,
      interest,
      ebt,
      tax: taxExpense,
      netIncome,
      cash,
      receivables,
      inventory,
      netPpe,
      totalAssets,
      payables,
      deferredRevenue,
      revolver,
      totalLiabilities,
      commonStock,
      retainedEarnings,
      totalEquity,
      changeReceivables,
      changeInventory,
      changePayables,
      changeDeferredRevenue,
      cfo,
      capex,
      cfi,
      netBorrowing,
      cff,
      netChangeInCash,
      fcf: cfo - capex,
      balanceGap: totalAssets - (totalLiabilities + totalEquity),
    });
  }

  const maxBalanceGap = Math.max(...years.map((y) => Math.abs(y.balanceGap)));
  return { inputs, years, maxBalanceGap, balanced: maxBalanceGap < BALANCE_TOLERANCE };
}

export interface BridgeStep {
  label: string;
  value: number;
  kind: 'start' | 'delta' | 'total';
}

/** Net income to free cash flow, step by step, for the waterfall chart. */
export function fcfBridge(year: YearResult): BridgeStep[] {
  return [
    { label: 'Net income', value: year.netIncome, kind: 'start' },
    { label: '+ Depreciation', value: year.depreciation, kind: 'delta' },
    { label: '− Δ Receivables', value: -year.changeReceivables, kind: 'delta' },
    { label: '− Δ Inventory', value: -year.changeInventory, kind: 'delta' },
    { label: '+ Δ Payables', value: year.changePayables, kind: 'delta' },
    { label: '+ Δ Deferred rev.', value: year.changeDeferredRevenue, kind: 'delta' },
    { label: '− CapEx', value: -year.capex, kind: 'delta' },
    { label: 'Free cash flow', value: year.fcf, kind: 'total' },
  ];
}

/** Deterministic PRNG (mulberry32) so random-state tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random input state within the slider ranges (snapped to each slider's step). */
export function randomInputs(rand: () => number): LinkerInputs {
  const out = { ...DEFAULT_INPUTS };
  for (const spec of INPUT_SPECS) {
    const steps = Math.round((spec.max - spec.min) / spec.step);
    out[spec.key] = spec.min + Math.floor(rand() * (steps + 1)) * spec.step;
  }
  return out;
}
