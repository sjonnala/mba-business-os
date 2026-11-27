import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { COURSES, comingLabel } from '../data/catalog';
import { ALL_TAGS, CONCEPTS } from '../data/graph';
import { BROWSE_TREE, MAP_LAYOUT, MAP_THREADS, MAP_VIEWBOX } from '../data/mapLayout';
import { conceptMatches, type MapNode } from '../lib/mindMapLayout';
import {
  FIT_VIEW,
  LABEL_METRICS,
  highlightIds,
  threadFocus,
  visibleThreads,
  type MapSelection,
  type NodeRef,
} from '../lib/mapNavigation';
import type { MasteryMap } from '../lib/storage';
import { BrowseSidebar } from './BrowseSidebar';

interface MindMapProps {
  mastery: MasteryMap;
  selection: MapSelection;
  /** Any node pressed on the map or in the browse sidebar (hub, pillar, course or concept). */
  onSelectNode: (node: NodeRef) => void;
  /** Initial state of the "All threads" checkbox; off by default (On-Focus Threads). */
  defaultAllThreads?: boolean;
  /** Initial state of the browse sidebar; open by default. */
  defaultBrowseOpen?: boolean;
}

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.5;
const MAX_K = 5;
const VIEWBOX_ATTR = `${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`;
const CENTER = { x: MAP_VIEWBOX.x + MAP_VIEWBOX.width / 2, y: MAP_VIEWBOX.y + MAP_VIEWBOX.height / 2 };

function clampK(k: number): number {
  return Math.min(MAX_K, Math.max(MIN_K, k));
}

/** Zoom by `factor` keeping the point (px, py), in viewBox units, fixed on screen. */
function zoomAt(v: View, factor: number, px: number, py: number): View {
  const k = clampK(v.k * factor);
  const ratio = k / v.k;
  return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
}

/** Text placement for radial labels so they never read upside down. */
function radialLabel(node: MapNode, offset: number): { transform: string; anchor: 'start' | 'end' } {
  const flip = Math.cos((node.angle * Math.PI) / 180) < 0;
  const rotate = flip ? node.angle + 180 : node.angle;
  const dx = flip ? -offset : offset;
  return { transform: `translate(${node.x} ${node.y}) rotate(${rotate}) translate(${dx} 0)`, anchor: flip ? 'end' : 'start' };
}

