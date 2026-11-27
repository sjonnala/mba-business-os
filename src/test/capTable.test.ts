import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXIT,
  DEFAULT_ROUND,
  convertNote,
  runRound,
  toBasisPoints,
  waterfall,
  type Holder,
  type RoundInput,
} from '../lib/capTable';

/** Small deterministic PRNG so property tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0);

describe('ownership always sums to exactly 100.00%', () => {
  it('allocates basis points by largest remainder', () => {
    expect(toBasisPoints([1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(toBasisPoints([0, 0])).toEqual([0, 0]);
  });

  it('holds for 500 random share splits', () => {
    const rand = mulberry32(42);
    for (let n = 0; n < 500; n += 1) {
      const shares = Array.from({ length: 2 + Math.floor(rand() * 6) }, () => Math.floor(rand() * 10_000_000) + 1);
      expect(sum(toBasisPoints(shares))).toBe(10000);
    }
  });

  it('holds for 300 random SAFE + Series A rounds, before and after', () => {
    const rand = mulberry32(7);
    let checked = 0;
    for (let n = 0; n < 300; n += 1) {
      const input: RoundInput = {
        founderShares: 1_000_000 + Math.floor(rand() * 9_000_000),
        existingPoolShares: Math.floor(rand() * 2_000_000),
        safes: Array.from({ length: Math.floor(rand() * 3) }, (_, i) => ({
          label: `SAFE ${i + 1}`,
          investment: 100_000 + Math.floor(rand() * 2_000_000),
          postMoneyCap: 5_000_000 + Math.floor(rand() * 30_000_000),
          discountPct: Math.floor(rand() * 30),
        })),
        preMoney: 5_000_000 + Math.floor(rand() * 60_000_000),
        investment: Math.floor(rand() * 20_000_000),
        targetPoolPct: Math.floor(rand() * 20),
      };
      const r = runRound(input);
      if (!r.ok) continue;
      checked += 1;
      expect(sum(r.before.map((x) => x.bps))).toBe(10000);
      expect(sum(r.after.map((x) => x.bps))).toBe(10000);
      expect(sum(r.after.map((x) => x.fraction))).toBeCloseTo(1, 12);
    }
    expect(checked).toBeGreaterThan(250);
  });
});

describe('priced round with the option pool shuffle', () => {
  it('reproduces the VCIC example: $5M pre at $1.00 → founders 36%, pool 14%, investor 50%', () => {
    const r = runRound({ founderShares: 3_600_000, existingPoolShares: 0, safes: [], preMoney: 5_000_000, investment: 5_000_000, targetPoolPct: 14 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.pricePerShare).toBeCloseTo(1, 10);
    expect(r.newPoolShares).toBe(1_400_000);
    expect(r.seriesAShares).toBe(5_000_000);
    expect(r.after.map((x) => x.bps)).toEqual([3600, 1400, 5000]);
    expect(r.effectivePreMoney).toBeCloseTo(3_600_000, 4);
  });

  it('reproduces the ENTRE 542 Cap Table Template seed: $8M pre + $2M → 64% / 16% / 20%', () => {
    const r = runRound({ founderShares: 800_000, existingPoolShares: 200_000, safes: [], preMoney: 8_000_000, investment: 2_000_000, targetPoolPct: 16 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.newPoolShares).toBe(0);
    expect(r.pricePerShare).toBeCloseTo(8, 10);
    expect(r.seriesAShares).toBe(250_000);
    expect(r.after.map((x) => x.bps)).toEqual([6400, 1600, 2000]);
  });

  it('refuses a pool bigger than the pre-money slice', () => {
    expect(runRound({ ...DEFAULT_ROUND, targetPoolPct: 80 }).ok).toBe(false);
  });
});

describe('SAFEs and convertible notes', () => {
  it('converts the Cap Table Template note at $4.00 for 125,000 shares (discount beats the $6.40 cap price)', () => {
    const c = convertNote({ investment: 500_000, cap: 8_000_000, capitalizationShares: 1_250_000, discountPct: 20, roundPrice: 5 });
    expect(c.capPrice).toBeCloseTo(6.4, 10);
    expect(c.price).toBeCloseTo(4, 10);
    expect(c.shares).toBe(125_000);
    expect(c.usedDiscount).toBe(true);
  });

  it('gives a post-money SAFE exactly investment / cap of the pre-round capitalization', () => {
    const r = runRound({
      founderShares: 9_000_000,
      existingPoolShares: 0,
      safes: [{ label: 'SAFE', investment: 1_000_000, postMoneyCap: 10_000_000, discountPct: 0 }],
      preMoney: 10_000_000,
      investment: 0,
      targetPoolPct: 0,
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.safes[0]?.shares).toBe(1_000_000);
    expect(r.after.find((x) => x.label === 'SAFE')?.bps).toBe(1000);
  });

  it('switches a SAFE to its discount when the round prices below the cap', () => {
    const r = runRound({
      founderShares: 9_000_000,
      existingPoolShares: 1_000_000,
      safes: [{ label: 'SAFE', investment: 1_000_000, postMoneyCap: 20_000_000, discountPct: 20 }],
      preMoney: 12_000_000,
      investment: 4_000_000,
      targetPoolPct: 10,
    });
    if (!r.ok) throw new Error(r.reason);
    const safe = r.safes[0];
    expect(safe?.usedDiscount).toBe(true);
    expect(safe?.price).toBeLessThan(safe?.capPrice ?? 0);
    expect(safe?.price).toBeCloseTo(r.pricePerShare * 0.8, 3);
  });

  it('runs the default illustrative path cleanly', () => {
    const r = runRound(DEFAULT_ROUND);
    expect(r.ok).toBe(true);
  });
});

describe('1x liquidation waterfall', () => {
  const vcic: Holder[] = [
    { label: 'Founders', kind: 'common', shares: 3_600_000, invested: 0 },
    { label: 'Option pool', kind: 'pool', shares: 1_400_000, invested: 0 },
    { label: 'Series A', kind: 'preferred', shares: 5_000_000, invested: 5_000_000 },
  ];
  const amount = (ps: ReturnType<typeof waterfall>, label: string) => ps.find((p) => p.label === label)?.amount ?? Number.NaN;

  it('non-participating takes the preference at a small exit and converts at a large one', () => {
    const small = waterfall(vcic, 8_000_000, 'non-participating');
    expect(amount(small, 'Series A')).toBeCloseTo(5_000_000, 6);
    expect(amount(small, 'Founders')).toBeCloseTo(2_160_000, 6);
    const big = waterfall(vcic, 30_000_000, 'non-participating');
    expect(amount(big, 'Series A')).toBeCloseTo(15_000_000, 6);
    expect(big.find((p) => p.label === 'Series A')?.converted).toBe(true);
  });

  it('participating preferred double dips', () => {
    expect(amount(waterfall(vcic, 8_000_000, 'participating'), 'Series A')).toBeCloseTo(6_500_000, 6);
    expect(amount(waterfall(vcic, 30_000_000, 'participating'), 'Series A')).toBeCloseTo(17_500_000, 6);
  });

  it('pays only preferred when the exit is below the preference', () => {
    const r = waterfall(vcic, 3_000_000, 'non-participating');
    expect(amount(r, 'Series A')).toBeCloseTo(3_000_000, 6);
    expect(amount(r, 'Founders')).toBeCloseTo(0, 6);
  });

  it('distributes exactly the exit proceeds for random exits and both preference types', () => {
    const round = runRound(DEFAULT_ROUND);
    if (!round.ok) throw new Error(round.reason);
    const rand = mulberry32(99);
    for (let n = 0; n < 200; n += 1) {
      const exit = Math.floor(rand() * 4 * DEFAULT_EXIT);
      for (const type of ['non-participating', 'participating'] as const) {
        const paid = sum(waterfall(round.after, exit, type).map((p) => p.amount));
        expect(paid).toBeCloseTo(exit, 4);
      }
    }
  });
});
