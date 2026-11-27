/**
 * AI-product unit economics and customer payback math for Lab #5.
 *
 * One "account" is the unit of sale: a farm buying a robot, a consumer on a subscription, a clinic
 * site or an enterprise contract. Money is in dollars and time in months. The model tracks the
 * vendor and the customer side by side, because a product only scales when both pay back:
 *
 *   Vendor
 *     upfront contribution  = upfront price − upfront COGS (hardware, onboarding)
 *     recurring contribution_t = recurring price × (1 − platform fee) − serving cost_t
 *     serving cost_t        = serving cost_0 × (1 − annual decline)^((t − 1) / 12)   (GPU / inference cost curve)
 *     survival_t            = (1 − monthly churn)^(t − 1)                              (still a customer in month t)
 *     LTV                   = upfront contribution + Σ survival_t × contribution_t / (1 + r_m)^t over the horizon
 *     CAC payback           = first month where cumulative expected contribution ≥ CAC
 *   Customer
 *     net monthly benefit   = value created per month − recurring price
 *     customer payback      = upfront price ÷ net monthly benefit
 *     value capture         = what the vendor charges over the customer's horizon ÷ value created
 *
 * Presets mix public or course figures with illustrative assumptions; each preset says which.
 */

export type ProductKind = 'hardware-robotics' | 'consumer-app' | 'b2b-saas';

export interface UnitEconInputs {
  /** One-time price charged per account at sale (hardware, implementation or onboarding fee). */
  upfrontPrice: number;
  /** One-time cost to deliver that sale (bill of materials, install, onboarding labor). */
  upfrontCogs: number;
  /** Recurring price per account per month (subscription, service plan, usage commit). */
  monthlyPrice: number;
  /** Share of recurring revenue lost to app stores, marketplaces or payment processing, in percent. */
  platformFeePct: number;
  /** Recurring cost to serve one account per month in month 1: inference, hosting, support, field service. */
  monthlyServingCost: number;
  /** Annual decline in serving cost, in percent (falling GPU and inference prices). */
  servingCostDeclinePct: number;
  /** Sales and marketing cost to win one account. */
  cac: number;
  /** Probability an account leaves in a given month, in percent. */
  monthlyChurnPct: number;
  /** Annual discount rate for LTV, in percent. */
  annualDiscountPct: number;
  /** Months of customer life the model counts (caps LTV when churn is very low). */
  horizonMonths: number;
  /** Value the product creates for the customer per month (labor saved, revenue gained). 0 = not modelled. */
  customerMonthlyValue: number;
}

