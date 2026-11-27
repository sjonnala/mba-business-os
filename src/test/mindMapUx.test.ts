import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BrowseTree } from '../components/BrowseSidebar';
import { ConceptDrawer } from '../components/ConceptDrawer';
import { MindMap } from '../components/MindMap';
import { OverviewPanel } from '../components/OverviewDrawer';
import { COURSES } from '../data/catalog';
import { CONCEPTS, conceptById, conceptsForCourse } from '../data/graph';
import { BROWSE_TREE, MAP_LAYOUT, MAP_THREADS, MAP_VIEWBOX } from '../data/mapLayout';
import { EMPTY_SELECTION, selectNode, threadsForFocus, type MapSelection, type NodeRef, type OverviewTarget } from '../lib/mapNavigation';
import type { MasteryMap } from '../lib/storage';
import { buttonBy, buttons, press, textOf } from './helpers/elementTree';

const count = (html: string, needle: string) => html.split(needle).length - 1;
const noop = () => undefined;
/** Server-render without React's text-boundary comments, so assertions read like the visible text. */
const render = (el: ReactElement) => renderToString(el).replaceAll('<!-- -->', '');

function renderMap(selection: MapSelection, extra: { defaultAllThreads?: boolean; defaultBrowseOpen?: boolean } = {}): string {
  return render(createElement(MindMap, { mastery: {}, selection, onSelectNode: noop, ...extra }));
}

function overview(target: OverviewTarget, mastery: MasteryMap = {}) {
  const onOpenConcept = vi.fn<(id: string) => void>();
  const onOpenCourse = vi.fn<(id: string) => void>();
  const onOpenPillar = vi.fn<(id: string) => void>();
  const tree = createElement(OverviewPanel, { target, mastery, onOpenConcept, onOpenCourse, onOpenPillar, onClose: noop });
  return { tree, onOpenConcept, onOpenCourse, onOpenPillar };
}

describe('MindMap: On-Focus Threads by default', () => {
  it('renders no thread edges on load and an unticked "All threads" checkbox', () => {
    const html = renderMap(EMPTY_SELECTION);
    expect(count(html, 'class="thread-edge')).toBe(0);
    expect(html).toContain('All threads');
    expect(html).toMatch(/<input type="checkbox" name="all-threads"\/>/);
  });

  it('renders only the selected concept\'s threads, lit', () => {
    const id = 'a500-05-cash-flow-fcf';
    const html = renderMap({ conceptId: id, overview: null });
    const expected = threadsForFocus(MAP_THREADS, MAP_LAYOUT, id).length;
    expect(expected).toBeGreaterThan(0);
    expect(count(html, 'class="thread-edge lit')).toBe(expected);
    expect(count(html, 'class="thread-edge')).toBe(expected);
  });

  it('renders the full global web only when All threads starts ticked', () => {
    const html = renderMap(EMPTY_SELECTION, { defaultAllThreads: true });
    expect(count(html, 'class="thread-edge')).toBe(MAP_THREADS.length);
  });
});

describe('MindMap: clickable hub, pillars and courses', () => {
  it('drops the Wave M1 dead-end toast and hint', () => {
    const html = renderMap(EMPTY_SELECTION);
    expect(html).not.toContain('see when it goes live');
    expect(html).not.toContain('course-note');
    expect(html).toContain('Click a pillar or course for its overview');
  });

  it('makes the hub, every pillar and every course a keyboard-reachable button', () => {
    const html = renderMap(EMPTY_SELECTION);
    expect(html).toContain('aria-label="MBA Business OS: reset the map and fit the whole view"');
    expect(count(html, 'pillar: open overview"')).toBe(5);
    expect(count(html, 'open course overview"')).toBe(COURSES.length);
  });

  it('highlights a focused course subtree and gently dims every other concept', () => {
    const sel = selectNode(EMPTY_SELECTION, { kind: 'course', id: 'ENTRE532' }, MAP_LAYOUT);
    const html = renderMap(sel);
    const own = conceptsForCourse('ENTRE 532').length;
    expect(count(html, 'node course live P4 selected')).toBe(1);
    expect(html.match(/class="node concept [a-z ]*faded"/g)?.length).toBe(CONCEPTS.length - own);
    expect(count(html, 'class="thread-edge lit')).toBe(threadsForFocus(MAP_THREADS, MAP_LAYOUT, 'ENTRE532').length);
  });

  it('highlights a whole pillar wedge', () => {
    const html = renderMap({ conceptId: null, overview: { kind: 'pillar', id: 'P1' } });
    const p1 = CONCEPTS.filter((c) => c.pillarId === 'P1').length;
    expect(html.match(/class="node concept [a-z ]*faded"/g)?.length).toBe(CONCEPTS.length - p1);
    expect(count(html, 'node pillar P1 selected')).toBe(1);
  });
});

