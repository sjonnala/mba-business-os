import { useMemo, useState } from 'react';
import { coursesToReveal, filterBrowseTree, levelOf, masteryTally, type BrowsePillar, type MapSelection, type NodeRef } from '../lib/mapNavigation';
import type { MasteryMap } from '../lib/storage';

interface BrowseTreeProps {
  tree: readonly BrowsePillar[];
  mastery: MasteryMap;
  selection: MapSelection;
  expanded: ReadonlySet<string>;
  filtering: boolean;
  onToggleCourse: (courseId: string) => void;
  onSelect: (node: NodeRef) => void;
}

/**
 * Pillar → Course → Concept list. Pillar and course rows open their overview drawers in one click;
 * the chevron reveals a course's concepts, each of which opens its concept drawer in one click.
 * Hookless so tests can render it and press its buttons.
 */
export function BrowseTree({ tree, mastery, selection, expanded, filtering, onToggleCourse, onSelect }: BrowseTreeProps) {
  if (tree.length === 0) return <p className="browse-empty">No concepts match.</p>;
  const isCurrent = (kind: 'pillar' | 'course', id: string) => selection.overview?.kind === kind && selection.overview.id === id;
  return (
    <ul className="browse-tree" aria-label="Pillars, courses and concepts">
      {tree.map(({ pillar, courses }) => {
        const tally = masteryTally(courses.flatMap((c) => c.concepts.map((k) => k.id)), mastery);
        return (
          <li key={pillar.id} className={`browse-pillar ${pillar.id}`}>
            <button
              type="button"
              className={`browse-row pillar-row${isCurrent('pillar', pillar.id) ? ' current' : ''}`}
              aria-current={isCurrent('pillar', pillar.id) ? 'true' : undefined}
              data-node={`pillar:${pillar.id}`}
              onClick={() => onSelect({ kind: 'pillar', id: pillar.id })}
            >
              <span className="badge-dot" aria-hidden="true" />
              <span className="browse-label">{pillar.shortName}</span>
              <span className="browse-count">
                {tally.mastered}/{tally.total}
              </span>
            </button>
            <ul>
              {courses.map(({ course, concepts }) => {
                const open = filtering || expanded.has(course.id);
                const ct = masteryTally(concepts.map((k) => k.id), mastery);
                return (
                  <li key={course.id} className="browse-course">
                    <div className="browse-course-row">
                      <button
                        type="button"
                        className="browse-chevron"
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} ${course.code} concepts`}
                        data-toggle={course.id}
                        disabled={filtering}
                        onClick={() => onToggleCourse(course.id)}
                      >
                        {open ? '▾' : '▸'}
                      </button>
                      <button
                        type="button"
                        className={`browse-row course-row${isCurrent('course', course.id) ? ' current' : ''}`}
                        aria-current={isCurrent('course', course.id) ? 'true' : undefined}
                        title={course.title}
                        data-node={`course:${course.id}`}
                        onClick={() => onSelect({ kind: 'course', id: course.id })}
                      >
                        <span className="browse-label">{course.code}</span>
                        <span className="browse-count">
                          {ct.mastered}/{ct.total}
                        </span>
                      </button>
                    </div>
                    {open && (
                      <ul className="browse-concepts">
                        {concepts.map((k) => {
                          const level = levelOf(mastery, k.id);
                          const current = selection.conceptId === k.id;
                          return (
                            <li key={k.id}>
                              <button
                                type="button"
                                className={`browse-row concept-row${current ? ' current' : ''}`}
                                aria-current={current ? 'true' : undefined}
                                data-node={`concept:${k.id}`}
                                onClick={() => onSelect({ kind: 'concept', id: k.id })}
                              >
                                <span className={`level-dot ${level}`} aria-hidden="true" />
                                <span className="browse-label">{k.title}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

interface BrowseSidebarProps {
  tree: readonly BrowsePillar[];
  mastery: MasteryMap;
  selection: MapSelection;
  /** Concepts matching the map's search and tag filter, or null when no filter is set. */
  matching: ReadonlySet<string> | null;
  onSelect: (node: NodeRef) => void;
}

function withMember(set: ReadonlySet<string>, id: string, member: boolean): ReadonlySet<string> {
  const next = new Set(set);
  if (member) next.add(id);
  else next.delete(id);
  return next;
}

/** Collapsible left sidebar beside the radial map. */
export function BrowseSidebar({ tree, mastery, selection, matching, onSelect }: BrowseSidebarProps) {
  // Courses the user opened and closed by hand; the selection's course is opened on top of these.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = useMemo(() => (matching ? filterBrowseTree(tree, matching) : tree), [tree, matching]);
  const revealed = useMemo(() => {
    const out = new Set(opened);
    for (const id of coursesToReveal(tree, selection)) out.add(id);
    for (const id of closed) out.delete(id);
    return out;
  }, [opened, closed, tree, selection]);

  const toggle = (courseId: string) => {
    const wasOpen = revealed.has(courseId);
    setOpened((prev) => withMember(prev, courseId, !wasOpen));
    setClosed((prev) => withMember(prev, courseId, wasOpen));
  };

  return (
    <nav className="browse" aria-label="Browse pillars, courses and concepts">
      <p className="browse-head">Browse</p>
      <BrowseTree
        tree={shown}
        mastery={mastery}
        selection={selection}
        expanded={revealed}
        filtering={matching !== null}
        onToggleCourse={toggle}
        onSelect={onSelect}
      />
    </nav>
  );
}
