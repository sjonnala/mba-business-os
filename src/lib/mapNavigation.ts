/**
 * Wave M6 mind-map navigation: pure helpers for what is selected, what is highlighted, which
 * thread edges are drawn, how the initial view fits, and the Pillar → Course → Concept browse tree.
 * Everything here is free of React and the DOM so it can be unit tested directly.
 */
import type { ConceptNode, Course, Pillar } from '../schema/knowledgeGraph';
import type { MasteryLevel, MasteryMap } from './storage';
import type { MapLayout, MapNode, MapNodeKind } from './mindMapLayout';

/** A pillar or course whose overview drawer is open. */
export interface OverviewTarget {
  kind: 'pillar' | 'course';
  id: string;
}

/** What the map has selected: an open concept, an open overview, or both (concept opened from the overview). */
export interface MapSelection {
  conceptId: string | null;
  overview: OverviewTarget | null;
}

export const EMPTY_SELECTION: MapSelection = { conceptId: null, overview: null };

export interface NodeRef {
  kind: MapNodeKind;
  id: string;
}

/** Whether `nodeId` sits at or under `ancestorId` in the radial tree. */
export function isWithin(layout: MapLayout, nodeId: string, ancestorId: string): boolean {
  let cur: MapNode | undefined = layout.byId.get(nodeId);
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parentId ? layout.byId.get(cur.parentId) : undefined;
  }
  return false;
}

/**
 * Next selection after a node is clicked (on the map, in the browse tree or in a drawer).
 * The hub clears everything; a pillar or course opens its overview; a concept opens its drawer and
 * keeps the overview it came from only when the concept belongs to it, so "back" stays meaningful.
 */
export function selectNode(selection: MapSelection, node: NodeRef, layout: MapLayout): MapSelection {
  switch (node.kind) {
    case 'root':
      return EMPTY_SELECTION;
    case 'pillar':
    case 'course':
      return { conceptId: null, overview: { kind: node.kind, id: node.id } };
    case 'concept': {
      const keep = selection.overview !== null && isWithin(layout, node.id, selection.overview.id);
      return { conceptId: node.id, overview: keep ? selection.overview : null };
    }
  }
}

/** Ids of a node and all its descendants. */
export function subtreeIds(layout: MapLayout, id: string): Set<string> {
  const out = new Set<string>();
  for (const n of layout.nodes) if (isWithin(layout, n.id, id)) out.add(n.id);
  return out;
}

/**
 * Nodes that stay bright while a pillar or course is focused: its subtree plus its ancestors up to
 * the hub. Returns null when nothing is focused, meaning nothing is dimmed.
 */
export function highlightIds(layout: MapLayout, focusId: string | null): Set<string> | null {
  if (!focusId || !layout.byId.has(focusId)) return null;
  const out = subtreeIds(layout, focusId);
  let cur = layout.byId.get(focusId);
  while (cur) {
    out.add(cur.id);
    cur = cur.parentId ? layout.byId.get(cur.parentId) : undefined;
  }
  return out;
}

export interface ThreadEdge {
  key: string;
  sourceId: string;
  targetId: string;
  relationship: string;
  question: string;
}

/** Every cross-concept thread whose two ends are both on the map. */
export function allThreads(concepts: readonly ConceptNode[], layout: MapLayout): ThreadEdge[] {
  return concepts.flatMap((c) =>
    c.threadsToPull
      .filter((t) => layout.byId.has(c.id) && layout.byId.has(t.targetId))
      .map((t) => ({ key: `${c.id}->${t.targetId}`, sourceId: c.id, targetId: t.targetId, relationship: t.relationship, question: t.question })),
  );
}

/** Threads touching the focused node or anything under it (both outgoing and incoming). */
export function threadsForFocus(threads: readonly ThreadEdge[], layout: MapLayout, focusId: string | null): ThreadEdge[] {
  if (!focusId || !layout.byId.has(focusId)) return [];
  const scope = subtreeIds(layout, focusId);
  return threads.filter((t) => scope.has(t.sourceId) || scope.has(t.targetId));
}

export interface VisibleThread extends ThreadEdge {
  lit: boolean;
}

/**
 * Thread edges to draw. Default (On-Focus Threads): only those of the hovered or selected node,
 * all lit, and none at all when nothing is focused. With "All threads" on: the full web, with the
 * focused node's threads lit.
 */
export function visibleThreads(
  threads: readonly ThreadEdge[],
  layout: MapLayout,
  focusId: string | null,
  showAll: boolean,
): VisibleThread[] {
  const focused = new Set(threadsForFocus(threads, layout, focusId).map((t) => t.key));
  const pool = showAll ? threads : threads.filter((t) => focused.has(t.key));
  return pool.map((t) => ({ ...t, lit: focused.has(t.key) }));
}

/** The node whose threads are lit: hover wins, then the open concept, then the open overview. */
export function threadFocus(hoveredId: string | null, selection: MapSelection): string | null {
  return hoveredId ?? selection.conceptId ?? selection.overview?.id ?? null;
}

