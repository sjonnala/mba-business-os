import { useEffect, useState } from 'react';
import { CONCEPTS, conceptById } from '../data/graph';
import { routineToMarkdown } from '../lib/routineMarkdown';
import type { RoutineEntry } from '../lib/storage';

interface RoutineScratchpadProps {
  entries: RoutineEntry[];
  onSave: (entry: RoutineEntry) => void;
  onDelete: (id: string) => void;
  initialConceptId: string | null;
}

const ROUTINE_SECONDS = 5 * 60;

const PROMPTS: { key: 'explain' | 'example' | 'thread' | 'question'; label: string; hint: string }[] = [
  { key: 'explain', label: '1. Explain it in one sentence', hint: 'As if to a smart friend with no accounting background.' },
  { key: 'example', label: '2. One real company or number', hint: 'A 10-K line, a case figure, or your own work.' },
  { key: 'thread', label: '3. The thread you pulled', hint: 'How it links to another concept or course.' },
  { key: 'question', label: '4. Your boardroom question', hint: 'The question you would ask a CFO tomorrow.' },
];

function newId(): string {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RoutineScratchpad({ entries, onSave, onDelete, initialConceptId }: RoutineScratchpadProps) {
  const [conceptId, setConceptId] = useState(initialConceptId ?? CONCEPTS[0]?.id ?? '');
  const [draft, setDraft] = useState({ explain: '', example: '', thread: '', question: '' });
  const [remaining, setRemaining] = useState(ROUTINE_SECONDS);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (initialConceptId) setConceptId(initialConceptId);
  }, [initialConceptId]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const titleFor = (id: string) => conceptById(id)?.title ?? id;
  const canSave = Object.values(draft).some((v) => v.trim() !== '');

  const save = () => {
    if (!canSave) return;
    onSave({ id: newId(), createdAt: new Date().toISOString(), conceptId, ...draft });
    setDraft({ explain: '', example: '', thread: '', question: '' });
    setRunning(false);
    setRemaining(ROUTINE_SECONDS);
    setNotice('Saved to this browser.');
  };

  const exportMarkdown = () => {
    const md = routineToMarkdown(entries, titleFor);
    try {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${new Date().toISOString().slice(0, 10)}-mba-routine-log.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Markdown downloaded.');
    } catch {
      setNotice('Download is blocked here; use Copy instead.');
    }
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(routineToMarkdown(entries, titleFor));
      setNotice('Markdown copied.');
    } catch {
      setNotice('Clipboard is blocked here; use Download instead.');
    }
  };

  const concept = conceptById(conceptId);

  return (
    <section className="routine" aria-label="Five-minute routine scratchpad">
      <div className="routine-card">
        <div className="routine-head">
          <div>
            <h2>5-minute routine</h2>
            <p className="muted">Pick one concept, answer four prompts, save. Small and daily beats long and rare.</p>
          </div>
          <div className={`timer${remaining === 0 ? ' done' : ''}`} aria-live="polite">
            <span>{mmss(remaining)}</span>
            <div className="timer-buttons">
              <button type="button" onClick={() => setRunning((r) => !r)} disabled={remaining === 0}>
                {running ? 'Pause' : 'Start'}
              </button>
              <button type="button" className="ghost" onClick={() => { setRunning(false); setRemaining(ROUTINE_SECONDS); }}>
                Reset
              </button>
            </div>
          </div>
        </div>

        <label className="field">
          <span>Concept</span>
          <select value={conceptId} onChange={(e) => setConceptId(e.target.value)}>
            {CONCEPTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        {concept && <p className="hook-preview">{concept.hook10k}</p>}

        {PROMPTS.map((p) => (
          <label key={p.key} className="field">
            <span>{p.label}</span>
            <textarea
              rows={2}
              placeholder={p.hint}
              value={draft[p.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="routine-actions">
          <button type="button" className="primary" onClick={save} disabled={!canSave}>
            Save entry
          </button>
          <span className="notice" role="status">
            {notice}
          </span>
        </div>
      </div>

      <div className="routine-log">
        <div className="routine-head">
          <h3>Log ({entries.length})</h3>
          <div className="timer-buttons">
            <button type="button" onClick={exportMarkdown}>
              Export Markdown
            </button>
            <button type="button" className="ghost" onClick={() => void copyMarkdown()}>
              Copy
            </button>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="muted">No entries yet. Your first one takes five minutes.</p>
        ) : (
          <ol className="entries">
            {[...entries]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((e) => (
                <li key={e.id}>
                  <div className="entry-head">
                    <strong>{titleFor(e.conceptId)}</strong>
                    <time dateTime={e.createdAt}>{e.createdAt.slice(0, 10)}</time>
                  </div>
                  {e.explain && <p>{e.explain}</p>}
                  {e.example && <p className="muted">Example: {e.example}</p>}
                  {e.thread && <p className="muted">Thread: {e.thread}</p>}
                  {e.question && <p className="muted">Question: {e.question}</p>}
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => {
                      if (window.confirm('Delete this entry?')) onDelete(e.id);
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}
