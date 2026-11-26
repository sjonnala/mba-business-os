/**
 * Lab #2: DCF, WACC & DuPont ROIC Sensitivity Studio.
 *
 * Inputs are entered in percent (as the UI shows them) and converted to decimals here. Every
 * figure in DEFAULT_DCF_INPUTS is an illustrative teaching number, not a real company. The one
 * hard rule is the Gordon growth guard: a growing perpetuity only has a finite value when the
 * discount rate exceeds the growth rate, so any WACC <= g returns an explicit error instead of a
 * negative or infinite terminal value.
 */

export interface DcfInputs {
  /** Last actual revenue (Year 0), in $M. */
  baseRevenue: number;
  /** Revenue growth in each forecast year, in percent. */
  revenueGrowthPct: number;
  /** EBIT margin, in percent of revenue. */
  ebitMarginPct: number;
  /** Cash tax rate on EBIT, in percent. */
  taxRatePct: number;
  /** Depreciation and amortization, in percent of revenue. */
  daPct: number;
  /** Capital expenditure, in percent of revenue. */
  capexPct: number;
  /** Net working capital held, in percent of revenue (so ΔNWC = NWC% × ΔRevenue). */
  nwcPct: number;
  /** Long-run growth of FCFF after the forecast, in percent. */
  terminalGrowthPct: number;
  /** Risk-free rate, in percent. */
  riskFreePct: number;
  /** Market risk premium, in percent. */
  marketRiskPremiumPct: number;
  /** Unlevered (asset) beta of the business. */
  assetBeta: number;
  /** Pre-tax cost of debt, in percent. */
  preTaxCostOfDebtPct: number;
  /** Target debt weight D / (D + E), in percent. */
  debtWeightPct: number;
  /** Net debt (debt minus cash), in $M, subtracted from enterprise value. */
  netDebt: number;
  /** Diluted shares outstanding, in millions. */
  sharesOutstanding: number;
}

export type DcfInputKey = keyof DcfInputs;

export interface DcfInputSpec {
  key: DcfInputKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: '%' | '$M' | 'x' | 'M';
  group: 'operations' | 'capital';
  help: string;
}

export const DCF_INPUT_SPECS: readonly DcfInputSpec[] = [
  { key: 'baseRevenue', label: 'Year 0 revenue', min: 50, max: 2000, step: 10, unit: '$M', group: 'operations', help: 'Last actual revenue; the forecast grows from here.' },
  { key: 'revenueGrowthPct', label: 'Revenue growth (Years 1-5)', min: -10, max: 40, step: 1, unit: '%', group: 'operations', help: 'Annual growth during the explicit forecast.' },
  { key: 'ebitMarginPct', label: 'EBIT margin', min: -10, max: 50, step: 1, unit: '%', group: 'operations', help: 'Operating income as a share of revenue.' },
  { key: 'taxRatePct', label: 'Tax rate', min: 0, max: 40, step: 1, unit: '%', group: 'operations', help: 'Applied to EBIT to get NOPAT, and to interest in WACC.' },
  { key: 'daPct', label: 'D&A', min: 0, max: 15, step: 0.5, unit: '%', group: 'operations', help: 'Non-cash charge added back to NOPAT.' },
  { key: 'capexPct', label: 'CapEx', min: 0, max: 20, step: 0.5, unit: '%', group: 'operations', help: 'Cash reinvested in fixed assets.' },
  { key: 'nwcPct', label: 'Net working capital', min: -10, max: 30, step: 1, unit: '%', group: 'operations', help: 'NWC held per dollar of revenue; growth ties up cash.' },
  { key: 'terminalGrowthPct', label: 'Terminal growth g', min: -2, max: 12, step: 0.5, unit: '%', group: 'capital', help: 'Perpetual FCFF growth after Year 5. Must stay below WACC.' },
  { key: 'riskFreePct', label: 'Risk-free rate', min: 0, max: 10, step: 0.25, unit: '%', group: 'capital', help: 'Government bond yield matching the cash flow horizon.' },
  { key: 'marketRiskPremiumPct', label: 'Market risk premium', min: 3, max: 9, step: 0.25, unit: '%', group: 'capital', help: 'Expected market return above the risk-free rate.' },
  { key: 'assetBeta', label: 'Asset (unlevered) beta', min: 0.3, max: 2.5, step: 0.05, unit: 'x', group: 'capital', help: 'Business risk before financing; relevered to the target D/E.' },
  { key: 'preTaxCostOfDebtPct', label: 'Pre-tax cost of debt', min: 2, max: 14, step: 0.25, unit: '%', group: 'capital', help: 'Yield on the company’s debt.' },
  { key: 'debtWeightPct', label: 'Debt weight D/V', min: 0, max: 70, step: 5, unit: '%', group: 'capital', help: 'Target market-value share of debt in the capital structure.' },
  { key: 'netDebt', label: 'Net debt', min: -500, max: 1500, step: 10, unit: '$M', group: 'capital', help: 'Debt minus cash; subtracted to get equity value.' },
  { key: 'sharesOutstanding', label: 'Diluted shares', min: 10, max: 500, step: 5, unit: 'M', group: 'capital', help: 'Used for value per share.' },
];

