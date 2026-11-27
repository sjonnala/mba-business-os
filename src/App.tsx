import { useCallback, useEffect, useState } from 'react';
import { CapTableLab } from './components/CapTableLab';
import { CaseGym } from './components/CaseGym';
import { OpsBottleneckLab } from './components/OpsBottleneckLab';
import { UnitEconomicsLab } from './components/UnitEconomicsLab';
import { ConceptDrawer } from './components/ConceptDrawer';
import { DcfStudio } from './components/DcfStudio';
import { LinkerSandbox } from './components/LinkerSandbox';
import { MindMap } from './components/MindMap';
import { OverviewDrawer } from './components/OverviewDrawer';
import { RoutineScratchpad } from './components/RoutineScratchpad';
import { DRILLS } from './data/caseGym';
import { COURSES, PILLARS } from './data/catalog';
import { conceptById } from './data/graph';
import { MAP_LAYOUT } from './data/mapLayout';
import { EMPTY_SELECTION, selectNode, type MapSelection, type NodeRef } from './lib/mapNavigation';
import { schedule, type Grade, type GymProgress } from './lib/caseGym';
import {
  loadGymProgress,
  loadMastery,
  loadRoutine,
  loadTheme,
  nextMastery,
  saveGymProgress,
  saveMastery,
  saveRoutine,
  saveTheme,
  type MasteryLevel,
  type MasteryMap,
  type RoutineEntry,
  type Theme,
} from './lib/storage';

type Tab = 'map' | 'gym' | 'linker' | 'dcf' | 'captable' | 'ops' | 'unitecon' | 'routine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mind map' },
  { id: 'gym', label: 'Case gym' },
  { id: 'linker', label: '3-statement linker' },
  { id: 'dcf', label: 'DCF & WACC studio' },
  { id: 'captable', label: 'Cap table lab' },
  { id: 'ops', label: 'Ops bottleneck lab' },
  { id: 'unitecon', label: 'Unit economics lab' },
  { id: 'routine', label: '5-min routine' },
];

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [theme, setTheme] = useState<Theme>(() => loadTheme() ?? systemTheme());
  const [mastery, setMastery] = useState<MasteryMap>(() => loadMastery());
  const [routine, setRoutine] = useState<RoutineEntry[]>(() => loadRoutine());
  const [gym, setGym] = useState<GymProgress>(() => loadGymProgress());
  const [selection, setSelection] = useState<MapSelection>(EMPTY_SELECTION);
  const [routineConcept, setRoutineConcept] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveTheme(next);
  };

  const toggleMastery = (id: string, target: Exclude<MasteryLevel, 'new'>) => {
    setMastery((prev) => {
      const next = { ...prev, [id]: nextMastery(prev[id], target) };
      saveMastery(next);
      return next;
    });
  };

  const saveEntry = (entry: RoutineEntry) => {
    setRoutine((prev) => {
      const next = [...prev, entry];
      saveRoutine(next);
      return next;
    });
  };

  const deleteEntry = (id: string) => {
    setRoutine((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveRoutine(next);
      return next;
    });
  };

  const gradeDrill = (drillId: string, grade: Grade) => {
    setGym((prev) => {
      const next = { ...prev, [drillId]: schedule(prev[drillId], grade, Date.now()) };
      saveGymProgress(next);
      return next;
    });
  };

  const selectMapNode = useCallback((node: NodeRef) => setSelection((prev) => selectNode(prev, node, MAP_LAYOUT)), []);
  const navigateConcept = useCallback((id: string) => selectMapNode({ kind: 'concept', id }), [selectMapNode]);

  const openConcept = (conceptId: string) => {
    setSelection({ conceptId, overview: null });
    setTab('map');
  };

  // Closing a concept opened from an overview returns to that overview; closing the overview clears the focus.
  const closeConcept = useCallback(() => setSelection((prev) => ({ ...prev, conceptId: null })), []);
  const closeOverview = useCallback(() => setSelection(EMPTY_SELECTION), []);
  const selected = selection.conceptId ? conceptById(selection.conceptId) : undefined;
  const overview = selection.overview;
  const backLabel =
    overview?.kind === 'course'
      ? (COURSES.find((c) => c.id === overview.id)?.code ?? 'course')
      : (PILLARS.find((p) => p.id === overview?.id)?.shortName ?? 'pillar');
  const drawerOpen = tab === 'map' && (selected !== undefined || overview !== null);

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Wave M6 · Pillars 1-5 · 22 courses · Accounting, Finance & VC, Strategy & Operations, Entrepreneurship & Product, Marketing, Leadership & Governance</p>
          <h1>MBA Business OS</h1>
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <main className={drawerOpen ? 'with-drawer' : undefined}>
        {tab === 'map' && <MindMap mastery={mastery} selection={selection} onSelectNode={selectMapNode} />}
        {tab === 'gym' && <CaseGym drills={DRILLS} progress={gym} onGrade={gradeDrill} onOpenConcept={openConcept} />}
        {tab === 'linker' && <LinkerSandbox />}
        {tab === 'dcf' && <DcfStudio />}
        {tab === 'captable' && <CapTableLab />}
        {tab === 'ops' && <OpsBottleneckLab />}
        {tab === 'unitecon' && <UnitEconomicsLab />}
        {tab === 'routine' && (
          <RoutineScratchpad entries={routine} onSave={saveEntry} onDelete={deleteEntry} initialConceptId={routineConcept} />
        )}
        {tab === 'map' && selected && (
          <ConceptDrawer
            key={selected.id}
            concept={selected}
            level={mastery[selected.id] ?? 'new'}
            onToggleMastery={(target) => toggleMastery(selected.id, target)}
            onNavigate={navigateConcept}
            onLogRoutine={(id) => {
              setRoutineConcept(id);
              setTab('routine');
            }}
            onClose={closeConcept}
            {...(overview ? { backLabel: `Back to ${backLabel} overview`, onBack: closeConcept } : {})}
          />
        )}
        {tab === 'map' && !selected && overview && (
          <OverviewDrawer
            key={`${overview.kind}-${overview.id}`}
            target={overview}
            mastery={mastery}
            onOpenConcept={navigateConcept}
            onOpenCourse={(id) => selectMapNode({ kind: 'course', id })}
            onOpenPillar={(id) => selectMapNode({ kind: 'pillar', id })}
            onClose={closeOverview}
          />
        )}
      </main>

      <footer className="colophon">
        Figures marked illustrative are teaching numbers. Case figures come from UW Foster ACCTG 500/501, FIN 502, ENTRE 557/542, B ECON 500/501, MGMT 502, OPMGT 502, QMETH 500/501, I S 500, ENTRE 510/532/579, MKTG 554, MKTG 501, MGMT 500/504/550 materials, plus public records for MKTG 600 and MGMT 510 / B CMU 501 themes; verify current filings before relying on
        them.
      </footer>
    </div>
  );
}
