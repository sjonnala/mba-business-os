import { describe, expect, it } from 'vitest';
import { COURSES, PILLARS } from '../data/catalog';
import { CONCEPTS, conceptsForCourse } from '../data/graph';
import { BROWSE_TREE, MAP_LAYOUT, MAP_THREADS, MAP_VIEWBOX } from '../data/mapLayout';
import { RADII, conceptMatches } from '../lib/mindMapLayout';
import {
  EMPTY_SELECTION,
  LABEL_METRICS,
  contentBounds,
  coursesToReveal,
  estimateLabelWidth,
  filterBrowseTree,
  highlightIds,
  hookPreview,
  isWithin,
  masteryTally,
  selectNode,
  threadFocus,
  threadsForFocus,
  visibleThreads,
  type MapSelection,
} from '../lib/mapNavigation';

const layout = MAP_LAYOUT;
const entre532 = conceptsForCourse('ENTRE 532');
const acctg500 = conceptsForCourse('ACCTG 500');

describe('selectNode (map, browse tree and drawer clicks)', () => {
  it('opens a course overview when a course node is clicked', () => {
    expect(selectNode(EMPTY_SELECTION, { kind: 'course', id: 'ENTRE532' }, layout)).toEqual({
      conceptId: null,
      overview: { kind: 'course', id: 'ENTRE532' },
    });
  });

  it('opens a pillar overview when a pillar node is clicked, closing any open concept', () => {
    const from: MapSelection = { conceptId: acctg500[0]?.id ?? null, overview: null };
    expect(selectNode(from, { kind: 'pillar', id: 'P4' }, layout)).toEqual({ conceptId: null, overview: { kind: 'pillar', id: 'P4' } });
  });

  it('keeps the course overview behind a concept opened from it, so Back returns there', () => {
    const course = selectNode(EMPTY_SELECTION, { kind: 'course', id: 'ENTRE532' }, layout);
    const id = entre532[0]?.id ?? '';
    expect(selectNode(course, { kind: 'concept', id }, layout)).toEqual({ conceptId: id, overview: { kind: 'course', id: 'ENTRE532' } });
  });

  it('keeps a pillar overview for any concept in that pillar', () => {
    const pillar = selectNode(EMPTY_SELECTION, { kind: 'pillar', id: 'P4' }, layout);
    const id = entre532[1]?.id ?? '';
    expect(selectNode(pillar, { kind: 'concept', id }, layout).overview).toEqual({ kind: 'pillar', id: 'P4' });
  });

  it('drops an unrelated overview when a concept elsewhere is opened', () => {
    const course = selectNode(EMPTY_SELECTION, { kind: 'course', id: 'ENTRE532' }, layout);
    const id = acctg500[0]?.id ?? '';
    expect(selectNode(course, { kind: 'concept', id }, layout)).toEqual({ conceptId: id, overview: null });
  });

  it('resets everything when the centre hub is clicked', () => {
    const busy: MapSelection = { conceptId: entre532[0]?.id ?? null, overview: { kind: 'course', id: 'ENTRE532' } };
    expect(selectNode(busy, { kind: 'root', id: 'root' }, layout)).toEqual(EMPTY_SELECTION);
  });

  it('knows the tree ancestry used by those rules', () => {
    const id = entre532[0]?.id ?? '';
    expect(isWithin(layout, id, 'ENTRE532')).toBe(true);
    expect(isWithin(layout, id, 'P4')).toBe(true);
    expect(isWithin(layout, id, 'root')).toBe(true);
    expect(isWithin(layout, id, 'P1')).toBe(false);
  });
});

