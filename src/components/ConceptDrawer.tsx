import { useEffect, useState } from 'react';
import { COURSES, comingLabel } from '../data/catalog';
import { conceptById } from '../data/graph';
import type { MasteryLevel } from '../lib/storage';
import { LENS_KEYS, LENS_LABELS, LOW_SIGNAL_LABEL, type ConceptNode, type LensKey } from '../schema/knowledgeGraph';

interface ConceptDrawerProps {
  concept: ConceptNode;
  level: MasteryLevel;
  onToggleMastery: (target: Exclude<MasteryLevel, 'new'>) => void;
  onNavigate: (id: string) => void;
  onLogRoutine: (id: string) => void;
  onClose: () => void;
}

export function ConceptDrawer({ concept, level, onToggleMastery, onNavigate, onLogRoutine, onClose }: ConceptDrawerProps) {
  const [lens, setLens] = useState<LensKey | 'all'>('all');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shownLenses = lens === 'all' ? LENS_KEYS : [lens];

  return (
    <aside className="drawer" aria-label={`Concept: ${concept.title}`}>
      <header className="drawer-head">
        <div>
          <p className="eyebrow">
            {concept.courseCode} · {concept.difficulty}
          </p>
          <h2>{concept.title}</h2>
          <ul className="tags">
            {concept.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <button type="button" className="icon" onClick={onClose} aria-label="Close concept">
          ×
        </button>
      </header>

      <div className="mastery-row" role="group" aria-label="Mastery">
        <button type="button" className={level === 'reviewed' ? 'on reviewed' : ''} aria-pressed={level === 'reviewed'} onClick={() => onToggleMastery('reviewed')}>
          Mark reviewed
        </button>
        <button type="button" className={level === 'mastered' ? 'on mastered' : ''} aria-pressed={level === 'mastered'} onClick={() => onToggleMastery('mastered')}>
          Mark mastered
        </button>
        <button type="button" className="ghost" onClick={() => onLogRoutine(concept.id)}>
          Log in routine
        </button>
      </div>

      <section className="block hook">
        <h3>The $10K hook</h3>
        <p>{concept.hook10k}</p>
      </section>

      <section className="block">
        <h3>The 20/80</h3>
        <p>{concept.pareto20_80.summary}</p>
        <ul>
          {concept.pareto20_80.keyPoints.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <dl className="formulas">
          {concept.pareto20_80.formulas.map((f) => (
            <div key={f.name}>
              <dt>{f.name}</dt>
              <dd>
                <code>{f.expression}</code>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="block">
        <h3>Reality check</h3>
        <ul>
          {concept.realityCheck.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h3>8 lenses</h3>
        <div className="chips" role="group" aria-label="Filter lenses">
          <button type="button" className={lens === 'all' ? 'chip on' : 'chip'} aria-pressed={lens === 'all'} onClick={() => setLens('all')}>
            All
          </button>
          {LENS_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${lens === k ? ' on' : ''}${concept.lenses[k] === null ? ' muted' : ''}`}
              aria-pressed={lens === k}
              onClick={() => setLens(k)}
            >
              {LENS_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="lenses">
          {shownLenses.map((k) => {
            const text = concept.lenses[k];
            return (
              <article key={k} className={text === null ? 'lens low' : 'lens'}>
                <h4>{LENS_LABELS[k]}</h4>
                <p>{text ?? LOW_SIGNAL_LABEL}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="block">
        <h3>Threads to pull</h3>
        <ul className="threads">
          {concept.threadsToPull.map((t) => {
            const target = conceptById(t.targetId);
            const course = target ? undefined : COURSES.find((c) => c.id === t.targetId);
            return (
              <li key={t.targetId}>
                <span className={`rel ${t.relationship}`}>{t.relationship}</span>
                {target ? (
                  <button type="button" className="link" onClick={() => onNavigate(target.id)}>
                    {target.title}
                  </button>
                ) : (
                  <span className="course-ref">
                    {course?.code ?? t.targetId}
                    {course && <span className={`pill ${course.status}`}>{comingLabel(course)}</span>}
                  </span>
                )}
                <p>{t.question}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="block drill">
        <h3>Boardroom drill</h3>
        <p className="eyebrow">{concept.boardroomDrill.companyOrScenario}</p>
        <p>{concept.boardroomDrill.prompt}</p>
        {revealed ? (
          <div className="answer">
            <h4>CFO answer</h4>
            <p>{concept.boardroomDrill.cfoAnswer}</p>
            <p className="takeaway">
              <strong>Key takeaway:</strong> {concept.boardroomDrill.keyTakeaway}
            </p>
          </div>
        ) : (
          <button type="button" className="primary" onClick={() => setRevealed(true)}>
            Reveal the CFO answer
          </button>
        )}
      </section>

      <section className="block sources">
        <h3>Sources</h3>
        <ul>
          {concept.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
