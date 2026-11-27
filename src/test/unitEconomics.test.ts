import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  analyzeUnitEconomics,
  monthlyRate,
  netMonthlyRevenue,
  perpetuityLtv,
  priceForTargetLtvCac,
  sensitivity,
  servingCostAt,
  validateInputs,
  type UnitEconInputs,
} from '../lib/unitEconomics';
import { seededRandom } from '../lib/opsBottleneck';

/** A plain SaaS account: $100 a month, $20 to serve, $800 CAC, 2% churn, no discounting. */
const saas = (patch: Partial<UnitEconInputs> = {}): UnitEconInputs => ({
  upfrontPrice: 0,
  upfrontCogs: 0,
  monthlyPrice: 100,
  platformFeePct: 0,
  monthlyServingCost: 20,
  servingCostDeclinePct: 0,
  cac: 800,
  monthlyChurnPct: 2,
  annualDiscountPct: 0,
  horizonMonths: 240,
  customerMonthlyValue: 0,
  ...patch,
});

const preset = (id: string) => {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
};

describe('unit economics basics', () => {
  it('computes contribution, margin and the simple payback quoted in SaaS decks', () => {
    const r = analyzeUnitEconomics(saas());
    expect(r.recurringContribution).toBe(80);
    expect(r.recurringGrossMargin).toBeCloseTo(0.8, 12);
    expect(r.simplePaybackMonths).toBeCloseTo(10, 12);
    expect(r.expectedLifetimeMonths).toBeCloseTo(50, 12);
  });

  it('matches the textbook LTV = margin ÷ churn when undiscounted over a long horizon', () => {
    const r = analyzeUnitEconomics(saas());
    // 80 / 0.02 = 4,000, less the tail beyond 240 months: 4,000 × 0.98^240 ≈ 31.
    expect(r.ltv).toBeCloseTo(4000 * (1 - 0.98 ** 240), 6);
    expect(r.ltvToCac).toBeCloseTo(r.ltv / 800, 12);
  });

  it('matches the discounted perpetuity closed form', () => {
    const x = saas({ annualDiscountPct: 12 });
    const r = analyzeUnitEconomics(x);
    const closed = perpetuityLtv(80, 0.02, monthlyRate(12));
    const tail = (0.98 / (1 + monthlyRate(12))) ** 240;
    expect(r.ltv).toBeCloseTo(closed * (1 - tail), 6);
    expect(monthlyRate(12)).toBeCloseTo(1.12 ** (1 / 12) - 1, 14);
  });

  it('makes churn-adjusted payback slower than the simple payback', () => {
    const r = analyzeUnitEconomics(saas());
    expect(r.cacPaybackMonths).not.toBeNull();
    // Solve 80 × (1 − 0.98^n) / 0.02 = 800 → n = ln(0.8) / ln(0.98) ≈ 11.05 months.
    expect(r.cacPaybackMonths ?? 0).toBeGreaterThan(10);
    expect(r.cacPaybackMonths ?? 0).toBeCloseTo(Math.log(0.8) / Math.log(0.98), 0);
  });

  it('applies the platform fee before margin', () => {
    const x = saas({ platformFeePct: 30 });
    expect(netMonthlyRevenue(x)).toBeCloseTo(70, 12);
    expect(analyzeUnitEconomics(x).recurringContribution).toBeCloseTo(50, 12);
  });

  it('lets falling inference cost raise LTV, month by month', () => {
    const x = saas({ servingCostDeclinePct: 50 });
    expect(servingCostAt(x, 1)).toBeCloseTo(20, 12);
    expect(servingCostAt(x, 13)).toBeCloseTo(10, 12);
    expect(analyzeUnitEconomics(x).ltv).toBeGreaterThan(analyzeUnitEconomics(saas()).ltv);
  });

  it('pays back CAC at month 0 when the upfront margin covers it', () => {
    const r = analyzeUnitEconomics(saas({ upfrontPrice: 1500, upfrontCogs: 500 }));
    expect(r.upfrontContribution).toBe(1000);
    expect(r.cacPaybackMonths).toBe(0);
  });

  it('never pays back when recurring contribution is negative and there is no upfront margin', () => {
    const r = analyzeUnitEconomics(saas({ monthlyServingCost: 120 }));
    expect(r.recurringContribution).toBe(-20);
    expect(r.cacPaybackMonths).toBeNull();
    expect(r.simplePaybackMonths).toBeNull();
    expect(r.ltv).toBeLessThan(0);
  });

  it('keeps cumulative cash consistent with the month rows', () => {
    const x = saas({ upfrontPrice: 300, upfrontCogs: 100, horizonMonths: 24 });
    const r = analyzeUnitEconomics(x);
    expect(r.months).toHaveLength(24);
    const sum = r.months.reduce((s, m) => s + m.expectedContribution, 0);
    expect(r.months[23]?.cumulativeCash).toBeCloseTo(200 - 800 + sum, 8);
    expect(r.months[0]?.survival).toBe(1);
  });
});

