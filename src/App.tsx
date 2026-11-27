import { useCallback, useEffect, useState } from 'react';
import { CapTableLab } from './components/CapTableLab';
import { OpsBottleneckLab } from './components/OpsBottleneckLab';
import { UnitEconomicsLab } from './components/UnitEconomicsLab';
import { ConceptDrawer } from './components/ConceptDrawer';
import { DcfStudio } from './components/DcfStudio';
import { LinkerSandbox } from './components/LinkerSandbox';
import { MindMap } from './components/MindMap';
import { RoutineScratchpad } from './components/RoutineScratchpad';
import { conceptById } from './data/graph';
import {
  loadMastery,
  loadRoutine,
  loadTheme,
  nextMastery,
  saveMastery,
  saveRoutine,
  saveTheme,
  type MasteryLevel,
  type MasteryMap,
  type RoutineEntry,
  type Theme,
} from './lib/storage';

type Tab = 'map' | 'linker' | 'dcf' | 'captable' | 'ops' | 'unitecon' | 'routine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mind map' },
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const selected = selectedId ? conceptById(selectedId) : undefined;

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Wave M4 · Pillars 1-4 · Accounting, Finance & VC, Strategy, Economics, Operations, Analytics, Entrepreneurship & Product</p>
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

      <main className={selected && tab === 'map' ? 'with-drawer' : undefined}>
        {tab === 'map' && <MindMap mastery={mastery} selectedId={selectedId} onSelectConcept={setSelectedId} />}
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
            onNavigate={setSelectedId}
            onLogRoutine={(id) => {
              setRoutineConcept(id);
              setTab('routine');
            }}
            onClose={closeDrawer}
          />
        )}
      </main>

      <footer className="colophon">
        Figures marked illustrative are teaching numbers. Case figures come from UW Foster ACCTG 500/501, FIN 502, ENTRE 557/542, B ECON 500/501, MGMT 502, OPMGT 502, QMETH 500/501, I S 500, ENTRE 510/532/579 and MKTG 554 materials; verify current filings before relying on
        them.
      </footer>
    </div>
  );
}