describe('MindMap: auto-fit and browse sidebar', () => {
  it('uses the fitted viewBox and an identity view transform on load', () => {
    const html = renderMap(EMPTY_SELECTION);
    expect(html).toContain(`viewBox="${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}"`);
    expect(html).toContain('transform="translate(0 0) scale(1)"');
  });

  it('shows the browse sidebar with a toolbar toggle, and hides it when collapsed', () => {
    const open = renderMap(EMPTY_SELECTION);
    expect(open).toContain('aria-pressed="true"');
    expect(open).toContain('class="browse-tree"');
    expect(count(open, 'data-node="course:')).toBe(22);
    const closed = renderMap(EMPTY_SELECTION, { defaultBrowseOpen: false });
    expect(closed).toContain('Browse list');
    expect(closed).not.toContain('class="browse-tree"');
  });
});

describe('Course Overview Drawer', () => {
  const concepts = conceptsForCourse('ENTRE 532');

  it('shows the course, its pillar badge, mastery progress and every live concept with a hook preview', () => {
    const [first, second] = concepts;
    const mastery: MasteryMap = { [first?.id ?? '']: 'mastered', [second?.id ?? '']: 'reviewed' };
    const html = render(overview({ kind: 'course', id: 'ENTRE532' }, mastery).tree);
    expect(html).toContain('ENTRE 532 · Software Entrepreneurship');
    expect(html).toContain('AI Founder &amp; PM');
    expect(html).toContain(`1/${concepts.length}</strong>`);
    expect(count(html, 'class="overview-concept"')).toBe(concepts.length);
    expect(count(html, 'class="overview-hook"')).toBe(concepts.length);
    expect(html).toContain('>Mastered<');
    expect(html).toContain('>Reviewed<');
  });

  it('jumps straight into the Concept Drawer when a concept card is clicked', () => {
    const { tree, onOpenConcept } = overview({ kind: 'course', id: 'ENTRE532' });
    const target = concepts[2] ?? concepts[0];
    press(buttonBy(tree, 'data-concept-id', target?.id ?? ''));
    expect(onOpenConcept).toHaveBeenCalledWith(target?.id);

    // The app then opens that concept and keeps the course overview for the Back link.
    const course = selectNode(EMPTY_SELECTION, { kind: 'course', id: 'ENTRE532' }, MAP_LAYOUT);
    const next = selectNode(course, { kind: 'concept', id: target?.id ?? '' }, MAP_LAYOUT);
    expect(next.conceptId).toBe(target?.id);
    expect(next.overview).toEqual({ kind: 'course', id: 'ENTRE532' });
  });

  it('opens the pillar overview from the pillar badge', () => {
    const { tree, onOpenPillar } = overview({ kind: 'course', id: 'ENTRE532' });
    const badge = buttons(tree).find((b) => textOf(b).includes('AI Founder & PM'));
    expect(badge).toBeDefined();
    if (badge) press(badge);
    expect(onOpenPillar).toHaveBeenCalledWith('P4');
  });
});

