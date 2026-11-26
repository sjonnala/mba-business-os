import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DCF_INPUTS,
  capitalCost,
  costOfEquity,
  dupontRoic,
  forecastFcff,
  gordonTerminalValue,
  releverBeta,
  runDcf,
  sensitivityGrid,
  valueDcf,
  valueDriver,
  wacc,
} from '../lib/valuation';

describe('CAPM, beta relevering and WACC', () => {
  it('reproduces the Hargrove M&M problem: leverage raises r_E but leaves WACC at 27.65%', () => {
    const unlevered = costOfEquity(0.05, 4.53, 0.05);
    expect(unlevered).toBeCloseTo(0.2765, 6);
    const betaE = releverBeta({ assetBeta: 4.53, debtBeta: 0.38, debtToEquity: 0.33 / 0.67 });
    expect(betaE).toBeCloseTo(6.574, 3);
    const rE = costOfEquity(0.05, betaE, 0.05);
    const rD = costOfEquity(0.05, 0.38, 0.05);
    expect(rD).toBeCloseTo(0.069, 6);
    expect(rE).toBeCloseTo(0.3787, 3);
    expect(wacc({ costOfEquity: rE, preTaxCostOfDebt: rD, debtWeight: 0.33, taxRate: 0 })).toBeCloseTo(unlevered, 10);
  });

  it('uses Hamada relevering with taxes for the studio defaults', () => {
    const c = capitalCost(DEFAULT_DCF_INPUTS);
    expect(c.debtToEquity).toBeCloseTo(0.25, 10);
    expect(c.equityBeta).toBeCloseTo(1.1 * (1 + 0.79 * 0.25), 10);
    expect(c.wacc).toBeCloseTo(0.8 * c.costOfEquity + 0.2 * 0.065 * 0.79, 10);
    expect(c.wacc).toBeGreaterThan(0.1);
    expect(c.wacc).toBeLessThan(0.11);
  });

  it('rejects impossible weights', () => {
    expect(() => wacc({ costOfEquity: 0.1, preTaxCostOfDebt: 0.05, debtWeight: 1, taxRate: 0.2 })).toThrow(RangeError);
    expect(() => releverBeta({ assetBeta: 1, debtToEquity: -0.1 })).toThrow(RangeError);
  });
});

describe('FCFF and DCF', () => {
  it('computes FCFF = EBIT(1 − t) + D&A − CapEx − ΔNWC', () => {
    const [y1] = forecastFcff(DEFAULT_DCF_INPUTS);
    if (!y1) throw new Error('no year 1');
    expect(y1.revenue).toBeCloseTo(560, 10);
    expect(y1.nopat).toBeCloseTo(112 * 0.79, 10);
    expect(y1.changeInNwc).toBeCloseTo(6, 10);
    expect(y1.fcff).toBeCloseTo(88.48 + 22.4 - 33.6 - 6, 10);
  });

  it('values the terminal value with Gordon growth (FCFF 100, WACC 9%, g 3% → 1,716.67)', () => {
    const tv = gordonTerminalValue(100, 0.09, 0.03);
    expect(tv.ok && tv.value).toBeCloseTo(1716.6667, 3);
  });

  it('adds explicit PVs and the discounted terminal value, then bridges to equity', () => {
    const { capital, result } = runDcf(DEFAULT_DCF_INPUTS);
    if (!result.ok) throw new Error(result.reason);
    const sumPv = result.years.reduce((s, y) => s + y.fcff / (1 + capital.wacc) ** y.year, 0);
    expect(result.pvExplicit).toBeCloseTo(sumPv, 8);
    expect(result.pvTerminal).toBeCloseTo(result.terminalValue / (1 + capital.wacc) ** 5, 8);
    expect(result.enterpriseValue).toBeCloseTo(result.pvExplicit + result.pvTerminal, 8);
    expect(result.equityValue).toBeCloseTo(result.enterpriseValue - DEFAULT_DCF_INPUTS.netDebt, 8);
    expect(result.valuePerShare).toBeCloseTo(result.equityValue / DEFAULT_DCF_INPUTS.sharesOutstanding, 8);
    expect(result.terminalShare).toBeGreaterThan(0.5);
    expect(result.terminalShare).toBeLessThan(1);
  });
});