describe('subtree highlight', () => {
  it('dims nothing when no pillar or course is focused', () => {
    expect(highlightIds(layout, null)).toBeNull();
  });

  it('keeps a course, its concepts and its ancestors bright and nothing else', () => {
    const lit = highlightIds(layout, 'ENTRE532');
    expect(lit).not.toBeNull();
    const ids = lit ?? new Set<string>();
    for (const c of entre532) expect(ids.has(c.id)).toBe(true);
    expect(ids.has('ENTRE532')).toBe(true);
    expect(ids.has('P4')).toBe(true);
    expect(ids.has('root')).toBe(true);
    expect(ids.has('ENTRE510')).toBe(false);
    expect(ids.has(acctg500[0]?.id ?? '')).toBe(false);
    expect(ids.size).toBe(entre532.length + 3);
  });

  it('keeps a whole pillar wedge bright', () => {
    const ids = highlightIds(layout, 'P4') ?? new Set<string>();
    const p4Courses = COURSES.filter((c) => c.pillarId === 'P4');
    const p4Concepts = CONCEPTS.filter((c) => c.pillarId === 'P4');
    expect(ids.size).toBe(2 + p4Courses.length + p4Concepts.length);
  });
});

describe('thread edges: On-Focus by default, All threads opt-in', () => {
  it('draws no thread edges on load when nothing is hovered or selected', () => {
    expect(MAP_THREADS.length).toBeGreaterThan(300);
    expect(visibleThreads(MAP_THREADS, layout, null, false)).toEqual([]);
  });

  it('draws the full global web only when "All threads" is ticked', () => {
    const all = visibleThreads(MAP_THREADS, layout, null, true);
    expect(all).toHaveLength(MAP_THREADS.length);
    expect(all.every((t) => !t.lit)).toBe(true);
  });

  it('shows a focused concept\'s outgoing and incoming threads, all lit', () => {
    const id = 'a500-05-cash-flow-fcf';
    const shown = visibleThreads(MAP_THREADS, layout, id, false);
    const expected = MAP_THREADS.filter((t) => t.sourceId === id || t.targetId === id);
    expect(shown.map((t) => t.key).sort()).toEqual(expected.map((t) => t.key).sort());
    expect(shown.some((t) => t.targetId === id)).toBe(true);
    expect(shown.some((t) => t.sourceId === id)).toBe(true);
    expect(shown.every((t) => t.lit)).toBe(true);
  });

  it('shows every thread touching a focused course\'s concepts', () => {
    const scope = new Set(['ENTRE532', ...entre532.map((c) => c.id)]);
    const shown = threadsForFocus(MAP_THREADS, layout, 'ENTRE532');
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((t) => scope.has(t.sourceId) || scope.has(t.targetId))).toBe(true);
    expect(shown).toHaveLength(MAP_THREADS.filter((t) => scope.has(t.sourceId) || scope.has(t.targetId)).length);
  });

  it('a pillar focus covers at least its courses\' threads', () => {
    const course = new Set(threadsForFocus(MAP_THREADS, layout, 'ENTRE532').map((t) => t.key));
    const pillar = new Set(threadsForFocus(MAP_THREADS, layout, 'P4').map((t) => t.key));
    for (const k of course) expect(pillar.has(k)).toBe(true);
    expect(pillar.size).toBeGreaterThan(course.size);
  });

  it('lights the focused threads within the global web when All threads is on', () => {
    const id = 'a500-05-cash-flow-fcf';
    const all = visibleThreads(MAP_THREADS, layout, id, true);
    expect(all).toHaveLength(MAP_THREADS.length);
    expect(all.filter((t) => t.lit)).toHaveLength(threadsForFocus(MAP_THREADS, layout, id).length);
  });

  it('takes the thread focus from hover first, then the open concept, then the overview', () => {
    const sel: MapSelection = { conceptId: 'c1', overview: { kind: 'course', id: 'ENTRE532' } };
    expect(threadFocus('h1', sel)).toBe('h1');
    expect(threadFocus(null, sel)).toBe('c1');
    expect(threadFocus(null, { conceptId: null, overview: { kind: 'pillar', id: 'P2' } })).toBe('P2');
    expect(threadFocus(null, EMPTY_SELECTION)).toBeNull();
  });
});

