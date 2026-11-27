import type { ConceptNode, Course, Pillar } from '../schema/knowledgeGraph';

export type MapNodeKind = 'root' | 'pillar' | 'course' | 'concept';

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  label: string;
  x: number;
  y: number;
  /** Angle from the centre in degrees, used to orient radial labels. */
  angle: number;
  parentId: string | null;
}

export interface MapLayout {
  nodes: MapNode[];
  byId: Map<string, MapNode>;
}

export const RADII = { pillar: 165, course: 320, concept: 600 } as const;

function polar(r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

/** Short label for a concept: the title before any parenthetical, capped in length. */
export function shortLabel(title: string, max = 34): string {
  const base = title.split(' (')[0] ?? title;
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
}

/** Angular weight per concept and the minimum sector for a course with no live concepts, in degrees. */
export const SECTOR = { perConcept: 8, minCourse: 6 } as const;

/**
 * Radial tree: root → 5 pillars → 22 courses → concepts of live courses. ACCTG 500 sits at the top.
 * Each course gets an angular sector sized by its concept count (with a floor for coming courses),
 * scaled to fill the circle, so concept fans of neighbouring live courses never overlap.
 */
export function layoutMindMap(
  pillars: readonly Pillar[],
  courses: readonly Course[],
  concepts: readonly ConceptNode[],
): MapLayout {
  const nodes: MapNode[] = [{ id: 'root', kind: 'root', label: 'MBA Business OS', x: 0, y: 0, angle: -90, parentId: null }];
  const owned = courses.map((c) => concepts.filter((k) => k.courseCode === c.code));
  const widths = owned.map((own) => Math.max(SECTOR.minCourse, own.length * SECTOR.perConcept));
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = total > 0 ? 360 / total : 1;
  const spacing = SECTOR.perConcept * scale;

  const courseAngle = new Map<string, number>();
  let cursor = -90 - ((widths[0] ?? 0) * scale) / 2;
  courses.forEach((c, i) => {
    const w = (widths[i] ?? 0) * scale;
    courseAngle.set(c.id, cursor + w / 2);
    cursor += w;
  });

  for (const p of pillars) {
    const angles = courses.filter((c) => c.pillarId === p.id).map((c) => courseAngle.get(c.id) ?? 0);
    const angle = angles.length > 0 ? angles.reduce((a, b) => a + b, 0) / angles.length : 0;
    nodes.push({ id: p.id, kind: 'pillar', label: p.shortName, ...polar(RADII.pillar, angle), angle, parentId: 'root' });
  }

  courses.forEach((c, ci) => {
    const angle = courseAngle.get(c.id) ?? 0;
    nodes.push({ id: c.id, kind: 'course', label: c.code, ...polar(RADII.course, angle), angle, parentId: c.pillarId });
    const own = owned[ci] ?? [];
    const span = spacing * (own.length - 1);
    own.forEach((k, i) => {
      const a = angle - span / 2 + i * spacing;
      nodes.push({ id: k.id, kind: 'concept', label: shortLabel(k.title), ...polar(RADII.concept, a), angle: a, parentId: c.id });
    });
  });

  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])) };
}

/** Whether a concept matches a free-text query and an optional tag. */
export function conceptMatches(concept: ConceptNode, query: string, tag: string): boolean {
  if (tag && !concept.tags.includes(tag)) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [concept.title, concept.hook10k, ...concept.tags].join(' ').toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