export function MindMap({ mastery, selection, onSelectNode, defaultAllThreads = false, defaultBrowseOpen = true }: MindMapProps) {
  const layout = MAP_LAYOUT;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<View>(FIT_VIEW);
  const [allThreads, setAllThreads] = useState(defaultAllThreads);
  const [browseOpen, setBrowseOpen] = useState(defaultBrowseOpen);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const filtering = query.trim() !== '' || tag !== '';
  const matching = useMemo(
    () => new Set(CONCEPTS.filter((c) => conceptMatches(c, query, tag)).map((c) => c.id)),
    [query, tag],
  );

  const reviewed = CONCEPTS.filter((c) => mastery[c.id] === 'reviewed').length;
  const mastered = CONCEPTS.filter((c) => mastery[c.id] === 'mastered').length;

  // A pillar or course overview highlights its subtree and gently dims the rest of the map.
  const lit = useMemo(() => highlightIds(layout, selection.overview?.id ?? null), [layout, selection.overview]);
  const focusId = threadFocus(hovered, selection);
  const threads = visibleThreads(MAP_THREADS, layout, focusId, allThreads);

  // Wheel zoom around the pointer. A native listener is needed so preventDefault works.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      setView((v) => zoomAt(v, e.deltaY < 0 ? 1.12 : 1 / 1.12, pt.x, pt.y));
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

  const fit = () => setView(FIT_VIEW);

  const activate = (node: MapNode) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (node.kind === 'root') fit();
    onSelectNode({ kind: node.kind, id: node.id });
  };
  const onNodeKey = (e: KeyboardEvent<SVGGElement>, node: MapNode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      suppressClick.current = false;
      activate(node);
    }
  };
  const nodeHandlers = (node: MapNode) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => activate(node),
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => onNodeKey(e, node),
    onPointerEnter: () => setHovered(node.kind === 'root' ? null : node.id),
    onPointerLeave: () => setHovered(null),
  });

  const zoomBy = (factor: number) => setView((v) => zoomAt(v, factor, CENTER.x, CENTER.y));
  const faded = (id: string) => (lit !== null && !lit.has(id) ? ' faded' : '');

  return (
    <section className="mindmap" aria-label="Knowledge mind map">
      <div className="toolbar">
        <button
          type="button"
          className={`browse-toggle${browseOpen ? ' on' : ''}`}
          aria-pressed={browseOpen}
          aria-controls="mindmap-browse"
          onClick={() => setBrowseOpen((o) => !o)}
        >
          {browseOpen ? 'Hide list' : 'Browse list'}
        </button>
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
        <label className="toggle" title="Off: threads show only for the hovered or selected node">
          <input type="checkbox" name="all-threads" checked={allThreads} onChange={(e) => setAllThreads(e.target.checked)} />
          All threads
        </label>
        <div className="zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
          <button type="button" onClick={fit} title="Fit the whole map">
            Reset
          </button>
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

      <div className={`map-body${browseOpen ? ' with-browse' : ''}`}>
        {browseOpen && (
          <div id="mindmap-browse" className="browse-wrap">
            <BrowseSidebar tree={BROWSE_TREE} mastery={mastery} selection={selection} matching={filtering ? matching : null} onSelect={onSelectNode} />
          </div>
        )}
        <div className="map-frame">
          <svg
            ref={svgRef}
            viewBox={VIEWBOX_ATTR}
            preserveAspectRatio="xMidYMid meet"
            className="map-svg"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="img"
            aria-label="Mind map of 5 pillars, 22 courses and their live concepts. Drag to pan, scroll to zoom."
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {layout.nodes.map((n) => {
                const p = n.parentId ? layout.byId.get(n.parentId) : undefined;
                if (!p) return null;
                const dim = n.kind === 'concept' && filtering && !matching.has(n.id);
                return <line key={`e-${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} className={`tree-edge${dim ? ' dim' : ''}${faded(n.id)}`} />;
              })}
              {threads.map((t) => {
                const from = layout.byId.get(t.sourceId);
                const to = layout.byId.get(t.targetId);
                if (!from || !to) return null;
                const mx = (from.x + to.x) * 0.3;
                const my = (from.y + to.y) * 0.3;
                const dim = filtering && !matching.has(t.sourceId);
                return (
                  <path
                    key={t.key}
                    d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                    className={`thread-edge${t.lit ? ' lit' : ''}${dim ? ' dim' : ''}`}
                  >
                    <title>{`${t.relationship}: ${t.question}`}</title>
                  </path>
                );
              })}
              {layout.nodes.map((n) => {
                if (n.kind === 'root') {
                  return (
                    <g key={n.id} className="node root" {...nodeHandlers(n)} aria-label="MBA Business OS: reset the map and fit the whole view">
                      <circle r={LABEL_METRICS.rootRadius} />
                      <text textAnchor="middle" dy="-0.2em">MBA</text>
                      <text textAnchor="middle" dy="1.0em" className="sub">Business OS</text>
                      <title>Reset and fit the whole map</title>
                    </g>
                  );
                }
                if (n.kind === 'pillar') {
                  const current = selection.overview?.id === n.id;
                  return (
                    <g
                      key={n.id}
                      className={`node pillar ${n.id}${current ? ' selected' : ''}${faded(n.id)}`}
                      transform={`translate(${n.x} ${n.y})`}
                      {...nodeHandlers(n)}
                      aria-label={`${n.label} pillar: open overview`}
                    >
                      <circle r={13} />
                      <text textAnchor="middle" dy={n.y < 0 ? -22 : 34}>{n.label}</text>
                    </g>
                  );
                }
                if (n.kind === 'course') {
                  const course = COURSES.find((c) => c.id === n.id);
                  const live = course?.status === 'live';
                  const current = selection.overview?.id === n.id;
                  const lbl = radialLabel(n, LABEL_METRICS.courseOffset);
                  return (
                    <g
                      key={n.id}
                      className={`node course ${live ? 'live' : 'coming'} ${course?.pillarId ?? ''}${current ? ' selected' : ''}${faded(n.id)}`}
                      {...nodeHandlers(n)}
                      aria-label={`${n.label}: ${course?.title ?? ''}, open course overview`}
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
                const lbl = radialLabel(n, LABEL_METRICS.conceptOffset);
                return (
                  <g
                    key={n.id}
                    className={`node concept ${level}${dim ? ' dim' : ''}${selection.conceptId === n.id ? ' selected' : ''}${faded(n.id)}`}
                    {...nodeHandlers(n)}
                    aria-label={`${n.label}, ${level}`}
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
        </div>
      </div>
      <p className="hint">
        Click a pillar or course for its overview, a concept to open it, or the centre hub to reset. Hover any node to see its threads. Drag to pan, scroll or use + and − to zoom.
      </p>
    </section>
  );
}
