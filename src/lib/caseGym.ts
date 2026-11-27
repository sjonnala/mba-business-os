/**
 * Spaced-repetition Case Gym: a typed parser for the 50-drill bank, SM-2-style scheduling with three
 * self-grades (Again, Good, Easy), queue ordering and filters. Pure functions; storage lives in storage.ts.
 */
import { DIFFICULTIES, PILLAR_IDS, type Difficulty, type PillarId } from '../schema/knowledgeGraph';

export const DRILL_SECONDS = 3 * 60;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface Drill {
  id: string;
  pillarId: PillarId;
  courseCode: string;
  title: string;
  difficulty: Difficulty;
  scenario: string;
  question: string;
  cfoFounderAnswer: string;
  antiPatternTrap: string;
  relatedConceptId: string;
  /** The slug M-402 proposed before Wave M5 reconciled it to a real concept id. */
  sourceConceptSlug: string;
}

export const GRADES = ['again', 'good', 'easy'] as const;
export type Grade = (typeof GRADES)[number];

/** Per-drill review state, the SM-2 card fields plus when it is next due (epoch ms). */
export interface CardState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt: number;
}

export type GymProgress = Record<string, CardState>;

export const SM2 = { startEase: 2.5, minEase: 1.3, easyBonus: 1.3 } as const;

const STRING_FIELDS = [
  'id',
  'courseCode',
  'title',
  'scenario',
  'question',
  'cfoFounderAnswer',
  'antiPatternTrap',
  'relatedConceptId',
  'sourceConceptSlug',
] as const;

function isPillarId(v: unknown): v is PillarId {
  return typeof v === 'string' && (PILLAR_IDS as readonly string[]).includes(v);
}

function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

/** Validates the drill bank file and returns typed drills; throws with every problem listed. */
export function parseDrills(raw: unknown): Drill[] {
  const list = raw && typeof raw === 'object' && 'drills' in raw ? (raw as { drills: unknown }).drills : raw;
  if (!Array.isArray(list)) throw new Error('Case gym: expected a drills array');
  const errors: string[] = [];
  const drills: Drill[] = [];
  list.forEach((item: unknown, i) => {
    if (!item || typeof item !== 'object') {
      errors.push(`#${i}: not an object`);
      return;
    }
    const v = item as Record<string, unknown>;
    const missing = STRING_FIELDS.filter((k) => typeof v[k] !== 'string' || (v[k] as string).trim() === '');
    if (missing.length > 0) errors.push(`#${i}: missing ${missing.join(', ')}`);
    if (!isPillarId(v.pillarId)) errors.push(`#${i}: bad pillarId`);
    if (!isDifficulty(v.difficulty)) errors.push(`#${i}: bad difficulty`);
    if (missing.length === 0 && isPillarId(v.pillarId) && isDifficulty(v.difficulty)) {
      drills.push({
        id: v.id as string,
        pillarId: v.pillarId,
        courseCode: v.courseCode as string,
        title: v.title as string,
        difficulty: v.difficulty,
        scenario: v.scenario as string,
        question: v.question as string,
        cfoFounderAnswer: v.cfoFounderAnswer as string,
        antiPatternTrap: v.antiPatternTrap as string,
        relatedConceptId: v.relatedConceptId as string,
        sourceConceptSlug: v.sourceConceptSlug as string,
      });
    }
  });
  if (errors.length > 0) throw new Error(`Case gym: invalid drills\n${errors.join('\n')}`);
  return drills;
}

export function newCard(now: number): CardState {
  return { ease: SM2.startEase, intervalDays: 0, reps: 0, lapses: 0, dueAt: now, lastReviewedAt: 0 };
}

/**
 * SM-2-style update. Again maps to quality 1 (reset, review tomorrow, ease −0.2), Good to quality 4
 * (ease unchanged; intervals 1, 6, then interval × ease) and Easy to quality 5 (ease +0.1, interval
 * × 1.3 bonus, at least one day longer than Good would give).
 */
export function schedule(card: CardState | undefined, grade: Grade, now: number): CardState {
  const prev = card ?? newCard(now);
  if (grade === 'again') {
    return {
      ease: Math.max(SM2.minEase, round2(prev.ease - 0.2)),
      intervalDays: 1,
      reps: 0,
      lapses: prev.lapses + 1,
      dueAt: now + DAY_MS,
      lastReviewedAt: now,
    };
  }
  const reps = prev.reps + 1;
  const ease = grade === 'easy' ? round2(prev.ease + 0.1) : prev.ease;
  const good = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(prev.intervalDays * ease);
  const intervalDays = grade === 'easy' ? Math.max(good + 1, Math.round(good * SM2.easyBonus)) : good;
  return { ease, intervalDays, reps, lapses: prev.lapses, dueAt: now + intervalDays * DAY_MS, lastReviewedAt: now };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isDue(card: CardState | undefined, now: number): boolean {
  return !card || card.dueAt <= now;
}

export interface GymFilter {
  pillar: PillarId | 'all';
  course: string | 'all';
  difficulty: Difficulty | 'all';
}

export const ALL_FILTER: GymFilter = { pillar: 'all', course: 'all', difficulty: 'all' };

export function filterDrills(drills: readonly Drill[], f: GymFilter): Drill[] {
  return drills.filter(
    (d) =>
      (f.pillar === 'all' || d.pillarId === f.pillar) &&
      (f.course === 'all' || d.courseCode === f.course) &&
      (f.difficulty === 'all' || d.difficulty === f.difficulty),
  );
}

/** Due cards first (overdue longest first, new cards after overdue ones), then the rest by due date. */
export function orderQueue(drills: readonly Drill[], progress: GymProgress, now: number): Drill[] {
  const key = (d: Drill): [number, number] => {
    const c = progress[d.id];
    if (!c) return [0, now];
    return [c.dueAt <= now ? 0 : 1, c.dueAt];
  };
  return [...drills].sort((a, b) => {
    const [ga, ta] = key(a);
    const [gb, tb] = key(b);
    if (ga !== gb) return ga - gb;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

export interface GymStats {
  total: number;
  due: number;
  reviewed: number;
  mature: number;
}

/** Counts for a set of drills: due now, ever reviewed, and mature (interval of 21 days or more). */
export function gymStats(drills: readonly Drill[], progress: GymProgress, now: number): GymStats {
  let due = 0;
  let reviewed = 0;
  let mature = 0;
  for (const d of drills) {
    const c = progress[d.id];
    if (isDue(c, now)) due += 1;
    if (c && c.lastReviewedAt > 0) reviewed += 1;
    if (c && c.intervalDays >= 21) mature += 1;
  }
  return { total: drills.length, due, reviewed, mature };
}

/** Plain-words label for when a card is next due. */
export function dueLabel(card: CardState | undefined, now: number): string {
  if (!card) return 'New';
  if (card.dueAt <= now) return 'Due now';
  const days = Math.ceil((card.dueAt - now) / DAY_MS);
  return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
}

export function isCardState(v: unknown): v is CardState {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return ['ease', 'intervalDays', 'reps', 'lapses', 'dueAt', 'lastReviewedAt'].every(
    (k) => typeof c[k] === 'number' && Number.isFinite(c[k]),
  );
}
