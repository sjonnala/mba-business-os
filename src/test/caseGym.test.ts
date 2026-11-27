import { describe, expect, it } from 'vitest';
import rawGym from '../data/case-gym-drills.json';
import { COURSES } from '../data/catalog';
import { DRILLS } from '../data/caseGym';
import { CONCEPTS, conceptById } from '../data/graph';
import {
  ALL_FILTER,
  DAY_MS,
  DRILL_SECONDS,
  SM2,
  dueLabel,
  filterDrills,
  gymStats,
  newCard,
  orderQueue,
  parseDrills,
  schedule,
  type GymProgress,
} from '../lib/caseGym';
import { type KeyValueStore, loadGymProgress, saveGymProgress } from '../lib/storage';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('Case Gym drill bank', () => {
  it('has 59 drills with unique ids, 10 to 15 per pillar after Wave M7, and a 3-minute timer', () => {
    expect(DRILLS).toHaveLength(59);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(59);
    const perPillar = { P1: 10, P2: 12, P3: 15, P4: 10, P5: 12 } as const;
    for (const [p, n] of Object.entries(perPillar)) expect(DRILLS.filter((d) => d.pillarId === p), p).toHaveLength(n);
    expect((rawGym as { drillCount: number }).drillCount).toBe(DRILLS.length);
    expect(DRILL_SECONDS).toBe(180);
    expect((rawGym as { minutesPerDrill: number }).minutesPerDrill).toBe(3);
  });

  it('resolves 59 of 59 relatedConceptId links to real Pillar 1-5 concepts on the same pillar', () => {
    const resolved = DRILLS.filter((d) => conceptById(d.relatedConceptId) !== undefined);
    expect(resolved.map((d) => d.id)).toEqual(DRILLS.map((d) => d.id));
    expect(resolved).toHaveLength(59);
    for (const d of DRILLS) expect(conceptById(d.relatedConceptId)?.pillarId, d.id).toBe(d.pillarId);
  });

  it('links each drill to a concept in its own course, except the one documented cross-course link', () => {
    const crossCourse = DRILLS.filter((d) => conceptById(d.relatedConceptId)?.courseCode !== d.courseCode).map((d) => d.id);
    expect(crossCourse).toEqual(['gym-p5-05']);
  });

  it('uses only catalog course codes and keeps the M-402 slug for traceability', () => {
    const codes = new Set(COURSES.map((c) => c.code));
    for (const d of DRILLS) {
      expect(codes.has(d.courseCode), d.id).toBe(true);
      expect(d.sourceConceptSlug.length, d.id).toBeGreaterThan(0);
    }
    expect(new Set(DRILLS.map((d) => d.relatedConceptId)).size).toBeGreaterThanOrEqual(57);
    expect(CONCEPTS.length).toBe(99);
  });

  it('rejects malformed drills with every problem listed', () => {
    expect(() => parseDrills({ drills: [{ id: 'x', pillarId: 'P9', difficulty: 'hard' }] })).toThrow(/bad pillarId[\s\S]*bad difficulty/);
    expect(() => parseDrills({ nope: true })).toThrow(/drills array/);
  });
});

describe('SM-2 scheduling', () => {
  it('schedules Good at 1 day, then 6 days, then interval × ease', () => {
    const a = schedule(undefined, 'good', NOW);
    expect([a.reps, a.intervalDays, a.ease]).toEqual([1, 1, SM2.startEase]);
    const b = schedule(a, 'good', NOW);
    expect(b.intervalDays).toBe(6);
    const c = schedule(b, 'good', NOW);
    expect(c.intervalDays).toBe(15);
    expect(c.dueAt).toBe(NOW + 15 * DAY_MS);
  });

  it('pushes Easy further out and raises ease by 0.1', () => {
    const e = schedule(undefined, 'easy', NOW);
    expect(e.ease).toBeCloseTo(2.6, 6);
    expect(e.intervalDays).toBe(2);
    const e2 = schedule(e, 'easy', NOW);
    expect(e2.intervalDays).toBe(8);
    expect(e2.intervalDays).toBeGreaterThan(schedule(e, 'good', NOW).intervalDays);
  });

  it('resets on Again, counts a lapse, drops ease by 0.2 but never below 1.3', () => {
    const b = schedule(schedule(undefined, 'good', NOW), 'good', NOW);
    const lapse = schedule(b, 'again', NOW);
    expect([lapse.reps, lapse.intervalDays, lapse.lapses]).toEqual([0, 1, 1]);
    expect(lapse.ease).toBeCloseTo(2.3, 6);
    let card = newCard(NOW);
    for (let i = 0; i < 10; i += 1) card = schedule(card, 'again', NOW);
    expect(card.ease).toBe(SM2.minEase);
  });

  it('puts due and new drills first, then the rest by due date, and labels them', () => {
    const [d1, d2, d3] = DRILLS;
    if (!d1 || !d2 || !d3) throw new Error('need drills');
    const progress: GymProgress = {
      [d1.id]: schedule(undefined, 'good', NOW),
      [d2.id]: { ...schedule(undefined, 'good', NOW - 3 * DAY_MS) },
    };
    const queue = orderQueue([d1, d2, d3], progress, NOW);
    expect(queue.map((d) => d.id)).toEqual([d2.id, d3.id, d1.id]);
    expect(dueLabel(progress[d1.id], NOW)).toBe('Due tomorrow');
    expect(dueLabel(progress[d2.id], NOW)).toBe('Due now');
    expect(dueLabel(undefined, NOW)).toBe('New');
    expect(gymStats([d1, d2, d3], progress, NOW)).toEqual({ total: 3, due: 2, reviewed: 2, mature: 0 });
  });

  it('filters by pillar, course and difficulty', () => {
    expect(filterDrills(DRILLS, ALL_FILTER)).toHaveLength(59);
    expect(filterDrills(DRILLS, { ...ALL_FILTER, pillar: 'P5' })).toHaveLength(12);
    expect(filterDrills(DRILLS, { ...ALL_FILTER, course: 'MGMT 550' })).toHaveLength(2);
    const advancedP5 = filterDrills(DRILLS, { pillar: 'P5', course: 'all', difficulty: 'advanced' });
    expect(advancedP5.every((d) => d.pillarId === 'P5' && d.difficulty === 'advanced')).toBe(true);
  });
});

describe('Case Gym storage', () => {
  it('round-trips progress through localStorage and drops malformed cards', () => {
    const store = memoryStore();
    const progress: GymProgress = { 'gym-p1-01': schedule(undefined, 'good', NOW) };
    expect(saveGymProgress(progress, store)).toBe(true);
    expect(loadGymProgress(store)).toEqual(progress);
    store.setItem('mba-os:case-gym:v1', JSON.stringify({ a: { ease: 'x' }, b: schedule(undefined, 'easy', NOW) }));
    expect(Object.keys(loadGymProgress(store))).toEqual(['b']);
  });

  it('keeps working when storage is missing or throws', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGymProgress(throwing)).toEqual({});
    expect(saveGymProgress({}, throwing)).toBe(false);
    expect(loadGymProgress(null)).toEqual({});
  });
});