describe('customer payback and value capture', () => {
  it('computes customer payback as upfront price over net monthly benefit', () => {
    const r = analyzeUnitEconomics(saas({ upfrontPrice: 12_000, monthlyPrice: 500, customerMonthlyValue: 1500 }));
    expect(r.customerPaybackMonths).toBeCloseTo(12, 12);
  });

  it('returns null customer payback when value is not modelled or does not cover the fee', () => {
    expect(analyzeUnitEconomics(saas()).customerPaybackMonths).toBeNull();
    expect(analyzeUnitEconomics(saas({ customerMonthlyValue: 90 })).customerPaybackMonths).toBeNull();
  });

  it('reports value capture as charges over value created across the expected life', () => {
    const r = analyzeUnitEconomics(saas({ customerMonthlyValue: 400 }));
    expect(r.valueCapture).toBeCloseTo(0.25, 12);
  });
});

describe('presets', () => {
  it('all validate and produce finite results', () => {
    for (const p of PRESETS) {
      expect(validateInputs(p.inputs), p.id).toEqual({ ok: true });
      const r = analyzeUnitEconomics(p.inputs);
      expect(Number.isFinite(r.ltv), p.id).toBe(true);
      expect(Number.isFinite(r.ltvToCac), p.id).toBe(true);
      expect(p.sourcing.length, p.id).toBeGreaterThan(40);
    }
    expect(PRESETS.map((p) => p.id)).toEqual(['carbon-laserweeder', 'pranascan-b2c', 'pranascan-b2b', 'enterprise-ai-saas']);
  });

  it('reproduces the Carbon Robotics seed-pitch math: about 71% unit margin and a 3-year farm payback', () => {
    const x = preset('carbon-laserweeder').inputs;
    const r = analyzeUnitEconomics(x);
    expect(r.upfrontContribution).toBe(85_000);
    expect(r.upfrontContribution / x.upfrontPrice).toBeCloseTo(0.708, 3);
    expect(r.customerPaybackMonths).toBeCloseTo(36, 9);
    // Hardware margin funds the CAC on day one.
    expect(r.cacPaybackMonths).toBe(0);
  });

  it('puts the consumer app below the 3x LTV / CAC heuristic and the B2B license above it', () => {
    const b2c = analyzeUnitEconomics(preset('pranascan-b2c').inputs);
    const b2b = analyzeUnitEconomics(preset('pranascan-b2b').inputs);
    expect(b2c.ltvToCac).toBeLessThan(3);
    expect(b2b.ltvToCac).toBeGreaterThan(3);
    // Cutting consumer churn by 20% clears the bar; the 95% gross margin cannot fix churn on its own.
    const churnRow = sensitivity(preset('pranascan-b2c').inputs).find((r) => r.driver === 'monthlyChurnPct');
    expect(churnRow?.low ?? 0).toBeGreaterThan(3);
    expect(b2c.recurringGrossMargin ?? 0).toBeGreaterThan(0.9);
  });

  it('shows bundled service makes Carbon churn-insensitive: service cost, not lost revenue, leaves with a churned robot', () => {
    const r = analyzeUnitEconomics(preset('carbon-laserweeder').inputs);
    expect(r.recurringContribution).toBeLessThan(0);
    expect(r.ltvToCac).toBeGreaterThan(3);
  });

  it('starts the enterprise AI preset near a 70% recurring margin', () => {
    const r = analyzeUnitEconomics(preset('enterprise-ai-saas').inputs);
    expect(r.recurringGrossMargin).toBeCloseTo(0.7, 12);
    expect(r.blendedGrossMargin ?? 0).toBeGreaterThan(0.7);
  });
});

