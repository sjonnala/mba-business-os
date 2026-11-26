import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { COURSES, PILLARS, comingLabel } from '../data/catalog';
import { ALL_TAGS, CONCEPTS } from '../data/graph';
import { conceptMatches, layoutMindMap, type MapNode } from '../lib/mindMapLayout';
import type { MasteryMap } from '../lib/storage';
import type { Course } from '../schema/knowledgeGraph';

interface MindMapProps {
  mastery: MasteryMap;
  selectedId: string | null;
  onSelectConcept: (id: string) => void;
}

interface View {
  x: number;
  y: number;
  k: number;
}

const VIEWBOX = 1500;
const MIN_K = 0.4;
const MAX_K = 4;
const INITIAL_VIEW: View = { x: 0, y: 40, k: 0.95 };

function clampK(k: number): number {
  return Math.min(MAX_K, Math.max(MIN_K, k));
}

/** Text placement for radial labels so they never read upside down. */
function radialLabel(node: MapNode, offset: number): { transform: string; anchor: 'start' | 'end' } {
  const flip = Math.cos((node.angle * Math.PI) / 180) < 0;
  const rotate = flip ? node.angle + 180 : node.angle;
  const dx = flip ? -offset : offset;
  return { transform: `translate(${node.x} ${node.y}) rotate(${rotate}) translate(${dx} 0)`, anchor: flip ? 'end' : 'start' };
}