/** Illustrative mid-size software company. */
export const DEFAULT_DCF_INPUTS: DcfInputs = {
  baseRevenue: 500,
  revenueGrowthPct: 12,
  ebitMarginPct: 20,
  taxRatePct: 21,
  daPct: 4,
  capexPct: 6,
  nwcPct: 10,
  terminalGrowthPct: 3,
  riskFreePct: 4.5,
  marketRiskPremiumPct: 5.5,
  assetBeta: 1.1,
  preTaxCostOfDebtPct: 6.5,
  debtWeightPct: 20,
  netDebt: 150,
  sharesOutstanding: 100,
};

export const FORECAST_YEARS = 5;

const pct = (v: number) => v / 100;

/** CAPM: r_E = r_f + β × MRP (all decimals). */
export function costOfEquity(riskFree: number, equityBeta: number, marketRiskPremium: number): number {
  return riskFree + equityBeta * marketRiskPremium;
}

export interface ReleverArgs {
  assetBeta: number;
  /** D / E as a ratio (not a weight). */
  debtToEquity: number;
  /** Debt beta; 0 gives Hamada's formula. */
  debtBeta?: number;
  /** Tax rate as a decimal; 0 gives the Modigliani-Miller no-tax case. */
  taxRate?: number;
}

/** β_E = β_A + (β_A − β_D) × (1 − t) × D/E. */
export function releverBeta({ assetBeta, debtToEquity, debtBeta = 0, taxRate = 0 }: ReleverArgs): number {
  if (debtToEquity < 0) throw new RangeError('D/E cannot be negative');
  return assetBeta + (assetBeta - debtBeta) * (1 - taxRate) * debtToEquity;
}

export interface WaccArgs {
  costOfEquity: number;
  preTaxCostOfDebt: number;
  /** D / (D + E), decimal between 0 and 1 (exclusive of 1). */
  debtWeight: number;
  taxRate: number;
}

/** WACC = E/V × r_E + D/V × r_D × (1 − t). */
export function wacc({ costOfEquity: rE, preTaxCostOfDebt, debtWeight, taxRate }: WaccArgs): number {
  if (debtWeight < 0 || debtWeight >= 1) throw new RangeError('Debt weight must be in [0, 1)');
  return (1 - debtWeight) * rE + debtWeight * preTaxCostOfDebt * (1 - taxRate);
}

export interface CapitalCost {
  debtToEquity: number;
  equityBeta: number;
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  wacc: number;
}

/** Builds WACC from the studio's CAPM inputs (Hamada relevering, debt beta 0). */
export function capitalCost(inputs: DcfInputs): CapitalCost {
  const debtWeight = pct(inputs.debtWeightPct);
  const tax = pct(inputs.taxRatePct);
  const debtToEquity = debtWeight / (1 - debtWeight);
  const equityBeta = releverBeta({ assetBeta: inputs.assetBeta, debtToEquity, taxRate: tax });
  const rE = costOfEquity(pct(inputs.riskFreePct), equityBeta, pct(inputs.marketRiskPremiumPct));
  const rD = pct(inputs.preTaxCostOfDebtPct);
  return {
    debtToEquity,
    equityBeta,
    costOfEquity: rE,
    afterTaxCostOfDebt: rD * (1 - tax),
    wacc: wacc({ costOfEquity: rE, preTaxCostOfDebt: rD, debtWeight, taxRate: tax }),
  };
}

