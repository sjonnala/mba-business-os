import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESETS,
  analyzePipeline,
  improvementGains,
  simulatePipeline,
  validatePipeline,
  type Pipeline,
  type PipelinePreset,
  type Stage,
} from '../lib/opsBottleneck';

/** Formats a number with sensible precision for rates and times of very different sizes. */
function fmt(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return Math.round(v).toLocaleString('en-US');
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(2);
}

const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '∞');

const LINE_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p4)', 'var(--amber)', 'var(--p5)', 'var(--green)'];
const PLAY_MS = 6000;
const TARGET_ARRIVALS = 1500;

interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (v: number) => void;
}

function NumberField({ label, value, step, min = 0, max, suffix, onChange }: NumberFieldProps) {
  return (
    <label className="num-field">
      <span>{label}</span>
      <span className="num-input">
        <input
          type="number"
          inputMode="decimal"
          value={Number(value.toPrecision(6))}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

function clonePipeline(p: Pipeline): Pipeline {
  return { ...p, stages: p.stages.map((s) => ({ ...s })) };
}

interface QueueChartProps {
  preset: PipelinePreset;
  stages: readonly Stage[];
  bottleneck: number;
  samples: ReturnType<typeof simulatePipeline>['samples'];
  horizon: number;
  cursor: number;
}

function QueueChart({ preset, stages, bottleneck, samples, horizon, cursor }: QueueChartProps) {
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const maxQ = Math.max(1, ...samples.flatMap((s) => s.queues));
  const x = (t: number) => pad.l + (t / horizon) * (W - pad.l - pad.r);
  const y = (q: number) => H - pad.b - (q / maxQ) * (H - pad.t - pad.b);
  const cursorX = x(cursor * horizon);

  return (
    <svg className="queue-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Queue length in front of each stage over ${fmt(horizon)} ${preset.timeUnit}s`}>
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} className="axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
      <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" className="tick">
        {Math.round(maxQ)}
      </text>
      <text x={pad.l - 6} y={H - pad.b} textAnchor="end" className="tick">
        0
      </text>
      <text x={W - pad.r} y={H - 8} textAnchor="end" className="tick">
        {fmt(horizon)} {preset.timeUnit}s
      </text>
      <text x={pad.l} y={H - 8} className="tick">
        Jobs waiting by stage
      </text>
      {stages.map((s, si) => {
        const pts = samples.map((p) => `${x(p.time).toFixed(1)},${y(p.queues[si] ?? 0).toFixed(1)}`).join(' ');
        return (
          <polyline
            key={s.name + si}
            points={pts}
            fill="none"
            stroke={si === bottleneck ? 'var(--red)' : LINE_COLORS[si % LINE_COLORS.length]}
            strokeWidth={si === bottleneck ? 2.6 : 1.4}
            opacity={si === bottleneck ? 1 : 0.75}
          />
        );
      })}
      <line x1={cursorX} y1={pad.t} x2={cursorX} y2={H - pad.b} className="cursor" />
    </svg>
  );
}

export function OpsBottleneckLab() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0]?.id ?? '');
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const [pipeline, setPipeline] = useState<Pipeline>(() => clonePipeline((PRESETS[0] as PipelinePreset).pipeline));
  const [seed, setSeed] = useState(42);
  const [cursor, setCursor] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  const valid = validatePipeline(pipeline);
  const analysis = useMemo(() => (valid.ok ? analyzePipeline(pipeline) : null), [pipeline, valid.ok]);
  const gains = useMemo(() => (valid.ok ? improvementGains(pipeline, 2) : []), [pipeline, valid.ok]);
  const horizon = valid.ok ? TARGET_ARRIVALS / pipeline.arrivalRate : 1;
  const sim = useMemo(() => (valid.ok ? simulatePipeline(pipeline, horizon, 120, seed) : null), [pipeline, horizon, seed, valid.ok]);

  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - startedAt) / PLAY_MS);
      setCursor(f);
      if (f < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  if (!preset) return null;

  const choosePreset = (p: PipelinePreset) => {
    setPresetId(p.id);
    setPipeline(clonePipeline(p.pipeline));
    setCursor(1);
    setPlaying(false);
  };
  const patchStage = (i: number, patch: Partial<Stage>) =>
    setPipeline((prev) => ({ ...prev, stages: prev.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const unit = preset.timeUnit;
  const noun = preset.jobNoun;
  const sampleIdx = sim ? Math.round(cursor * (sim.samples.length - 1)) : 0;
  const sample = sim?.samples[sampleIdx];
  const maxQ = Math.max(1, ...(sim?.maxQueues ?? [1]));
  const bName = analysis ? pipeline.stages[analysis.bottleneckIndex]?.name : '';

  return (
    <section className="lab" aria-label="Operations bottleneck and Little's Law simulator">
      <div className="linker-intro">
        <p>
          A line of stages in series, for a factory or robotics cell and for AI inference or ML labeling. Set the arrival rate, each stage&apos;s
          resources, service time and variability, then watch the queue build in front of the bottleneck. Doubling any other stage adds{' '}
          <em>zero</em> throughput. Presets are <em>illustrative</em>.
        </p>
        <div className={`badge ${analysis && !analysis.overloaded ? 'ok' : 'bad'}`} role="status">
          {!analysis ? '✗ Check inputs' : analysis.overloaded ? `✗ Queue growing at ${bName}` : `✓ Stable, bottleneck: ${bName}`}
        </div>
      </div>

      <div className="seg preset-seg" role="group" aria-label="Pipeline preset">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={p.id === presetId ? 'on' : ''} aria-pressed={p.id === presetId} onClick={() => choosePreset(p)}>
            {p.domain === 'ai' ? 'AI · ' : 'Factory · '}
            {p.label}
          </button>
        ))}
      </div>
      <p className="fine">{preset.blurb}</p>

      <div className="lab-columns">
        <div className="cap-inputs">
          <fieldset>
            <legend>Demand</legend>
            <NumberField
              label={`Arrivals per ${unit}`}
              value={pipeline.arrivalRate}
              step={pipeline.arrivalRate >= 10 ? 1 : 0.01}
              suffix={noun}
              onChange={(v) => setPipeline((prev) => ({ ...prev, arrivalRate: v }))}
            />
            <NumberField
              label="Arrival variability (CV)"
              value={pipeline.arrivalCv}
              step={0.1}
              max={3}
              onChange={(v) => setPipeline((prev) => ({ ...prev, arrivalCv: v }))}
            />
          </fieldset>

          {pipeline.stages.map((s, i) => {
            const r = analysis?.stages[i];
            const isB = r?.isBottleneck ?? false;
            return (
              <fieldset key={i} className={`stage-card${isB ? ' bottleneck' : ''}`}>
                <legend>
                  {i + 1}. {s.name}
                  {isB && <span className="b-tag">Bottleneck</span>}
                </legend>
                <NumberField label="Resources" value={s.servers} step={1} min={1} max={200} onChange={(v) => patchStage(i, { servers: Math.round(v) })} />
                <NumberField
                  label={`Service time (${unit}s)`}
                  value={s.serviceTime}
                  step={s.serviceTime >= 1 ? 0.1 : s.serviceTime >= 0.1 ? 0.01 : 0.001}
                  onChange={(v) => patchStage(i, { serviceTime: v })}
                />
                <NumberField label="Variability (CV)" value={s.cv} step={0.1} max={3} onChange={(v) => patchStage(i, { cv: v })} />
                {r && (
                  <div className="util" aria-label={`${s.name} utilization ${pct(r.utilization)}`}>
                    <div className="util-bar">
                      <span style={{ width: `${Math.min(100, r.utilization * 100)}%` }} className={r.utilization >= 1 ? 'over' : r.utilization >= 0.85 ? 'hot' : ''} />
                    </div>
                    <small>
                      Capacity {fmt(r.capacity)}/{unit} · utilization {pct(r.utilization)} · wait {fmt(r.waitTime)} {unit}s
                    </small>
                  </div>
                )}
              </fieldset>
            );
          })}

          <button type="button" onClick={() => choosePreset(preset)}>
            Reset preset
          </button>
        </div>

        <div className="lab-results">
          {!valid.ok && (
            <p className="guard" role="alert">
              {valid.reason}
            </p>
          )}

          {analysis && sim && (
            <>
              <div className="stat-row" aria-live="polite">
                <div className="stat">
                  <span>Process capacity</span>
                  <strong>
                    {fmt(analysis.processCapacity)}/{unit}
                  </strong>
                  <small>min of m ÷ p, set by {bName}</small>
                </div>
                <div className="stat">
                  <span>Throughput</span>
                  <strong>
                    {fmt(analysis.throughput)}/{unit}
                  </strong>
                  <small>{analysis.demandConstrained ? 'demand-constrained' : 'capacity-constrained'}</small>
                </div>
                <div className="stat">
                  <span>Cycle time</span>
                  <strong>
                    {fmt(analysis.cycleTime)} {unit}s
                  </strong>
                  <small>1 ÷ throughput, one {noun.replace(/s$/, '')} out every</small>
                </div>
                <div className="stat">
                  <span>Lead time</span>
                  <strong>
                    {fmt(analysis.leadTime)} {unit}s
                  </strong>
                  <small>
                    {fmt(analysis.minLeadTime)} of work + {fmt(analysis.leadTime - analysis.minLeadTime)} waiting
                  </small>
                </div>
                <div className="stat">
                  <span>WIP (Little&apos;s Law)</span>
                  <strong>{fmt(analysis.wip)}</strong>
                  <small>throughput × lead time</small>
                </div>
              </div>

              {analysis.overloaded && (
                <p className="guard" role="alert">
                  Demand exceeds capacity by {fmt(analysis.queueGrowthRate)} {noun} per {unit}, so the queue at {bName} grows without limit and
                  lead time has no steady state. Add capacity at {bName}, not anywhere else.
                </p>
              )}

              <div className="statement">
                <h3>Live queue buildup</h3>
                <div className="play-row">
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(0);
                      setPlaying(true);
                    }}
                    disabled={playing}
                  >
                    {playing ? 'Playing…' : '▶ Play'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={cursor}
                    aria-label="Simulation time"
                    onChange={(e) => {
                      setPlaying(false);
                      setCursor(Number(e.target.value));
                    }}
                  />
                  <button type="button" className="link" onClick={() => setSeed((s) => s + 1)}>
                    New random run
                  </button>
                </div>
                <QueueChart preset={preset} stages={pipeline.stages} bottleneck={analysis.bottleneckIndex} samples={sim.samples} horizon={horizon} cursor={cursor} />
                <div className="queue-bars" aria-live="off">
                  {pipeline.stages.map((s, i) => {
                    const q = sample?.queues[i] ?? 0;
                    return (
                      <div key={i} className={`queue-bar${i === analysis.bottleneckIndex ? ' bottleneck' : ''}`}>
                        <span className="q-name">{s.name}</span>
                        <span className="q-track">
                          <span style={{ width: `${(q / maxQ) * 100}%` }} />
                        </span>
                        <span className="q-val">{q}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="fine">
                  At {fmt((sample?.time ?? 0))} {unit}s: {sample?.wip ?? 0} {noun} in the system. Over the run, {sim.completed.toLocaleString('en-US')}{' '}
                  finished at {fmt(sim.observedThroughput)}/{unit}, with average lead time {fmt(sim.observedLeadTime)} {unit}s and average WIP{' '}
                  {fmt(sim.observedWip)} (throughput × lead time = {fmt(sim.observedThroughput * sim.observedLeadTime)}).
                </p>
              </div>

              <div className="statement">
                <h3>Where should the next dollar of capacity go?</h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Double the capacity of</th>
                      <th scope="col">Throughput before</th>
                      <th scope="col">After</th>
                      <th scope="col">Gain</th>
                      <th scope="col">Lead time after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gains.map((g) => (
                      <tr key={g.stageIndex} className={g.isBottleneck ? 'strong' : ''}>
                        <th scope="row">
                          {g.name}
                          {g.isBottleneck ? ' (bottleneck)' : ''}
                        </th>
                        <td>{fmt(g.throughputBefore)}</td>
                        <td>{fmt(g.throughputAfter)}</td>
                        <td className={g.gain > 0 ? 'gain-pos' : 'gain-zero'}>{g.gain > 0 ? `+${fmt(g.gain)}` : '0'}</td>
                        <td>
                          {fmt(g.leadTimeAfter)} {unit}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">
                  Every non-bottleneck row shows zero: extra capacity there only adds idle time. Doubling the bottleneck lifts throughput until demand
                  or the next-slowest stage binds, so the constraint moves, which is step 5 of the Theory of Constraints.
                  {analysis.demandConstrained &&
                    ' Right now demand, not capacity, limits throughput, so even the bottleneck row shows zero; the payoff from bottleneck capacity is the shorter lead time in the last column.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
