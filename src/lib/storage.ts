/**
 * localStorage helpers. Every access is wrapped in try/catch because storage can be missing or
 * throw (private windows, blocked site data); the app keeps working in memory when it does.
 */

export const MASTERY_LEVELS = ['new', 'reviewed', 'mastered'] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];
export type MasteryMap = Record<string, MasteryLevel>;

export interface RoutineEntry {
  id: string;
  createdAt: string;
  conceptId: string;
  /** One-sentence explanation in plain words (Feynman test). */
  explain: string;
  /** A real company or number that makes it concrete. */
  example: string;
  /** The thread pulled to another concept or course. */
  thread: string;
  /** A boardroom question to bring to class or work. */
  question: string;
}

export type Theme = 'light' | 'dark';

export const STORAGE_KEYS = {
  mastery: 'mba-os:mastery:v1',
  routine: 'mba-os:routine:v1',
  theme: 'mba-os:theme:v1',
} as const;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readJson(key: string, store: KeyValueStore | null): unknown {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, store: KeyValueStore | null): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isMasteryLevel(value: unknown): value is MasteryLevel {
  return typeof value === 'string' && (MASTERY_LEVELS as readonly string[]).includes(value);
}

export function loadMastery(store: KeyValueStore | null = defaultStore()): MasteryMap {
  const raw = readJson(STORAGE_KEYS.mastery, store);
  const out: MasteryMap = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) if (isMasteryLevel(v)) out[k] = v;
  }
  return out;
}

export function saveMastery(map: MasteryMap, store: KeyValueStore | null = defaultStore()): boolean {
  return writeJson(STORAGE_KEYS.mastery, map, store);
}

function isRoutineEntry(value: unknown): value is RoutineEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['id', 'createdAt', 'conceptId', 'explain', 'example', 'thread', 'question'].every(
    (k) => typeof v[k] === 'string',
  );
}

export function loadRoutine(store: KeyValueStore | null = defaultStore()): RoutineEntry[] {
  const raw = readJson(STORAGE_KEYS.routine, store);
  return Array.isArray(raw) ? raw.filter(isRoutineEntry) : [];
}

export function saveRoutine(entries: readonly RoutineEntry[], store: KeyValueStore | null = defaultStore()): boolean {
  return writeJson(STORAGE_KEYS.routine, entries, store);
}

export function loadTheme(store: KeyValueStore | null = defaultStore()): Theme | null {
  const raw = readJson(STORAGE_KEYS.theme, store);
  return raw === 'light' || raw === 'dark' ? raw : null;
}

export function saveTheme(theme: Theme, store: KeyValueStore | null = defaultStore()): boolean {
  return writeJson(STORAGE_KEYS.theme, theme, store);
}

export function nextMastery(level: MasteryLevel | undefined, target: Exclude<MasteryLevel, 'new'>): MasteryLevel {
  return level === target ? 'new' : target;
}