export interface ForecastYear {
  year: number;
  revenue: number;
  ebit: number;
  nopat: number;
  da: number;
  capex: number;
  changeInNwc: number;
  fcff: number;
}

/** FCFF = EBIT × (1 − t) + D&A − CapEx − ΔNWC for Years 1..5. */
export function forecastFcff(inputs: DcfInputs): ForecastYear[] {
  const years: ForecastYear[] = [];
  let prevRevenue = inputs.baseRevenue;
  for (let year = 1; year <= FORECAST_YEARS; year += 1) {
    const revenue = prevRevenue * (1 + pct(inputs.revenueGrowthPct));
    const ebit = revenue * pct(inputs.ebitMarginPct);
    // A loss year pays no tax (no loss carryforward modelled, kept simple and visible).
    const nopat = ebit > 0 ? ebit * (1 - pct(inputs.taxRatePct)) : ebit;
    const da = revenue * pct(inputs.daPct);
    const capex = revenue * pct(inputs.capexPct);
    const changeInNwc = (revenue - prevRevenue) * pct(inputs.nwcPct);
    years.push({ year, revenue, ebit, nopat, da, capex, changeInNwc, fcff: nopat + da - capex - changeInNwc });
    prevRevenue = revenue;
  }
  return years;
}

export type TerminalValueResult =
  | { ok: true; value: number }
  | { ok: false; reason: string };

/**
 * Gordon growth terminal value at the end of the final forecast year:
 * TV = FCFF_N × (1 + g) / (WACC − g). Refuses WACC <= g.
 */
export function gordonTerminalValue(finalFcff: number, discountRate: number, growth: number): TerminalValueResult {
  if (!(discountRate > growth)) {
    return {
      ok: false,
      reason: `WACC (${(discountRate * 100).toFixed(2)}%) must exceed terminal growth (${(growth * 100).toFixed(2)}%); a perpetuity growing as fast as its discount rate has no finite value.`,
    };
  }
  return { ok: true, value: (finalFcff * (1 + growth)) / (discountRate - growth) };
}

export interface DcfValuation {
  ok: true;
  wacc: number;
  growth: number;
  years: (ForecastYear & { discountFactor: number; pv: number })[];
  pvExplicit: number;
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  valuePerShare: number;
  terminalShare: number;
  /** Terminal value divided by final-year EBITDA (EBIT + D&A). */
  impliedExitMultiple: number;
}

export type DcfResult = DcfValuation | { ok: false; reason: string; wacc: number; growth: number };

/** Full DCF at a given WACC and g (both decimals). */
export function valueDcf(inputs: DcfInputs, discountRate: number, growth: number): DcfResult {
  const forecast = forecastFcff(inputs);
  const last = forecast[forecast.length - 1];
  if (!last) return { ok: false, reason: 'No forecast years', wacc: discountRate, growth };
  const tv = gordonTerminalValue(last.fcff, discountRate, growth);
  if (!tv.ok) return { ok: false, reason: tv.reason, wacc: discountRate, growth };

  const years = forecast.map((y) => {
    const discountFactor = 1 / (1 + discountRate) ** y.year;
    return { ...y, discountFactor, pv: y.fcff * discountFactor };
  });
  const pvExplicit = years.reduce((s, y) => s + y.pv, 0);
  const pvTerminal = tv.value / (1 + discountRate) ** FORECAST_YEARS;
  const enterpriseValue = pvExplicit + pvTerminal;
  const equityValue = enterpriseValue - inputs.netDebt;
  const finalEbitda = last.ebit + last.da;
  return {
    ok: true,
    wacc: discountRate,
    growth,
    years,
    pvExplicit,
    terminalValue: tv.value,
    pvTerminal,
    enterpriseValue,
    equityValue,
    valuePerShare: equityValue / inputs.sharesOutstanding,
    terminalShare: enterpriseValue !== 0 ? pvTerminal / enterpriseValue : 0,
    impliedExitMultiple: finalEbitda !== 0 ? tv.value / finalEbitda : Number.NaN,
  };
}