// ---------- Auto-fit viewport ----------

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Font sizes and label offsets used by MindMap.tsx; kept here so the fit and the drawing agree. */
export const LABEL_METRICS = {
  conceptFont: 13,
  courseFont: 13,
  pillarFont: 16,
  conceptOffset: 12,
  courseOffset: 14,
  /** Average glyph width as a share of the font size; generous so bold hover labels still fit. */
  charWidth: 0.6,
  rootRadius: 46,
} as const;

export function estimateLabelWidth(label: string, fontSize: number): number {
  return label.length * fontSize * LABEL_METRICS.charWidth;
}

/** Extent of every node and its label, so the initial view never clips the outer concept ring. */
export function contentBounds(layout: MapLayout): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number) => {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  };
  for (const n of layout.nodes) {
    if (n.kind === 'root') {
      const r = LABEL_METRICS.rootRadius;
      add(n.x - r, n.y - r);
      add(n.x + r, n.y + r);
      continue;
    }
    if (n.kind === 'pillar') {
      const half = estimateLabelWidth(n.label, LABEL_METRICS.pillarFont) / 2;
      const ty = n.y + (n.y < 0 ? -22 : 34);
      add(n.x - half, ty - LABEL_METRICS.pillarFont);
      add(n.x + half, ty + 4);
      continue;
    }
    const concept = n.kind === 'concept';
    const font = concept ? LABEL_METRICS.conceptFont : LABEL_METRICS.courseFont;
    const offset = concept ? LABEL_METRICS.conceptOffset : LABEL_METRICS.courseOffset;
    const reach = offset + estimateLabelWidth(n.label, font);
    const rad = (n.angle * Math.PI) / 180;
    const ex = n.x + Math.cos(rad) * reach;
    const ey = n.y + Math.sin(rad) * reach;
    const half = font * 0.7;
    add(n.x - 10, n.y - 10);
    add(n.x + 10, n.y + 10);
    add(ex - half, ey - half);
    add(ex + half, ey + half);
  }
  return b;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Padded SVG viewBox around the content; with preserveAspectRatio "meet" the whole map shows at any size. */
export function fitViewBox(bounds: Bounds, padding = 28): ViewBox {
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  };
}

/** Pan/zoom transform for the fitted view: the identity, because the viewBox already frames the content. */
export const FIT_VIEW = { x: 0, y: 0, k: 1 } as const;

// ---------- Mastery and overviews ----------

export interface MasteryTally {
  mastered: number;
  reviewed: number;
  total: number;
}

export function masteryTally(conceptIds: readonly string[], mastery: MasteryMap): MasteryTally {
  let mastered = 0;
  let reviewed = 0;
  for (const id of conceptIds) {
    const level = mastery[id];
    if (level === 'mastered') mastered += 1;
    else if (level === 'reviewed') reviewed += 1;
  }
  return { mastered, reviewed, total: conceptIds.length };
}

export function levelOf(mastery: MasteryMap, id: string): MasteryLevel {
  return mastery[id] ?? 'new';
}

/** First sentence-ish slice of the $10K hook for list previews. */
export function hookPreview(hook: string, max = 140): string {
  const text = hook.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ---------- Browse tree ----------

export interface BrowseCourse {
  course: Course;
  concepts: ConceptNode[];
}

export interface BrowsePillar {
  pillar: Pillar;
  courses: BrowseCourse[];
}

/** Pillar → Course → Concept tree in catalog order. */
export function buildBrowseTree(
  pillars: readonly Pillar[],
  courses: readonly Course[],
  concepts: readonly ConceptNode[],
): BrowsePillar[] {
  return pillars.map((pillar) => ({
    pillar,
    courses: courses
      .filter((c) => c.pillarId === pillar.id)
      .map((course) => ({ course, concepts: concepts.filter((k) => k.courseCode === course.code) })),
  }));
}

/** Keep only concepts in `matching`, dropping courses and pillars left empty. */
export function filterBrowseTree(tree: readonly BrowsePillar[], matching: ReadonlySet<string>): BrowsePillar[] {
  return tree
    .map((p) => ({
      pillar: p.pillar,
      courses: p.courses
        .map((c) => ({ course: c.course, concepts: c.concepts.filter((k) => matching.has(k.id)) }))
        .filter((c) => c.concepts.length > 0),
    }))
    .filter((p) => p.courses.length > 0);
}

/** Course ids to expand so the current selection is visible in the tree. */
export function coursesToReveal(tree: readonly BrowsePillar[], selection: MapSelection): Set<string> {
  const out = new Set<string>();
  for (const p of tree) {
    for (const c of p.courses) {
      if (selection.overview?.kind === 'course' && selection.overview.id === c.course.id) out.add(c.course.id);
      if (selection.conceptId && c.concepts.some((k) => k.id === selection.conceptId)) out.add(c.course.id);
    }
  }
  return out;
}
