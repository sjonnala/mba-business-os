import { describe, expect, it } from 'vitest';
import {
  BALANCE_TOLERANCE,
  DEFAULT_INPUTS,
  INPUT_SPECS,
  fcfBridge,
  randomInputs,
  runModel,
  seededRandom,
} from '../lib/threeStatement';

describe('3-statement linker engine', () => {
  it('balances the default case in every year, Year 0 included', () => {
    const result = runModel(DEFAULT_INPUTS);
    expect(result.years).toHaveLength(4);
    for (const y of result.years) expect(Math.abs(y.totalAssets - (y.totalLiabilities + y.totalEquity))).toBeLessThan(BALANCE_TOLERANCE);
    expect(result.balanced).toBe(true);
  });

  it('keeps Assets == Liabilities + Equity across 100 random slider states', () => {
    const rand = seededRandom(20261126);
    for (let i = 0; i < 100; i += 1) {
      const inputs = randomInputs(rand);
      const result = runModel(inputs);
      for (const y of result.years) {
        expect(Math.abs(y.balanceGap), JSON.stringify(inputs)).toBeLessThan(BALANCE_TOLERANCE);
      }
      expect(result.balanced).toBe(true);
    }
  });

  it('derives cash from the cash flow statement and never lets it fall below minimum', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 100; i += 1) {
      const result = runModel(randomInputs(rand));
      for (let t = 1; t < result.years.length; t += 1) {
        const prev = result.years[t - 1];
        const cur = result.years[t];
        if (!prev || !cur) throw new Error('missing year');
        expect(cur.cash - prev.cash).toBeCloseTo(cur.cfo + cur.cfi + cur.cff, 9);
        expect(cur.cash).toBeGreaterThanOrEqual(5 - 1e-9);
        expect(cur.revolver).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('builds an FCF bridge that sums to free cash flow', () => {
    for (const y of runModel(DEFAULT_INPUTS).years.slice(1)) {
      const steps = fcfBridge(y);
      const sum = steps.filter((s) => s.kind !== 'total').reduce((a, s) => a + s.value, 0);
      expect(sum).toBeCloseTo(y.fcf, 9);
    }
  });

  it('clamps out-of-range inputs into the slider ranges', () => {
    const result = runModel({ ...DEFAULT_INPUTS, usefulLifeYears: 0, dso: -50, grossMarginPct: Number.NaN });
    expect(result.inputs.usefulLifeYears).toBe(2);
    expect(result.inputs.dso).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it('generates random states inside every slider range', () => {
    const rand = seededRandom(1);
    for (let i = 0; i < 50; i += 1) {
      const inputs = randomInputs(rand);
      for (const s of INPUT_SPECS) {
        expect(inputs[s.key]).toBeGreaterThanOrEqual(s.min);
        expect(inputs[s.key]).toBeLessThanOrEqual(s.max);
      }
    }
  });

  it('moves cash the right way when working capital days change', () => {
    const base = runModel(DEFAULT_INPUTS).years[3];
    const slowCollect = runModel({ ...DEFAULT_INPUTS, dso: 90 }).years[3];
    if (!base || !slowCollect) throw new Error('missing year');
    expect(slowCollect.cfo).toBeLessThan(base.cfo);
  });
});