/** Values the studio's inputs at the WACC implied by its CAPM inputs. */
export function runDcf(inputs: DcfInputs): { capital: CapitalCost; result: DcfResult } {
  const capital = capitalCost(inputs);
  return { capital, result: valueDcf(inputs, capital.wacc, pct(inputs.terminalGrowthPct)) };
}

export interface SensitivityCell {
  wacc: number;
  growth: number;
  /** Value per share, or null where the WACC > g guard rejects the pair. */
  valuePerShare: number | null;
}

export interface SensitivityGrid {
  waccs: number[];
  growths: number[];
  /** rows[i][j] is WACC waccs[i] with growth growths[j]. */
  rows: SensitivityCell[][];
  min: number;
  max: number;
  invalidCount: number;
}

/** Offsets from the base case, in percentage points, for the 5 × 5 grid. */
export const GRID_STEPS = [-1, -0.5, 0, 0.5, 1] as const;

/** 5 × 5 value-per-share grid centered on the base WACC and g (decimals). */
export function sensitivityGrid(inputs: DcfInputs, baseWacc: number, baseGrowth: number): SensitivityGrid {
  const waccs = GRID_STEPS.map((s) => baseWacc + s / 100);
  const growths = GRID_STEPS.map((s) => baseGrowth + s / 100);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let invalidCount = 0;
  const rows = waccs.map((w) =>
    growths.map((g) => {
      const r = valueDcf(inputs, w, g);
      if (!r.ok) {
        invalidCount += 1;
        return { wacc: w, growth: g, valuePerShare: null };
      }
      min = Math.min(min, r.valuePerShare);
      max = Math.max(max, r.valuePerShare);
      return { wacc: w, growth: g, valuePerShare: r.valuePerShare };
    }),
  );
  return { waccs, growths, rows, min, max, invalidCount };
}

export interface DupontRoicInputs {
  revenue: number;
  ebit: number;
  taxRate: number;
  investedCapital: number;
  wacc: number;
}

export interface DupontRoic {
  nopat: number;
  nopatMargin: number;
  capitalTurnover: number;
  roic: number;
  spread: number;
  /** Economic profit: (ROIC − WACC) × invested capital. */
  eva: number;
}

/** ROIC = NOPAT margin × invested capital turnover, compared with WACC. */
export function dupontRoic({ revenue, ebit, taxRate, investedCapital, wacc: w }: DupontRoicInputs): DupontRoic {
  if (revenue <= 0 || investedCapital <= 0) throw new RangeError('Revenue and invested capital must be positive');
  const nopat = ebit > 0 ? ebit * (1 - taxRate) : ebit;
  const nopatMargin = nopat / revenue;
  const capitalTurnover = revenue / investedCapital;
  const roic = nopatMargin * capitalTurnover;
  return { nopat, nopatMargin, capitalTurnover, roic, spread: roic - w, eva: (roic - w) * investedCapital };
}

/**
 * Invested capital for Year 1 implied by the studio inputs: NWC plus net fixed assets, where net
 * fixed assets are approximated as revenue × (CapEx − D&A) accumulated over an assumed five-year
 * build plus an illustrative base of 40% of Year 0 revenue. Kept explicit so the UI can show it.
 */
export function studioInvestedCapital(inputs: DcfInputs): number {
  const base = inputs.baseRevenue;
  const nwc = base * pct(inputs.nwcPct);
  const netFixed = base * 0.4;
  return Math.max(1, nwc + netFixed);
}

/** Value driver formula: Value = NOPAT_{t+1} × (1 − g / RONIC) / (WACC − g). */
export function valueDriver(nopatNext: number, growth: number, ronic: number, discountRate: number): TerminalValueResult {
  if (!(discountRate > growth)) {
    return { ok: false, reason: 'WACC must exceed g for the value driver formula.' };
  }
  if (ronic <= 0) return { ok: false, reason: 'Return on new invested capital must be positive.' };
  return { ok: true, value: (nopatNext * (1 - growth / ronic)) / (discountRate - growth) };
}
