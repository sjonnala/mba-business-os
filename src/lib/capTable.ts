/**
 * Lab #3: SAFE / Seed / Series A cap table and dilution simulator.
 *
 * Model (all figures illustrative unless a test cites a Foster exercise):
 * 1. Before the round: founders' common plus an existing option pool.
 * 2. Post-money SAFEs convert at the lower of their cap price (cap / company capitalization
 *    before new money and before the pool top-up, as in the post-money SAFE) and the round price
 *    less their discount.
 * 3. The priced round uses the option pool shuffle, so the pool top-up needed to reach the target
 *    post-money pool is created inside the pre-money, so existing holders bear it.
 * 4. Ownership is reported in integer basis points allocated by largest remainder, so the column
 *    always sums to exactly 100.00%.
 * 5. The liquidation waterfall pays every preferred holder (Series A and converted SAFEs, pari
 *    passu) a 1x preference, either non-participating (greater of preference or as-converted) or
 *    participating (preference, then pro rata with common). Options are treated as exercised common.
 */

export interface SafeInput {
  label: string;
  /** Cash invested, in $. */
  investment: number;
  /** Post-money valuation cap, in $. */
  postMoneyCap: number;
  /** Discount to the round price, in percent (0 for cap only). */
  discountPct: number;
}

export interface RoundInput {
  founderShares: number;
  existingPoolShares: number;
  safes: SafeInput[];
  /** Series A pre-money valuation, in $. */
  preMoney: number;
  /** Series A new money, in $. */
  investment: number;
  /** Target unallocated pool after the round, in percent of post-money shares. */
  targetPoolPct: number;
}

export type HolderKind = 'common' | 'pool' | 'safe' | 'preferred';

export interface Holder {
  label: string;
  kind: HolderKind;
  shares: number;
  /** Cash paid in for these shares (0 for common and pool). */
  invested: number;
}

export interface OwnershipRow extends Holder {
  /** Exact fraction of total shares. */
  fraction: number;
  /** Ownership in integer basis points; the column sums to 10,000. */
  bps: number;
}

export interface SafeConversion {
  label: string;
  capPrice: number;
  discountPrice: number;
  price: number;
  shares: number;
  usedDiscount: boolean;
}

export interface RoundResult {
  ok: true;
  pricePerShare: number;
  postMoney: number;
  preMoneyShares: number;
  postMoneyShares: number;
  newPoolShares: number;
  seriesAShares: number;
  safes: SafeConversion[];
  /** Pre-money minus the value of new pool shares and SAFE conversions, as seen by existing holders. */
  effectivePreMoney: number;
  before: OwnershipRow[];
  after: OwnershipRow[];
}

export type RoundOutcome = RoundResult | { ok: false; reason: string };

/**
 * Converts exact fractions into integer basis points that sum to exactly 10,000 using the
 * largest remainder (Hamilton) method. Ties go to the earlier row so results are deterministic.
 */
export function toBasisPoints(shares: readonly number[]): number[] {
  const total = shares.reduce((s, v) => s + v, 0);
  if (total <= 0) return shares.map(() => 0);
  const exact = shares.map((v) => (v / total) * 10000);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = 10000 - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remaining -= 1;
  }
  return out;
}

