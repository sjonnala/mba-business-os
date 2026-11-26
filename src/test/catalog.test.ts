import { describe, expect, it } from 'vitest';
import { COURSES, PILLARS, comingLabel } from '../data/catalog';
import { CONCEPTS } from '../data/graph';
import { conceptMatches, layoutMindMap, shortLabel } from '../lib/mindMapLayout';

describe('catalog', () => {
  it('has 5 pillars and 22 courses with unique ids and codes', () => {
    expect(PILLARS).toHaveLength(5);
    expect(COURSES).toHaveLength(22);
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(22);
    expect(new Set(COURSES.map((c) => c.code)).size).toBe(22);
  });

  it('puts every course under a known pillar', () => {
    const ids = new Set(PILLARS.map((p) => p.id));
    for (const c of COURSES) expect(ids.has(c.pillarId)).toBe(true);
  });

  it('has only ACCTG 500 live in Wave M1, with 15 concepts', () => {
    expect(COURSES.filter((c) => c.status === 'live').map((c) => c.code)).toEqual(['ACCTG 500']);
    expect(CONCEPTS.filter((c) => c.courseCode === 'ACCTG 500')).toHaveLength(15);
  });

  it('labels coming courses with their wave', () => {
    const fin = COURSES.find((c) => c.id === 'FIN502');
    expect(fin && comingLabel(fin)).toBe('Coming in Wave M2');
  });
});

describe('mind map layout', () => {
  it('places root, 5 pillars, 22 courses and 15 concepts', () => {
    const layout = layoutMindMap(PILLARS, COURSES, CONCEPTS);
    const count = (k: string) => layout.nodes.filter((n) => n.kind === k).length;
    expect([count('root'), count('pillar'), count('course'), count('concept')]).toEqual([1, 5, 22, 15]);
    for (const n of layout.nodes) if (n.parentId) expect(layout.byId.has(n.parentId)).toBe(true);
  });

  it('filters concepts by text and tag', () => {
    const c = CONCEPTS[0];
    if (!c) throw new Error('no concepts');
    expect(conceptMatches(c, 'accounting equation', '')).toBe(true);
    expect(conceptMatches(c, 'zzz-nothing', '')).toBe(false);
    expect(conceptMatches(c, '', 'not-a-tag')).toBe(false);
  });

  it('shortens long titles', () => {
    expect(shortLabel('Inventory Valuation (FIFO, LIFO)')).toBe('Inventory Valuation');
  });
});
