import { useEffect } from 'react';
import { COURSES, PILLARS } from '../data/catalog';
import { conceptsForCourse } from '../data/graph';
import { hookPreview, levelOf, masteryTally, type MasteryTally, type OverviewTarget } from '../lib/mapNavigation';
import type { MasteryMap } from '../lib/storage';
import type { ConceptNode } from '../schema/knowledgeGraph';

interface OverviewProps {
  target: OverviewTarget;
  mastery: MasteryMap;
  onOpenConcept: (id: string) => void;
  onOpenCourse: (id: string) => void;
  onOpenPillar: (id: string) => void;
  onClose: () => void;
}

const LEVEL_LABEL = { new: 'New', reviewed: 'Reviewed', mastered: 'Mastered' } as const;

function TallyBar({ tally }: { tally: MasteryTally }) {
  const pct = (n: number) => (tally.total > 0 ? (n / tally.total) * 100 : 0);
  return (
    <div className="overview-tally">
      <div className="progress-bar" aria-hidden="true">
        <span className="bar-mastered" style={{ width: `${pct(tally.mastered)}%` }} />
        <span className="bar-reviewed" style={{ width: `${pct(tally.reviewed)}%` }} />
      </div>
      <span>
        <strong>
          {tally.mastered}/{tally.total}
        </strong>{' '}
        mastered · {tally.reviewed} reviewed
      </span>
    </div>
  );
}

interface ConceptListProps {
  concepts: readonly ConceptNode[];
  mastery: MasteryMap;
  withHook: boolean;
  onOpenConcept: (id: string) => void;
}

/** Clickable concept cards; each opens the full 5-part / 8-lens concept drawer. */
export function OverviewConceptList({ concepts, mastery, withHook, onOpenConcept }: ConceptListProps) {
  if (concepts.length === 0) return <p className="overview-empty">No live concepts yet.</p>;
  return (
    <ul className={`overview-concepts${withHook ? '' : ' compact'}`}>
      {concepts.map((c) => {
        const level = levelOf(mastery, c.id);
        return (
          <li key={c.id}>
            <button type="button" className="overview-concept" data-concept-id={c.id} onClick={() => onOpenConcept(c.id)}>
              <span className="overview-concept-head">
                <span className={`level-dot ${level}`} aria-hidden="true" />
                <span className="overview-concept-title">{c.title}</span>
                <span className={`level-tag ${level}`}>{LEVEL_LABEL[level]}</span>
              </span>
              {withHook && <span className="overview-hook">{hookPreview(c.hook10k)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Drawer body for a course or pillar. Hookless so tests can render it and press its buttons. */
export function OverviewPanel({ target, mastery, onOpenConcept, onOpenCourse, onOpenPillar, onClose }: OverviewProps) {
  if (target.kind === 'course') {
    const course = COURSES.find((c) => c.id === target.id);
    if (!course) return null;
    const pillar = PILLARS.find((p) => p.id === course.pillarId);
    const concepts = conceptsForCourse(course.code);
    return (
      <aside className="drawer overview" aria-label={`Course overview: ${course.code}`}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Course overview</p>
            <h2>
              {course.code} · {course.title}
            </h2>
            {pillar && (
              <button type="button" className={`pillar-badge ${pillar.id}`} onClick={() => onOpenPillar(pillar.id)}>
                <span className="badge-dot" aria-hidden="true" />
                {pillar.shortName}
              </button>
            )}
          </div>
          <button type="button" className="icon" onClick={onClose} aria-label="Close overview">
            ×
          </button>
        </header>
        <TallyBar tally={masteryTally(concepts.map((c) => c.id), mastery)} />
        <section className="overview-section">
          <h3>
            {concepts.length} live concept{concepts.length === 1 ? '' : 's'}
          </h3>
          <OverviewConceptList concepts={concepts} mastery={mastery} withHook onOpenConcept={onOpenConcept} />
        </section>
      </aside>
    );
  }

  const pillar = PILLARS.find((p) => p.id === target.id);
  if (!pillar) return null;
  const courses = COURSES.filter((c) => c.pillarId === pillar.id);
  const allIds = courses.flatMap((c) => conceptsForCourse(c.code).map((k) => k.id));
  return (
    <aside className={`drawer overview ${pillar.id}`} aria-label={`Pillar overview: ${pillar.name}`}>
      <header className="drawer-head">
        <div>
          <p className="eyebrow">
            Pillar overview · Wave {pillar.wave} · {pillar.depthNote}
          </p>
          <h2>{pillar.name}</h2>
          <p className="overview-sub">
            {courses.length} course{courses.length === 1 ? '' : 's'} · {allIds.length} live concepts
          </p>
        </div>
        <button type="button" className="icon" onClick={onClose} aria-label="Close overview">
          ×
        </button>
      </header>
      <TallyBar tally={masteryTally(allIds, mastery)} />
      {courses.map((course) => {
        const concepts = conceptsForCourse(course.code);
        const tally = masteryTally(concepts.map((c) => c.id), mastery);
        return (
          <section key={course.id} className="overview-section">
            <button type="button" className="overview-course" data-course-id={course.id} onClick={() => onOpenCourse(course.id)}>
              <span className="overview-course-code">{course.code}</span>
              <span className="overview-course-title">{course.title}</span>
              <span className="overview-course-count">
                {tally.mastered}/{tally.total}
              </span>
            </button>
            <OverviewConceptList concepts={concepts} mastery={mastery} withHook={false} onOpenConcept={onOpenConcept} />
          </section>
        );
      })}
    </aside>
  );
}

/** Course / Pillar Overview Drawer: the panel plus Escape-to-close. */
export function OverviewDrawer(props: OverviewProps) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <OverviewPanel {...props} />;
}