export function MindMap({ mastery, selectedId, onSelectConcept }: MindMapProps) {
  const layout = useMemo(() => layoutMindMap(PILLARS, COURSES, CONCEPTS), []);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [showThreads, setShowThreads] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [courseNote, setCourseNote] = useState<Course | null>(null);
  const drag = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const matching = useMemo(
    () => new Set(CONCEPTS.filter((c) => conceptMatches(c, query, tag)).map((c) => c.id)),
    [query, tag],
  );
  const filtering = query.trim() !== '' || tag !== '';

  const reviewed = CONCEPTS.filter((c) => mastery[c.id] === 'reviewed').length;
  const mastered = CONCEPTS.filter((c) => mastery[c.id] === 'mastered').length;

  // Wheel zoom around the pointer. A native listener is needed so preventDefault works.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      setView((v) => {
        const k = clampK(v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
        const ratio = k / v.k;
        return { k, x: pt.x - (pt.x - v.x) * ratio, y: pt.y - (pt.y - v.y) * ratio };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y, moved: false };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const scale = svg.getScreenCTM()?.a ?? 1;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) {
      d.moved = true;
      svg.setPointerCapture(e.pointerId);
    }
    if (d.moved) setView((v) => ({ ...v, x: d.viewX + dx, y: d.viewY + dy }));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    suppressClick.current = drag.current?.moved ?? false;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  const activate = (node: MapNode) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (node.kind === 'concept') {
      setCourseNote(null);
      onSelectConcept(node.id);
    } else if (node.kind === 'course') {
      setCourseNote(COURSES.find((c) => c.id === node.id) ?? null);
    }
  };
  const onNodeKey = (e: KeyboardEvent<SVGGElement>, node: MapNode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      suppressClick.current = false;
      activate(node);
    }
  };

  const zoomBy = (factor: number) => setView((v) => {
    const k = clampK(v.k * factor);
    return { k, x: v.x * (k / v.k), y: v.y * (k / v.k) };
  });

  const treeEdges = layout.nodes.filter((n) => n.parentId !== null);
  const focusId = hovered ?? selectedId;

  const threadEdges = showThreads
    ? CONCEPTS.flatMap((c) =>
        c.threadsToPull.flatMap((t) => {
          const from = layout.byId.get(c.id);
          const to = layout.byId.get(t.targetId);
          if (!from || !to) return [];
          const mx = (from.x + to.x) * 0.3;
          const my = (from.y + to.y) * 0.3;
          const lit = focusId === c.id || focusId === t.targetId;
          const dim = filtering && !matching.has(c.id);
          return [{ key: `${c.id}->${t.targetId}`, d: `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`, lit, dim, title: `${t.relationship}: ${t.question}` }];
        }),
      )
    : [];

  return (
    <section className="mindmap" aria-label="Knowledge mind map">
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search concepts (e.g. deferred revenue)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search concepts"
        />
        <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {ALL_TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={showThreads} onChange={(e) => setShowThreads(e.target.checked)} />
          Thread edges
        </label>
        <div className="zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setView(INITIAL_VIEW)}>Reset</button>
        </div>
      </div>

      <div className="progress" aria-live="polite">
        <div className="progress-bar" aria-hidden="true">
          <span className="bar-mastered" style={{ width: `${(mastered / CONCEPTS.length) * 100}%` }} />
          <span className="bar-reviewed" style={{ width: `${(reviewed / CONCEPTS.length) * 100}%` }} />
        </div>
        <span>
          Live concepts: <strong>{mastered}</strong> mastered · <strong>{reviewed}</strong> reviewed · {CONCEPTS.length - mastered - reviewed} new
          {filtering && <> · {matching.size} match</>}
        </span>
      </div>

      <div className="map-frame">
        <svg
          ref={svgRef}
          viewBox={`${-VIEWBOX / 2} ${-VIEWBOX / 2} ${VIEWBOX} ${VIEWBOX}`}
          className="map-svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="Mind map of 5 pillars, 22 courses and the live course concepts. Drag to pan, scroll to zoom."
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {treeEdges.map((n) => {
              const p = n.parentId ? layout.byId.get(n.parentId) : undefined;
              if (!p) return null;
              const dim = n.kind === 'concept' && filtering && !matching.has(n.id);
              return <line key={`e-${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} className={`tree-edge${dim ? ' dim' : ''}`} />;
            })}
            {threadEdges.map((e) => (
              <path key={e.key} d={e.d} className={`thread-edge${e.lit ? ' lit' : ''}${e.dim ? ' dim' : ''}`}>
                <title>{e.title}</title>
              </path>
            ))}
            {layout.nodes.map((n) => {
              if (n.kind === 'root') {
                return (
                  <g key={n.id} className="node root">
                    <circle r={46} />
                    <text textAnchor="middle" dy="-0.2em">MBA</text>
                    <text textAnchor="middle" dy="1.0em" className="sub">Business OS</text>
                  </g>
                );
              }
              if (n.kind === 'pillar') {
                return (
                  <g key={n.id} className={`node pillar ${n.id}`} transform={`translate(${n.x} ${n.y})`}>
                    <circle r={13} />
                    <text textAnchor="middle" dy={n.y < 0 ? -22 : 34}>{n.label}</text>
                  </g>
                );
              }
              if (n.kind === 'course') {
                const course = COURSES.find((c) => c.id === n.id);
                const live = course?.status === 'live';
                const lbl = radialLabel(n, 14);
                return (
                  <g
                    key={n.id}
                    className={`node course ${live ? 'live' : 'coming'} ${course?.pillarId ?? ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.label}: ${course?.title ?? ''}, ${course ? comingLabel(course) : ''}`}
                    onClick={() => activate(n)}
                    onKeyDown={(e) => onNodeKey(e, n)}
                  >
                    <circle cx={n.x} cy={n.y} r={live ? 9 : 6} />
                    <text transform={lbl.transform} textAnchor={lbl.anchor} dominantBaseline="middle">
                      {n.label}
                    </text>
                    <title>{course ? `${course.code} · ${course.title} · ${comingLabel(course)}` : n.label}</title>
                  </g>
                );
              }
              const level = mastery[n.id] ?? 'new';
              const dim = filtering && !matching.has(n.id);
              const lbl = radialLabel(n, 12);
              return (
                <g
                  key={n.id}
                  className={`node concept ${level}${dim ? ' dim' : ''}${selectedId === n.id ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}, ${level}`}
                  onClick={() => activate(n)}
                  onKeyDown={(e) => onNodeKey(e, n)}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <circle cx={n.x} cy={n.y} r={8} />
                  <text transform={lbl.transform} textAnchor={lbl.anchor} dominantBaseline="middle">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {courseNote && (
          <div className="course-note" role="status">
            <strong>{courseNote.code}</strong> · {courseNote.title}
            <span className={`pill ${courseNote.status}`}>{comingLabel(courseNote)}</span>
            <button type="button" className="link" onClick={() => setCourseNote(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </div>
      <p className="hint">Drag to pan, scroll or use + and − to zoom. Click a concept to open it; click a course to see when it goes live.</p>
    </section>
  );
}