describe('Pillar Overview Drawer', () => {
  it('lists every course in the pillar with its concepts and pillar-wide progress', () => {
    const html = render(overview({ kind: 'pillar', id: 'P4' }).tree);
    const courses = COURSES.filter((c) => c.pillarId === 'P4');
    const concepts = CONCEPTS.filter((c) => c.pillarId === 'P4');
    expect(html).toContain('SWE → AI Founder &amp; Strategic PM');
    expect(count(html, 'class="overview-course"')).toBe(courses.length);
    expect(count(html, 'class="overview-concept"')).toBe(concepts.length);
    expect(html).toContain(`0/${concepts.length}</strong>`);
  });

  it('opens a course overview or a concept in one click', () => {
    const { tree, onOpenCourse, onOpenConcept } = overview({ kind: 'pillar', id: 'P4' });
    press(buttonBy(tree, 'data-course-id', 'MKTG554'));
    expect(onOpenCourse).toHaveBeenCalledWith('MKTG554');
    const id = conceptsForCourse('MKTG 554')[0]?.id ?? '';
    press(buttonBy(tree, 'data-concept-id', id));
    expect(onOpenConcept).toHaveBeenCalledWith(id);
  });
});

describe('Browse tree navigation', () => {
  function tree(expanded: string[], filtering = false, selection: MapSelection = EMPTY_SELECTION) {
    const onSelect = vi.fn<(node: NodeRef) => void>();
    const onToggleCourse = vi.fn<(id: string) => void>();
    const el = createElement(BrowseTree, {
      tree: BROWSE_TREE,
      mastery: {},
      selection,
      expanded: new Set(expanded),
      filtering,
      onToggleCourse,
      onSelect,
    });
    return { el, onSelect, onToggleCourse };
  }

  it('opens pillar and course overviews in one click', () => {
    const { el, onSelect } = tree([]);
    press(buttonBy(el, 'data-node', 'pillar:P3'));
    press(buttonBy(el, 'data-node', 'course:MGMT502'));
    expect(onSelect.mock.calls).toEqual([[{ kind: 'pillar', id: 'P3' }], [{ kind: 'course', id: 'MGMT502' }]]);
  });

  it('expands a course with its chevron and opens a concept in one click', () => {
    const collapsed = tree([]);
    press(buttonBy(collapsed.el, 'data-toggle', 'ACCTG500'));
    expect(collapsed.onToggleCourse).toHaveBeenCalledWith('ACCTG500');
    expect(buttons(collapsed.el).filter((b) => String(b.props['data-node']).startsWith('concept:'))).toHaveLength(0);

    const open = tree(['ACCTG500']);
    const acctg = conceptsForCourse('ACCTG 500');
    const conceptButtons = buttons(open.el).filter((b) => String(b.props['data-node']).startsWith('concept:'));
    expect(conceptButtons).toHaveLength(acctg.length);
    const id = acctg[1]?.id ?? '';
    press(buttonBy(open.el, 'data-node', `concept:${id}`));
    expect(open.onSelect).toHaveBeenCalledWith({ kind: 'concept', id });
  });

  it('marks the current course and concept', () => {
    const id = conceptsForCourse('ENTRE 532')[0]?.id ?? '';
    const html = render(tree(['ENTRE532'], false, { conceptId: id, overview: { kind: 'course', id: 'ENTRE532' } }).el);
    expect(count(html, 'aria-current="true"')).toBe(2);
  });
});

describe('Concept Drawer back link', () => {
  it('offers a way back to the overview it was opened from', () => {
    const concept = conceptById(conceptsForCourse('ENTRE 532')[0]?.id ?? '');
    expect(concept).toBeDefined();
    if (!concept) return;
    const onBack = vi.fn<() => void>();
    const html = render(
      createElement(ConceptDrawer, {
        concept,
        level: 'new',
        onToggleMastery: noop,
        onNavigate: noop,
        onLogRoutine: noop,
        onClose: noop,
        backLabel: 'Back to ENTRE 532 overview',
        onBack,
      }),
    );
    expect(html).toContain('← Back to ENTRE 532 overview');
  });
});