export interface UnitEconPreset {
  id: string;
  label: string;
  kind: ProductKind;
  accountNoun: string;
  blurb: string;
  /** Which inputs come from a public or course source, and which are illustrative. */
  sourcing: string;
  inputs: UnitEconInputs;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateInputs(x: UnitEconInputs): ValidationResult {
  const nonNeg: [keyof UnitEconInputs, string][] = [
    ['upfrontPrice', 'Upfront price'],
    ['upfrontCogs', 'Upfront COGS'],
    ['monthlyPrice', 'Monthly price'],
    ['monthlyServingCost', 'Serving cost'],
    ['cac', 'CAC'],
    ['customerMonthlyValue', 'Customer value'],
  ];
  for (const [key, label] of nonNeg) {
    const v = x[key];
    if (!Number.isFinite(v) || v < 0) return { ok: false, reason: `${label} must be zero or more.` };
  }
  if (x.upfrontPrice === 0 && x.monthlyPrice === 0) return { ok: false, reason: 'Charge something: an upfront price, a monthly price or both.' };
  if (!(x.platformFeePct >= 0 && x.platformFeePct < 100)) return { ok: false, reason: 'Platform fee must be from 0% to below 100%.' };
  if (!(x.servingCostDeclinePct >= 0 && x.servingCostDeclinePct < 100)) return { ok: false, reason: 'Serving cost decline must be from 0% to below 100% a year.' };
  if (!(x.monthlyChurnPct > 0 && x.monthlyChurnPct <= 100)) return { ok: false, reason: 'Monthly churn must be above 0% and at most 100%.' };
  if (!(x.annualDiscountPct >= 0 && x.annualDiscountPct <= 100)) return { ok: false, reason: 'Discount rate must be from 0% to 100%.' };
  if (!Number.isInteger(x.horizonMonths) || x.horizonMonths < 1 || x.horizonMonths > 240) {
    return { ok: false, reason: 'Horizon must be a whole number of months from 1 to 240.' };
  }
  return { ok: true };
}

/** Monthly rate equivalent to an annual rate: (1 + R)^(1/12) − 1. */
export function monthlyRate(annualPct: number): number {
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

/** Serving cost in month t (t starts at 1), after the annual decline compounds monthly. */
export function servingCostAt(x: UnitEconInputs, month: number): number {
  return x.monthlyServingCost * (1 - x.servingCostDeclinePct / 100) ** ((month - 1) / 12);
}

/** Net recurring revenue per month after the platform fee. */
export function netMonthlyRevenue(x: UnitEconInputs): number {
  return x.monthlyPrice * (1 - x.platformFeePct / 100);
}

export interface MonthRow {
  month: number;
  /** Probability the account is still active in this month. */
  survival: number;
  contribution: number;
  /** Expected (survival-weighted) contribution this month, undiscounted. */
  expectedContribution: number;
  /** Cumulative expected cash from the account, starting at upfront contribution − CAC. */
  cumulativeCash: number;
}

export interface UnitEconResult {
  upfrontContribution: number;
  /** Month-1 recurring contribution per account. */
  recurringContribution: number;
  /** Month-1 recurring gross margin, as a fraction of net recurring revenue (null when there is no recurring revenue). */
  recurringGrossMargin: number | null;
  /** Gross margin on everything charged over the expected life, undiscounted. */
  blendedGrossMargin: number | null;
  /** Expected customer life in months, 1 / churn (uncapped). */
  expectedLifetimeMonths: number;
  ltv: number;
  ltvToCac: number;
  /** Months until cumulative expected contribution covers CAC; 0 when the upfront margin covers it; null if never within the horizon. */
  cacPaybackMonths: number | null;
  /** CAC ÷ month-1 recurring contribution, ignoring churn and upfront margin: the quick "payback" quoted in SaaS decks. */
  simplePaybackMonths: number | null;
  /** Months for the customer to earn back the upfront price; null when value is not modelled or never covers the fee. */
  customerPaybackMonths: number | null;
  /** Share of customer value the vendor charges over the expected life (null when value is not modelled). */
  valueCapture: number | null;
  months: MonthRow[];
}

/** Discounted LTV with churn, the closed form for a constant contribution c and infinite horizon: c × d / (1 − s × d). */
export function perpetuityLtv(contribution: number, monthlyChurn: number, monthlyDiscount: number): number {
  const s = 1 - monthlyChurn;
  const d = 1 / (1 + monthlyDiscount);
  return (contribution * d) / (1 - s * d);
}

export function analyzeUnitEconomics(x: UnitEconInputs): UnitEconResult {
  const churn = x.monthlyChurnPct / 100;
  const rm = monthlyRate(x.annualDiscountPct);
  const netRev = netMonthlyRevenue(x);
  const upfrontContribution = x.upfrontPrice - x.upfrontCogs;
  const recurringContribution = netRev - x.monthlyServingCost;

  const months: MonthRow[] = [];
  let ltvRecurring = 0;
  let cumulative = upfrontContribution - x.cac;
  let payback: number | null = cumulative >= 0 ? 0 : null;
  let lifeRevenue = x.upfrontPrice;
  let lifeCost = x.upfrontCogs;

  for (let t = 1; t <= x.horizonMonths; t += 1) {
    const survival = (1 - churn) ** (t - 1);
    const contribution = netRev - servingCostAt(x, t);
    const expected = survival * contribution;
    ltvRecurring += expected / (1 + rm) ** t;
    const before = cumulative;
    cumulative += expected;
    lifeRevenue += survival * x.monthlyPrice;
    lifeCost += survival * (x.monthlyPrice - netRev + servingCostAt(x, t));
    if (payback === null && cumulative >= 0 && expected > 0) {
      // Interpolate inside the month so payback reads as, for example, 14.3 months.
      payback = t - 1 + -before / expected;
    }
    months.push({ month: t, survival, contribution, expectedContribution: expected, cumulativeCash: cumulative });
  }

  const ltv = upfrontContribution + ltvRecurring;
  const customerNet = x.customerMonthlyValue - x.monthlyPrice;
  const customerPaybackMonths =
    x.customerMonthlyValue <= 0 || customerNet <= 0 ? null : x.upfrontPrice / customerNet;

  const expectedLifetimeMonths = 1 / churn;
  const lifeForValue = Math.min(expectedLifetimeMonths, x.horizonMonths);
  const charged = x.upfrontPrice + x.monthlyPrice * lifeForValue;
  const valueCapture = x.customerMonthlyValue > 0 ? charged / (x.customerMonthlyValue * lifeForValue) : null;

  return {
    upfrontContribution,
    recurringContribution,
    recurringGrossMargin: netRev > 0 ? recurringContribution / netRev : null,
    blendedGrossMargin: lifeRevenue > 0 ? (lifeRevenue - lifeCost) / lifeRevenue : null,
    expectedLifetimeMonths,
    ltv,
    ltvToCac: x.cac > 0 ? ltv / x.cac : Number.POSITIVE_INFINITY,
    cacPaybackMonths: payback,
    simplePaybackMonths: recurringContribution > 0 ? x.cac / recurringContribution : null,
    customerPaybackMonths,
    valueCapture,
    months,
  };
}

// ---------------------------------------------------------------------------------------------
// Sensitivity (tornado): which driver moves LTV / CAC the most?
// ---------------------------------------------------------------------------------------------

export type Driver = 'monthlyPrice' | 'upfrontPrice' | 'upfrontCogs' | 'monthlyServingCost' | 'cac' | 'monthlyChurnPct';

export const DRIVER_LABELS: Record<Driver, string> = {
  monthlyPrice: 'Monthly price',
  upfrontPrice: 'Upfront price',
  upfrontCogs: 'Upfront COGS',
  monthlyServingCost: 'Serving cost',
  cac: 'CAC',
  monthlyChurnPct: 'Monthly churn',
};

export interface SensitivityRow {
  driver: Driver;
  label: string;
  /** LTV / CAC with the driver cut by `swing`. */
  low: number;
  /** LTV / CAC with the driver raised by `swing`. */
  high: number;
  /** |high − low|, used to rank drivers. */
  range: number;
}

/** Moves each driver by ± swing (0.2 = 20%) and reports LTV / CAC, widest range first. Drivers at zero are skipped. */
export function sensitivity(x: UnitEconInputs, swing = 0.2): SensitivityRow[] {
  const drivers = Object.keys(DRIVER_LABELS) as Driver[];
  const rows: SensitivityRow[] = [];
  for (const driver of drivers) {
    const base = x[driver];
    if (base <= 0) continue;
    const at = (factor: number) => {
      let v = base * factor;
      if (driver === 'monthlyChurnPct') v = Math.min(100, Math.max(0.01, v));
      const r = analyzeUnitEconomics({ ...x, [driver]: v });
      return r.ltvToCac;
    };
    const low = at(1 - swing);
    const high = at(1 + swing);
    rows.push({ driver, label: DRIVER_LABELS[driver], low, high, range: Math.abs(high - low) });
  }
  return rows.sort((a, b) => b.range - a.range);
}

/** Price per month at which LTV / CAC reaches a target, found by bisection; null if no price up to 100× today reaches it. */
export function priceForTargetLtvCac(x: UnitEconInputs, target: number): number | null {
  const ratio = (p: number) => analyzeUnitEconomics({ ...x, monthlyPrice: p }).ltvToCac;
  let lo = 0;
  let hi = Math.max(1, x.monthlyPrice) * 100;
  if (ratio(hi) < target) return null;
  if (ratio(lo) >= target) return 0;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (ratio(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ---------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------

export const PRESETS: readonly UnitEconPreset[] = [
  {
    id: 'carbon-laserweeder',
    label: 'Carbon Robotics LaserWeeder',
    kind: 'hardware-robotics',
    accountNoun: 'robot',
    blurb:
      'Robotics-as-a-product: a large upfront sale that bundles three years of service, sold against hand-weeding labor. The farm earns its money back in about three years, which is the number the founder pitched.',
    sourcing:
      'From the early seed-pitch slide in the Mikesell talk: unit COGS about $35k, price about $120k including 3 years of service, farm payback about 3 years. Field-service cost, CAC, churn, a 5-year machine life and the discount rate are illustrative.',
    inputs: {
      upfrontPrice: 120_000,
      upfrontCogs: 35_000,
      monthlyPrice: 0,
      platformFeePct: 0,
      monthlyServingCost: 450,
      servingCostDeclinePct: 0,
      cac: 18_000,
      monthlyChurnPct: 1,
      annualDiscountPct: 12,
      horizonMonths: 60,
      customerMonthlyValue: 120_000 / 36,
    },
  },
  {
    id: 'pranascan-b2c',
    label: 'PranaScan consumer subscription',
    kind: 'consumer-app',
    accountNoun: 'subscriber',
    blurb:
      'A face-video vitals app sold through the app stores. Inference runs mostly on the phone, so serving cost is tiny, but the store fee and high consumer churn decide whether paid acquisition can ever pay back.',
    sourcing:
      'All figures illustrative. The 15% platform fee reflects the app-store small-business and subscription tiers; check current store terms before relying on it.',
    inputs: {
      upfrontPrice: 0,
      upfrontCogs: 0,
      monthlyPrice: 7.99,
      platformFeePct: 15,
      monthlyServingCost: 0.35,
      servingCostDeclinePct: 30,
      cac: 24,
      monthlyChurnPct: 9,
      annualDiscountPct: 12,
      horizonMonths: 60,
      customerMonthlyValue: 0,
    },
  },
  {
    id: 'pranascan-b2b',
    label: 'PranaScan B2B clinic license',
    kind: 'b2b-saas',
    accountNoun: 'clinic site',
    blurb:
      'The same model licensed per clinic or employer-wellness site, with a paid onboarding. Lower churn and a customer-side ROI story change the math far more than the price does.',
    sourcing: 'All figures illustrative: site price, onboarding fee and cost, serving cost, CAC, churn and staff time saved per site.',
    inputs: {
      upfrontPrice: 2_500,
      upfrontCogs: 1_400,
      monthlyPrice: 900,
      platformFeePct: 3,
      monthlyServingCost: 70,
      servingCostDeclinePct: 25,
      cac: 7_500,
      monthlyChurnPct: 1.5,
      annualDiscountPct: 12,
      horizonMonths: 60,
      customerMonthlyValue: 3_000,
    },
  },
  {
    id: 'enterprise-ai-saas',
    label: 'Enterprise AI SaaS contract',
    kind: 'b2b-saas',
    accountNoun: 'enterprise account',
    blurb:
      'A $60k-a-year AI copilot with heavy inference. Gross margin starts near 70% instead of the classic 80%+, and the yearly fall in inference prices is what pulls it back up.',
    sourcing:
      'All figures illustrative. The 70% starting gross margin reflects commonly cited AI-native SaaS margins; LTV/CAC above 3 and payback under 18 months are heuristics, not rules.',
    inputs: {
      upfrontPrice: 12_000,
      upfrontCogs: 9_000,
      monthlyPrice: 5_000,
      platformFeePct: 0,
      monthlyServingCost: 1_500,
      servingCostDeclinePct: 30,
      cac: 55_000,
      monthlyChurnPct: 1,
      annualDiscountPct: 12,
      horizonMonths: 60,
      customerMonthlyValue: 18_000,
    },
  },
];