describe('sensitivity and pricing', () => {
  it('moves each driver the right way', () => {
    const rows = sensitivity(saas({ upfrontPrice: 200, upfrontCogs: 100 }));
    const by = (d: string) => rows.find((r) => r.driver === d);
    expect((by('monthlyPrice')?.high ?? 0) > (by('monthlyPrice')?.low ?? 0)).toBe(true);
    expect((by('cac')?.high ?? 0) < (by('cac')?.low ?? 0)).toBe(true);
    expect((by('monthlyChurnPct')?.high ?? 0) < (by('monthlyChurnPct')?.low ?? 0)).toBe(true);
    expect((by('monthlyServingCost')?.high ?? 0) < (by('monthlyServingCost')?.low ?? 0)).toBe(true);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1]?.range ?? 0).toBeGreaterThanOrEqual(rows[i]?.range ?? 0);
  });

  it('finds the price that hits a target LTV / CAC', () => {
    const x = saas();
    const p = priceForTargetLtvCac(x, 3);
    expect(p).not.toBeNull();
    expect(analyzeUnitEconomics({ ...x, monthlyPrice: p ?? 0 }).ltvToCac).toBeCloseTo(3, 4);
    expect(p ?? 0).toBeLessThan(100);
  });
});

describe('validation and invariants', () => {
  it('rejects impossible inputs', () => {
    expect(validateInputs(saas({ monthlyChurnPct: 0 })).ok).toBe(false);
    expect(validateInputs(saas({ platformFeePct: 100 })).ok).toBe(false);
    expect(validateInputs(saas({ cac: -1 })).ok).toBe(false);
    expect(validateInputs(saas({ monthlyPrice: 0 })).ok).toBe(false);
    expect(validateInputs(saas({ horizonMonths: 2.5 })).ok).toBe(false);
  });

  it('keeps LTV monotonic in price and churn across 200 seeded random accounts', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const x = saas({
        upfrontPrice: Math.round(rand() * 5000),
        upfrontCogs: Math.round(rand() * 3000),
        monthlyPrice: 10 + rand() * 2000,
        monthlyServingCost: rand() * 500,
        servingCostDeclinePct: rand() * 60,
        cac: 100 + rand() * 20_000,
        monthlyChurnPct: 0.5 + rand() * 15,
        annualDiscountPct: rand() * 25,
        horizonMonths: 12 + Math.floor(rand() * 108),
      });
      expect(validateInputs(x).ok).toBe(true);
      const base = analyzeUnitEconomics(x);
      expect(analyzeUnitEconomics({ ...x, monthlyPrice: x.monthlyPrice * 1.1 }).ltv).toBeGreaterThan(base.ltv);
      const moreChurn = analyzeUnitEconomics({ ...x, monthlyChurnPct: x.monthlyChurnPct * 1.5 }).ltv;
      if (base.recurringContribution > 0) expect(moreChurn).toBeLessThan(base.ltv);
      if (base.cacPaybackMonths !== null && base.cacPaybackMonths > 0) {
        const m = base.months[Math.ceil(base.cacPaybackMonths) - 1];
        expect(m?.cumulativeCash ?? -1).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
});