export function ownershipTable(holders: readonly Holder[]): OwnershipRow[] {
  const total = holders.reduce((s, h) => s + h.shares, 0);
  const bps = toBasisPoints(holders.map((h) => h.shares));
  return holders.map((h, i) => ({ ...h, fraction: total > 0 ? h.shares / total : 0, bps: bps[i] ?? 0 }));
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Converts a pre-money style note or SAFE: price = min(cap / capitalization, roundPrice × (1 − d)). */
export function convertNote(args: {
  investment: number;
  cap: number;
  capitalizationShares: number;
  discountPct: number;
  roundPrice: number;
  accruedInterest?: number;
}): { capPrice: number; discountPrice: number; price: number; shares: number; usedDiscount: boolean } {
  const capPrice = args.cap / args.capitalizationShares;
  const discountPrice = args.roundPrice * (1 - args.discountPct / 100);
  const price = Math.min(capPrice, discountPrice);
  const shares = Math.round((args.investment + (args.accruedInterest ?? 0)) / price);
  return { capPrice, discountPrice, price, shares, usedDiscount: discountPrice < capPrice };
}

function validate(input: RoundInput): string | null {
  if (input.founderShares <= 0) return 'Founders must hold some shares.';
  if (input.existingPoolShares < 0) return 'The existing pool cannot be negative.';
  if (input.preMoney <= 0) return 'Pre-money valuation must be positive.';
  if (input.investment < 0) return 'Investment cannot be negative.';
  if (input.targetPoolPct < 0 || input.targetPoolPct >= 100) return 'Target pool must be between 0% and 100%.';
  for (const s of input.safes) {
    if (s.investment < 0 || s.postMoneyCap <= 0) return `${s.label}: investment must be non-negative and the cap positive.`;
    if (s.discountPct < 0 || s.discountPct >= 100) return `${s.label}: discount must be between 0% and 100%.`;
  }
  const safeFraction = input.safes.reduce((sum, s) => sum + s.investment / s.postMoneyCap, 0);
  if (safeFraction >= 1) return 'SAFEs would own 100% or more of the company at their caps.';
  const k = (input.preMoney + input.investment) / input.preMoney;
  if ((input.targetPoolPct / 100) * k >= 1) return 'The target pool is larger than the pre-money share of the company.';
  return null;
}

/** Runs SAFE conversion, the option pool shuffle and the priced round. */
export function runRound(input: RoundInput): RoundOutcome {
  const problem = validate(input);
  if (problem) return { ok: false, reason: problem };

  const existing = input.founderShares + input.existingPoolShares;
  const postMoney = input.preMoney + input.investment;
  const k = postMoney / input.preMoney;
  const p = input.targetPoolPct / 100;

  // Post-money SAFE at its cap owns investment / cap of the capitalization before new money and
  // before the pool top-up: base = existing + Σ SAFE shares.
  const safeShares = input.safes.map(() => 0);
  const capPrices = input.safes.map(() => 0);
  let price = 0;
  let newPool = 0;
  let discountPrices = input.safes.map(() => 0);
  let used = input.safes.map(() => false);

  // Fixed-point iteration: SAFEs that convert at a discount depend on the round price, which
  // depends on the share count. Converges in a handful of steps for any valid input.
  for (let iter = 0; iter < 100; iter += 1) {
    const capFraction = input.safes.reduce((sum, s, i) => sum + (used[i] ? 0 : s.investment / s.postMoneyCap), 0);
    const discountShares = safeShares.reduce((sum, v, i) => sum + (used[i] ? v : 0), 0);
    const base = (existing + discountShares) / (1 - capFraction);
    input.safes.forEach((s, i) => {
      capPrices[i] = s.postMoneyCap / base;
      if (!used[i]) safeShares[i] = (s.investment / s.postMoneyCap) * base;
    });
    const preShares0 = existing + safeShares.reduce((a, b) => a + b, 0);
    newPool = Math.max(0, (p * k * preShares0 - input.existingPoolShares) / (1 - p * k));
    const preShares = preShares0 + newPool;
    const nextPrice = input.preMoney / preShares;
    discountPrices = input.safes.map((s) => nextPrice * (1 - s.discountPct / 100));
    const nextUsed = input.safes.map((_, i) => (discountPrices[i] ?? 0) < (capPrices[i] ?? 0));
    input.safes.forEach((s, i) => {
      if (nextUsed[i]) safeShares[i] = s.investment / (discountPrices[i] ?? 1);
    });
    const stable = Math.abs(nextPrice - price) < 1e-12 && nextUsed.every((u, i) => u === used[i]);
    price = nextPrice;
    used = nextUsed;
    if (stable) break;
  }

  const safeHolders: Holder[] = input.safes.map((s, i) => ({
    label: s.label,
    kind: 'safe',
    shares: Math.round(safeShares[i] ?? 0),
    invested: s.investment,
  }));
  const poolShares = input.existingPoolShares + Math.round(newPool);
  const preMoneyShares = input.founderShares + poolShares + safeHolders.reduce((s, h) => s + h.shares, 0);
  const pricePerShare = input.preMoney / preMoneyShares;
  const seriesAShares = Math.round(input.investment / pricePerShare);

  const before = ownershipTable([
    { label: 'Founders', kind: 'common', shares: input.founderShares, invested: 0 },
    { label: 'Option pool', kind: 'pool', shares: input.existingPoolShares, invested: 0 },
  ]);
  const after = ownershipTable([
    { label: 'Founders', kind: 'common', shares: input.founderShares, invested: 0 },
    { label: 'Option pool', kind: 'pool', shares: poolShares, invested: 0 },
    ...safeHolders,
    { label: 'Series A', kind: 'preferred', shares: seriesAShares, invested: input.investment },
  ]);

  const safes: SafeConversion[] = input.safes.map((s, i) => ({
    label: s.label,
    capPrice: capPrices[i] ?? 0,
    discountPrice: discountPrices[i] ?? 0,
    price: used[i] ? (discountPrices[i] ?? 0) : (capPrices[i] ?? 0),
    shares: safeHolders[i]?.shares ?? 0,
    usedDiscount: used[i] ?? false,
  }));

  const dilutiveShares = Math.round(newPool) + safeHolders.reduce((s, h) => s + h.shares, 0);
  return {
    ok: true,
    pricePerShare,
    postMoney,
    preMoneyShares,
    postMoneyShares: preMoneyShares + seriesAShares,
    newPoolShares: Math.round(newPool),
    seriesAShares,
    safes,
    effectivePreMoney: input.preMoney - dilutiveShares * pricePerShare,
    before,
    after,
  };
}

export type PreferenceType = 'non-participating' | 'participating';

export interface Payout {
  label: string;
  kind: HolderKind;
  amount: number;
  converted: boolean;
}

const isPreferred = (h: Holder) => h.kind === 'safe' || h.kind === 'preferred';

/**
 * 1x liquidation waterfall at a given exit (net proceeds to equity, in $).
 * Every preferred holder's preference equals the cash it invested, ranked pari passu.
 */
export function waterfall(holders: readonly Holder[], exitProceeds: number, type: PreferenceType): Payout[] {
  const proceeds = Math.max(0, exitProceeds);
  const prefs = holders.map((h) => (isPreferred(h) ? h.invested : 0));

  const payWith = (converted: readonly boolean[]): number[] => {
    const out = holders.map(() => 0);
    const claim = holders.map((h, i) => (isPreferred(h) && !converted[i] ? (prefs[i] ?? 0) : 0));
    const totalClaim = claim.reduce((s, v) => s + v, 0);
    const prefPaid = Math.min(proceeds, totalClaim);
    holders.forEach((_, i) => {
      out[i] = totalClaim > 0 ? ((claim[i] ?? 0) / totalClaim) * prefPaid : 0;
    });
    const residual = proceeds - prefPaid;
    // Non-participating holders that took their preference do not share in the residual.
    const shareIn = holders.map((h, i) => (type === 'participating' ? true : !isPreferred(h) || (converted[i] ?? false)));
    const sharePool = holders.reduce((s, h, i) => s + (shareIn[i] ? h.shares : 0), 0);
    holders.forEach((h, i) => {
      if (shareIn[i] && sharePool > 0) out[i] = (out[i] ?? 0) + (h.shares / sharePool) * residual;
    });
    return out;
  };

  if (type === 'participating') {
    const amounts = payWith(holders.map(() => false));
    return holders.map((h, i) => ({ label: h.label, kind: h.kind, amount: amounts[i] ?? 0, converted: false }));
  }

  // Non-participating: each preferred holder converts only if that pays more. Iterate to a stable
  // set of conversion choices, flipping one holder at a time (best improvement first).
  let converted = holders.map(() => false);
  for (let iter = 0; iter < holders.length * 4 + 4; iter += 1) {
    const current = payWith(converted);
    let best = -1;
    let bestGain = 1e-9;
    holders.forEach((h, i) => {
      if (!isPreferred(h)) return;
      const flipped = converted.map((c, j) => (j === i ? !c : c));
      const gain = (payWith(flipped)[i] ?? 0) - (current[i] ?? 0);
      if (gain > bestGain) {
        bestGain = gain;
        best = i;
      }
    });
    if (best < 0) break;
    converted = converted.map((c, j) => (j === best ? !c : c));
  }
  const amounts = payWith(converted);
  return holders.map((h, i) => ({ label: h.label, kind: h.kind, amount: amounts[i] ?? 0, converted: converted[i] ?? false }));
}

/** Illustrative seed-to-Series A path for the lab's default view. */
export const DEFAULT_ROUND: RoundInput = {
  founderShares: 8_000_000,
  existingPoolShares: 1_000_000,
  safes: [
    { label: 'Pre-seed SAFE', investment: 1_000_000, postMoneyCap: 10_000_000, discountPct: 0 },
    { label: 'Seed SAFE', investment: 500_000, postMoneyCap: 16_000_000, discountPct: 20 },
  ],
  preMoney: 24_000_000,
  investment: 8_000_000,
  targetPoolPct: 10,
};

export const DEFAULT_EXIT = 60_000_000;
