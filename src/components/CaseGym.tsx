import { useEffect, useMemo, useState } from 'react';
import { COURSES, PILLARS } from '../data/catalog';
import { conceptById } from '../data/graph';
import {
  ALL_FILTER,
  DRILL_SECONDS,
  dueLabel,
  filterDrills,
  gymStats,
  orderQueue,
  type Drill,
  type Grade,
  type GymFilter,
  type GymProgress,
} from '../lib/caseGym';
import { DIFFICULTIES, type Difficulty, type PillarId } from '../schema/knowledgeGraph';

interface CaseGymProps {
  drills: readonly Drill[];
  progress: GymProgress;
  onGrade: (drillId: string, grade: Grade) => void;
  onOpenConcept: (conceptId: string) => void;
  /** Injected for tests and to keep render pure; defaults to the wall clock. */
  now?: number;
}

const GRADE_BUTTONS: { grade: Grade; label: string; hint: string }[] = [
  { grade: 'again', label: 'Again', hint: 'Missed it. See it tomorrow.' },
  { grade: 'good', label: 'Good', hint: 'Got it with effort.' },
  { grade: 'easy', label: 'Easy', hint: 'Instant. Push it further out.' },
];

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CaseGym({ drills, progress, onGrade, onOpenConcept, now }: CaseGymProps) {
  const [filter, setFilter] = useState<GymFilter>(ALL_FILTER);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DRILL_SECONDS);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [clock, setClock] = useState(() => now ?? Date.now());

  const at = now ?? clock;
  const filtered = useMemo(() => filterDrills(drills, filter), [drills, filter]);
  const queue = useMemo(() => orderQueue(filtered, progress, at), [filtered, progress, at]);
  const stats = useMemo(() => gymStats(filtered, progress, at), [filtered, progress, at]);
  const current = queue.find((d) => d.id === currentId) ?? queue[0];

  const courseOptions = useMemo(
    () => COURSES.filter((c) => (filter.pillar === 'all' || c.pillarId === filter.pillar) && drills.some((d) => d.courseCode === c.code)),
    [drills, filter.pillar],
  );

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setRevealed(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const startDrill = (id: string | null) => {
    setCurrentId(id);
    setRemaining(DRILL_SECONDS);
    setRunning(false);
    setRevealed(false);
  };

  const updateFilter = (patch: Partial<GymFilter>) => {
    setFilter((f) => {
      const next = { ...f, ...patch };
      if (patch.pillar && next.course !== 'all' && !COURSES.some((c) => c.code === next.course && (patch.pillar === 'all' || c.pillarId === patch.pillar))) {
        next.course = 'all';
      }
      return next;
    });
    startDrill(null);
  };

  const grade = (g: Grade) => {
    if (!current) return;
    onGrade(current.id, g);
    const nextAt = now ?? Date.now();
    setClock(nextAt);
    const after = queue.filter((d) => d.id !== current.id);
    startDrill(after[0]?.id ?? null);
  };

  const concept = current ? conceptById(current.relatedConceptId) : undefined;

  return (
    <section className="gym" aria-label="Spaced-repetition Case Gym">
      <div className="gym-card">
        <div className="routine-head">
          <div>
            <h2>Case Gym</h2>
            <p className="muted">
              Three minutes per drill. Answer out loud, reveal the CFO or founder answer and the trap, then grade yourself. Spaced repetition brings
              back what you miss.
            </p>
          </div>
          <div className={`timer${remaining === 0 ? ' done' : ''}`} aria-live="polite">
            <span>{mmss(remaining)}</span>
            <div className="timer-buttons">
              <button type="button" onClick={() => setRunning((r) => !r)} disabled={remaining === 0 || !current}>
                {running ? 'Pause' : 'Start'}
              </button>
              <button type="button" className="ghost" onClick={() => { setRunning(false); setRemaining(DRILL_SECONDS); }}>
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="gym-filters">
          <label className="field">
            <span>Pillar</span>
            <select value={filter.pillar} onChange={(e) => updateFilter({ pillar: e.target.value as PillarId | 'all' })}>
              <option value="all">All pillars</option>
              {PILLARS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Course</span>
            <select value={filter.course} onChange={(e) => updateFilter({ course: e.target.value })}>
              <option value="all">All courses</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Difficulty</span>
            <select value={filter.difficulty} onChange={(e) => updateFilter({ difficulty: e.target.value as Difficulty | 'all' })}>
              <option value="all">All levels</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="gym-stats" aria-live="polite">
          {stats.total} drills · {stats.due} due now · {stats.reviewed} reviewed · {stats.mature} mature
        </p>

        {!current && <p className="muted">No drills match these filters.</p>}

        {current && (
          <article className="drill" aria-labelledby="drill-title">
            <p className="eyebrow">
              {current.pillarId} · {current.courseCode} · {current.difficulty} · {dueLabel(progress[current.id], at)}
            </p>
            <h3 id="drill-title">{current.title}</h3>
            <p className="drill-scenario">{current.scenario}</p>
            <p className="drill-question">
              <strong>{current.question}</strong>
            </p>

            {!revealed && (
              <button type="button" onClick={() => { setRevealed(true); setRunning(false); }}>
                Reveal answer and trap
              </button>
            )}

            {revealed && (
              <div className="drill-reveal">
                <section>
                  <h4>CFO or founder answer</h4>
                  <p>{current.cfoFounderAnswer}</p>
                </section>
                <section className="drill-trap">
                  <h4>Anti-pattern trap</h4>
                  <p>{current.antiPatternTrap}</p>
                </section>
                <div className="grade-buttons" role="group" aria-label="Grade your answer">
                  {GRADE_BUTTONS.map((b) => (
                    <button key={b.grade} type="button" className={`grade-${b.grade}`} onClick={() => grade(b.grade)} title={b.hint}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="drill-concept">
              Linked concept:{' '}
              <button type="button" className="link" onClick={() => onOpenConcept(current.relatedConceptId)}>
                {concept?.title ?? current.relatedConceptId}
              </button>
            </p>
          </article>
        )}
      </div>

      <aside className="gym-queue" aria-label="Up next">
        <h3>Up next</h3>
        <ol>
          {queue.slice(0, 12).map((d) => (
            <li key={d.id} className={current && d.id === current.id ? 'on' : undefined}>
              <button type="button" className="link" onClick={() => startDrill(d.id)}>
                {d.title}
              </button>
              <span className="muted">
                {d.courseCode} · {dueLabel(progress[d.id], at)}
              </span>
            </li>
          ))}
        </ol>
        {queue.length > 12 && <p className="muted">and {queue.length - 12} more in this filter.</p>}
      </aside>
    </section>
  );
}