describe('WACC > g guard', () => {
  it('refuses a terminal value when WACC equals or is below g', () => {
    expect(gordonTerminalValue(100, 0.03, 0.03).ok).toBe(false);
    const bad = gordonTerminalValue(100, 0.02, 0.1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/must exceed terminal growth/);
  });

  it('makes the whole DCF fail loudly instead of returning a negative value', () => {
    const r = valueDcf(DEFAULT_DCF_INPUTS, 0.05, 0.06);
    expect(r.ok).toBe(false);
  });

  it('blanks only the invalid cells of the 5 × 5 grid', () => {
    const grid = sensitivityGrid(DEFAULT_DCF_INPUTS, 0.07, 0.065);
    expect(grid.rows).toHaveLength(5);
    for (const row of grid.rows) expect(row).toHaveLength(5);
    const cells = grid.rows.flat();
    expect(grid.invalidCount).toBeGreaterThan(0);
    expect(grid.invalidCount).toBeLessThan(25);
    for (const c of cells) {
      if (c.wacc > c.growth) expect(c.valuePerShare).not.toBeNull();
      else expect(c.valuePerShare).toBeNull();
      if (c.valuePerShare !== null) expect(Number.isFinite(c.valuePerShare)).toBe(true);
    }
  });
});

describe('5 × 5 sensitivity grid', () => {
  it('centers on the base case and moves the right way', () => {
    const { capital, result } = runDcf(DEFAULT_DCF_INPUTS);
    if (!result.ok) throw new Error(result.reason);
    const grid = sensitivityGrid(DEFAULT_DCF_INPUTS, capital.wacc, 0.03);
    expect(grid.invalidCount).toBe(0);
    expect(grid.rows[2]?.[2]?.valuePerShare).toBeCloseTo(result.valuePerShare, 8);
    for (let i = 0; i < 5; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const here = grid.rows[i]?.[j]?.valuePerShare ?? 0;
        const higherG = grid.rows[i]?.[j + 1]?.valuePerShare ?? 0;
        const higherW = grid.rows[j + 1]?.[i]?.valuePerShare ?? 0;
        const sameColLowerW = grid.rows[j]?.[i]?.valuePerShare ?? 0;
        expect(higherG).toBeGreaterThan(here);
        expect(higherW).toBeLessThan(sameColLowerW);
      }
    }
  });
});

describe('DuPont ROIC and the value driver formula', () => {
  it('splits ROIC into NOPAT margin × capital turnover and prices the spread', () => {
    const r = dupontRoic({ revenue: 1000, ebit: 200, taxRate: 0.21, investedCapital: 800, wacc: 0.1 });
    expect(r.nopatMargin).toBeCloseTo(0.158, 10);
    expect(r.capitalTurnover).toBeCloseTo(1.25, 10);
    expect(r.roic).toBeCloseTo(0.1975, 10);
    expect(r.eva).toBeCloseTo((0.1975 - 0.1) * 800, 8);
  });

  it('shows growth creates value only when RONIC > WACC (1,500 / 1,000 / 750)', () => {
    const at = (ronic: number) => {
      const v = valueDriver(100, 0.05, ronic, 0.1);
      return v.ok ? v.value : Number.NaN;
    };
    expect(at(0.2)).toBeCloseTo(1500, 8);
    expect(at(0.1)).toBeCloseTo(1000, 8);
    expect(at(0.08)).toBeCloseTo(750, 8);
    expect(valueDriver(100, 0.1, 0.2, 0.1).ok).toBe(false);
  });
});
