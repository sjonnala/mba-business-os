import { describe, expect, it } from 'vitest';
import { routineToMarkdown } from '../lib/routineMarkdown';
import {
  type KeyValueStore,
  type RoutineEntry,
  loadMastery,
  loadRoutine,
  nextMastery,
  saveMastery,
  saveRoutine,
} from '../lib/storage';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const entry: RoutineEntry = {
  id: 'e1',
  createdAt: '2026-11-26T10:00:00.000Z',
  conceptId: 'a500-01-accounting-equation',
  explain: 'Every transaction keeps assets equal to claims on them.',
  example: 'HP 2012: 108,768 = 85,935 + 22,833.',
  thread: 'Impairments hit assets and equity together.',
  question: 'Which of our assets would not survive an impairment test?',
};

describe('storage', () => {
  it('round-trips mastery and drops invalid levels', () => {
    const store = memoryStore();
    saveMastery({ a: 'mastered', b: 'reviewed' }, store);
    store.setItem('mba-os:mastery:v1', JSON.stringify({ a: 'mastered', b: 'bogus' }));
    expect(loadMastery(store)).toEqual({ a: 'mastered' });
  });

  it('round-trips routine entries', () => {
    const store = memoryStore();
    saveRoutine([entry], store);
    expect(loadRoutine(store)).toEqual([entry]);
  });

  it('survives a store that throws or is missing', () => {
    expect(loadMastery(throwingStore)).toEqual({});
    expect(saveRoutine([entry], throwingStore)).toBe(false);
    expect(loadRoutine(null)).toEqual([]);
  });

  it('toggles mastery levels', () => {
    expect(nextMastery(undefined, 'reviewed')).toBe('reviewed');
    expect(nextMastery('reviewed', 'reviewed')).toBe('new');
    expect(nextMastery('reviewed', 'mastered')).toBe('mastered');
  });
});

describe('routine markdown export', () => {
  it('exports entries newest first with concept titles', () => {
    const older = { ...entry, id: 'e0', createdAt: '2026-11-20T10:00:00.000Z', conceptId: 'x' };
    const md = routineToMarkdown([older, entry], (id) => (id === 'x' ? 'Old concept' : 'Accounting equation'));
    expect(md.startsWith('# MBA Business OS')).toBe(true);
    expect(md.indexOf('Accounting equation')).toBeLessThan(md.indexOf('Old concept'));
    expect(md).toContain('**Boardroom question:**');
  });

  it('handles an empty log', () => {
    expect(routineToMarkdown([], () => '')).toContain('No entries yet');
  });
});
