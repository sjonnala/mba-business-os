import { describe, expect, it } from 'vitest';
import { COURSES, PILLARS, comingLabel } from '../data/catalog';
import { CONCEPTS } from '../data/graph';
import { RADII, conceptMatches, layoutMindMap, shortLabel } from '../lib/mindMapLayout';

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

  it('has all 22 courses live after Wave M5, with 90 concepts', () => {
    expect(COURSES.filter((c) => c.status === 'live').map((c) => c.code)).toEqual([
      'ACCTG 500', 'ACCTG 501', 'FIN 502', 'ENTRE 557', 'ENTRE 542',
      'B ECON 500', 'B ECON 501', 'MGMT 502', 'OPMGT 502', 'QMETH 500', 'QMETH 501', 'I S 500',
      'ENTRE 510', 'ENTRE 532', 'ENTRE 579', 'MKTG 554',
      'MKTG 501', 'MKTG 600', 'MGMT 500', 'MGMT 510 / B CMU 501', 'MGMT 504', 'MGMT 550',
    ]);
    expect(CONCEPTS.filter((c) => c.courseCode === 'ACCTG 500')).toHaveLength(15);
    expect(CONCEPTS.filter((c) => c.courseCode === 'ACCTG 501')).toHaveLength(10);
    expect(CONCEPTS.filter((c) => c.pillarId === 'P2')).toHaveLength(14);
    expect(CONCEPTS.filter((c) => c.pillarId === 'P3')).toHaveLength(18);
    expect(CONCEPTS.filter((c) => c.courseCode === 'MGMT 502')).toHaveLength(7);
    expect(CONCEPTS.filter((c) => c.pillarId === 'P4')).toHaveLength(16);
    expect(CONCEPTS.filter((c) => c.courseCode === 'MKTG 554')).toHaveLength(5);
    expect(CONCEPTS.filter((c) => c.pillarId === 'P5')).toHaveLength(17);
    expect(CONCEPTS.filter((c) => c.courseCode === 'MGMT 550')).toHaveLength(4);
    expect(CONCEPTS).toHaveLength(90);
  });

  it('has a live concept under every live course and none under coming courses', () => {
    for (const c of COURSES) {
      const n = CONCEPTS.filter((x) => x.courseCode === c.code).length;
      if (c.status === 'live') expect(n, c.code).toBeGreaterThan(0);
      else expect(n, c.code).toBe(0);
    }
  });

  it('labels every course Live once Wave M5 ships, and still labels a coming course with its wave', () => {
    for (const c of COURSES) expect(comingLabel(c), c.code).toBe('Live');
    const marketing = COURSES.find((c) => c.id === 'MKTG501');
    expect(marketing && comingLabel({ ...marketing, status: 'coming' })).toBe('Coming in Wave M5');
    const venture = COURSES.find((c) => c.id === 'ENTRE510');
    expect(venture && comingLabel(venture)).toBe('Live');
    const econ = COURSES.find((c) => c.id === 'BECON500');
    expect(econ && comingLabel(econ)).toBe('Live');
    const fin = COURSES.find((c) => c.id === 'FIN502');
    expect(fin && comingLabel(fin)).toBe('Live');
  });
});

describe('mind map layout', () => {
  it('places root, 5 pillars, 22 courses and 90 concepts', () => {
    const layout = layoutMindMap(PILLARS, COURSES, CONCEPTS);
    const count = (k: string) => layout.nodes.filter((n) => n.kind === k).length;
    expect([count('root'), count('pillar'), count('course'), count('concept')]).toEqual([1, 5, 22, 90]);
    for (const n of layout.nodes) if (n.parentId) expect(layout.byId.has(n.parentId)).toBe(true);
  });

  it('keeps concept fans apart and ACCTG 500 at the top', () => {
    const layout = layoutMindMap(PILLARS, COURSES, CONCEPTS);
    const angles = layout.nodes.filter((n) => n.kind === 'concept').map((n) => n.angle).sort((a, b) => a - b);
    // Neighbouring concept dots stay at least 45px apart along the outer ring (about 3.8 degrees at r = 680, with 90 concepts at 4 degrees each).
    const minArc = (deg: number) => (deg * Math.PI * RADII.concept) / 180;
    for (let i = 1; i < angles.length; i += 1) expect(minArc((angles[i] ?? 0) - (angles[i - 1] ?? 0))).toBeGreaterThan(45);
    expect((angles[angles.length - 1] ?? 0) - (angles[0] ?? 0)).toBeLessThan(360);
    expect(layout.byId.get('ACCTG500')?.angle).toBeCloseTo(-90, 6);
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