describe('auto-fit viewport', () => {
  const inside = (x: number, y: number) =>
    x >= MAP_VIEWBOX.x && x <= MAP_VIEWBOX.x + MAP_VIEWBOX.width && y >= MAP_VIEWBOX.y && y <= MAP_VIEWBOX.y + MAP_VIEWBOX.height;

  it('frames every outer-ring concept label end, not just the node circles', () => {
    for (const n of layout.nodes.filter((k) => k.kind === 'concept')) {
      const reach = LABEL_METRICS.conceptOffset + estimateLabelWidth(n.label, LABEL_METRICS.conceptFont);
      const rad = (n.angle * Math.PI) / 180;
      expect(inside(n.x + Math.cos(rad) * reach, n.y + Math.sin(rad) * reach)).toBe(true);
    }
  });

  it('is wider than the old fixed 1780-unit square, which clipped the longest labels', () => {
    const b = contentBounds(layout);
    const extent = Math.max(-b.minX, -b.minY, b.maxX, b.maxY);
    expect(extent).toBeGreaterThan(890);
    expect(extent).toBeGreaterThan(RADII.concept);
  });

  it('keeps the hub near the centre of the fitted view', () => {
    const cx = MAP_VIEWBOX.x + MAP_VIEWBOX.width / 2;
    const cy = MAP_VIEWBOX.y + MAP_VIEWBOX.height / 2;
    expect(Math.abs(cx)).toBeLessThan(60);
    expect(Math.abs(cy)).toBeLessThan(60);
  });
});

describe('browse tree (Pillar → Course → Concept)', () => {
  it('holds all 5 pillars, 22 courses and every live concept in catalog order', () => {
    expect(BROWSE_TREE.map((p) => p.pillar.id)).toEqual(PILLARS.map((p) => p.id));
    expect(BROWSE_TREE.flatMap((p) => p.courses)).toHaveLength(22);
    expect(BROWSE_TREE.flatMap((p) => p.courses.flatMap((c) => c.concepts))).toHaveLength(CONCEPTS.length);
    expect(BROWSE_TREE[0]?.courses[0]?.course.id).toBe('ACCTG500');
  });

  it('filters to matching concepts and drops empty courses and pillars', () => {
    const matching = new Set(CONCEPTS.filter((c) => conceptMatches(c, 'deferred revenue', '')).map((c) => c.id));
    expect(matching.size).toBeGreaterThan(0);
    const shown = filterBrowseTree(BROWSE_TREE, matching);
    const ids = shown.flatMap((p) => p.courses.flatMap((c) => c.concepts.map((k) => k.id)));
    expect(new Set(ids)).toEqual(matching);
    expect(shown.every((p) => p.courses.every((c) => c.concepts.length > 0))).toBe(true);
  });

  it('reveals the course of the open concept or course overview', () => {
    const id = entre532[0]?.id ?? null;
    expect(coursesToReveal(BROWSE_TREE, { conceptId: id, overview: null })).toEqual(new Set(['ENTRE532']));
    expect(coursesToReveal(BROWSE_TREE, { conceptId: null, overview: { kind: 'course', id: 'MGMT550' } })).toEqual(new Set(['MGMT550']));
    expect(coursesToReveal(BROWSE_TREE, EMPTY_SELECTION).size).toBe(0);
  });
});

describe('overview helpers', () => {
  it('tallies mastery for a set of concepts', () => {
    const ids = entre532.map((c) => c.id);
    const [a, b] = ids;
    expect(masteryTally(ids, { [a ?? '']: 'mastered', [b ?? '']: 'reviewed', other: 'mastered' })).toEqual({
      mastered: 1,
      reviewed: 1,
      total: ids.length,
    });
  });

  it('previews long hooks at a word boundary', () => {
    const long = 'word '.repeat(60).trim();
    const out = hookPreview(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
    expect(hookPreview('short hook')).toBe('short hook');
  });
});
