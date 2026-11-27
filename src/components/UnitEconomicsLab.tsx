import { useMemo, useState } from 'react';
import {
  PRESETS,
  analyzeUnitEconomics,
  priceForTargetLtvCac,
  sensitivity,
  validateInputs,
  type UnitEconInputs,
  type UnitEconPreset,
} from '../lib/unitEconomics';

function usd(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  if (a >= 100) return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
  return `${sign}$${a.toFixed(2)}`;
}

const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`);
const months = (v: number | null) => (v === null ? 'never' : v === 0 ? 'at sale' : `${v.toFixed(1)} mo`);
const ratio = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)}×` : '∞');

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

interface CashCurveProps {
  cumulative: readonly number[];
  startCash: number;
  paybackMonth: number | null;
  noun: string;
}

/** Cumulative expected cash per account: starts at upfront contribution − CAC and climbs with each surviving month. */
function CashCurve({ cumulative, startCash, paybackMonth, noun }: CashCurveProps) {
  const W = 640;
  const H = 220;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const values = [startCash, ...cumulative];
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const n = values.length - 1 || 1;
  const x = (m: number) => pad.l + (m / n) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - ((v - lo) / span) * (H - pad.t - pad.b);
  const pts = values.map((v, m) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg className="queue-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative expected cash per ${noun} over ${n} months`}>
      <line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} className="axis" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} className="axis" />
      <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" className="tick">
        {usd(hi)}
      </text>
      <text x={pad.l - 6} y={H - pad.b} textAnchor="end" className="tick">
        {usd(lo)}
      </text>
      <text x={W - pad.r} y={H - 8} textAnchor="end" className="tick">
        month {n}
      </text>
      <text x={pad.l} y={H - 8} className="tick">
        Cumulative cash per {noun}, after CAC
      </text>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
      {paybackMonth !== null && paybackMonth > 0 && paybackMonth <= n && (
        <>
          <line x1={x(paybackMonth)} y1={pad.t} x2={x(paybackMonth)} y2={H - pad.b} className="cursor" />
          <text x={x(paybackMonth) + 4} y={pad.t + 12} className="tick">
            CAC paid back
          </text>
        </>
      )}
    </svg>
  );
}

export function UnitEconomicsLab() {
  const first = PRESETS[0] as UnitEconPreset;
  const [presetId, setPresetId] = useState<string>(first.id);
  const preset = PRESETS.find((p) => p.id === presetId) ?? first;
  const [inputs, setInputs] = useState<UnitEconInputs>(() => ({ ...first.inputs }));

  const valid = validateInputs(inputs);
  const result = useMemo(() => (valid.ok ? analyzeUnitEconomics(inputs) : null), [inputs, valid.ok]);
  const tornado = useMemo(() => (valid.ok ? sensitivity(inputs, 0.2) : []), [inputs, valid.ok]);
  const priceAt3x = useMemo(() => (valid.ok && inputs.monthlyPrice > 0 ? priceForTargetLtvCac(inputs, 3) : null), [inputs, valid.ok]);

  const choose = (p: UnitEconPreset) => {
    setPresetId(p.id);
    setInputs({ ...p.inputs });
  };
  const patch = (p: Partial<UnitEconInputs>) => setInputs((prev) => ({ ...prev, ...p }));

  const healthy = result !== null && result.ltvToCac >= 3 && (result.cacPaybackMonths ?? Number.POSITIVE_INFINITY) <= 18;
  const tornadoMax = Math.max(0.01, ...tornado.flatMap((r) => [r.low, r.high]));
  const base = result?.ltvToCac ?? 0;

  return (
    <section className="lab" aria-label="AI product unit economics and customer payback simulator">
      <div className="linker-intro">
        <p>
          One account at a time, from both sides of the table: the vendor&apos;s contribution, LTV and CAC payback, and the customer&apos;s payback on what
          they spend. Inference cost can fall each year, the way GPU prices have. Benchmarks such as LTV/CAC ≥ 3 and payback ≤ 18 months are{' '}
          <em>heuristics</em>, and every preset says which numbers are <em>illustrative</em>.
        </p>
        <div className={`badge ${healthy ? 'ok' : 'bad'}`} role="status">
          {!result ? '✗ Check inputs' : healthy ? `✓ LTV/CAC ${ratio(result.ltvToCac)}, payback ${months(result.cacPaybackMonths)}` : `✗ LTV/CAC ${ratio(result.ltvToCac)}, payback ${months(result.cacPaybackMonths)}`}
        </div>
      </div>

      <div className="seg preset-seg" role="group" aria-label="Unit economics preset">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={p.id === presetId ? 'on' : ''} aria-pressed={p.id === presetId} onClick={() => choose(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="fine">{preset.blurb}</p>
      <p className="fine">
        <strong>Sourcing:</strong> {preset.sourcing}
      </p>

      <div className="lab-columns">
        <div className="cap-inputs">
          <fieldset>
            <legend>Price</legend>
            <NumberField label="Upfront price" value={inputs.upfrontPrice} step={inputs.upfrontPrice >= 10_000 ? 1000 : 100} suffix="$" onChange={(v) => patch({ upfrontPrice: v })} />
            <NumberField label="Monthly price" value={inputs.monthlyPrice} step={inputs.monthlyPrice >= 100 ? 50 : 0.5} suffix="$" onChange={(v) => patch({ monthlyPrice: v })} />
            <NumberField label="Platform fee" value={inputs.platformFeePct} step={1} max={99} suffix="%" onChange={(v) => patch({ platformFeePct: v })} />
          </fieldset>
          <fieldset>
            <legend>Cost to deliver</legend>
            <NumberField label="Upfront COGS" value={inputs.upfrontCogs} step={inputs.upfrontCogs >= 10_000 ? 1000 : 100} suffix="$" onChange={(v) => patch({ upfrontCogs: v })} />
            <NumberField label="Serving cost / month" value={inputs.monthlyServingCost} step={inputs.monthlyServingCost >= 100 ? 10 : 0.05} suffix="$" onChange={(v) => patch({ monthlyServingCost: v })} />
            <NumberField label="Serving cost decline / yr" value={inputs.servingCostDeclinePct} step={5} max={95} suffix="%" onChange={(v) => patch({ servingCostDeclinePct: v })} />
          </fieldset>
          <fieldset>
            <legend>Acquisition and retention</legend>
            <NumberField label="CAC" value={inputs.cac} step={inputs.cac >= 1000 ? 500 : 1} suffix="$" onChange={(v) => patch({ cac: v })} />
            <NumberField label="Monthly churn" value={inputs.monthlyChurnPct} step={0.25} min={0.01} max={100} suffix="%" onChange={(v) => patch({ monthlyChurnPct: v })} />
            <NumberField label="Discount rate / yr" value={inputs.annualDiscountPct} step={1} max={100} suffix="%" onChange={(v) => patch({ annualDiscountPct: v })} />
            <NumberField label="Horizon" value={inputs.horizonMonths} step={6} min={1} max={240} suffix="mo" onChange={(v) => patch({ horizonMonths: Math.round(v) })} />
          </fieldset>
          <fieldset>
            <legend>Customer side</legend>
            <NumberField label="Value created / month" value={inputs.customerMonthlyValue} step={inputs.customerMonthlyValue >= 1000 ? 100 : 10} suffix="$" onChange={(v) => patch({ customerMonthlyValue: v })} />
          </fieldset>
          <button type="button" className="ghost" onClick={() => choose(preset)}>
            Reset preset
          </button>
        </div>

        <div className="lab-results">
          {!valid.ok && (
            <p className="guard" role="alert">
              {valid.reason}
            </p>
          )}

          {result && (
            <>
              <div className="stat-row" aria-live="polite">
                <div className="stat">
                  <span>LTV</span>
                  <strong>{usd(result.ltv)}</strong>
                  <small>discounted, churn-weighted, over {inputs.horizonMonths} mo</small>
                </div>
                <div className="stat">
                  <span>LTV / CAC</span>
                  <strong>{ratio(result.ltvToCac)}</strong>
                  <small>heuristic bar: 3×</small>
                </div>
                <div className="stat">
                  <span>CAC payback</span>
                  <strong>{months(result.cacPaybackMonths)}</strong>
                  <small>churn-adjusted; simple {months(result.simplePaybackMonths)}</small>
                </div>
                <div className="stat">
                  <span>Recurring margin</span>
                  <strong>{pct(result.recurringGrossMargin)}</strong>
                  <small>month 1; lifetime blended {pct(result.blendedGrossMargin)}</small>
                </div>
                <div className="stat">
                  <span>Customer payback</span>
                  <strong>{inputs.customerMonthlyValue > 0 ? months(result.customerPaybackMonths) : 'not modelled'}</strong>
                  <small>value capture {pct(result.valueCapture)}</small>
                </div>
              </div>

              <div className="statement">
                <h3>Per-{preset.accountNoun} cash curve</h3>
                <CashCurve
                  cumulative={result.months.map((m) => m.cumulativeCash)}
                  startCash={result.upfrontContribution - inputs.cac}
                  paybackMonth={result.cacPaybackMonths}
                  noun={preset.accountNoun}
                />
                <p className="fine">
                  Starts at upfront contribution {usd(result.upfrontContribution)} less CAC {usd(inputs.cac)}, then adds each month&apos;s contribution
                  times the chance the {preset.accountNoun} is still a customer. Expected life is {result.expectedLifetimeMonths.toFixed(1)} months.
                </p>
              </div>

              <div className="statement">
                <h3>What moves LTV / CAC? (each driver ±20%)</h3>
                <table className="payouts">
                  <thead>
                    <tr>
                      <th scope="col">Driver</th>
                      <th scope="col">−20%</th>
                      <th scope="col">+20%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tornado.map((r) => (
                      <tr key={r.driver}>
                        <th scope="row">{r.label}</th>
                        <td className={r.low >= base ? 'gain-pos' : undefined}>
                          <span className="pay-bar" style={{ width: `${(r.low / tornadoMax) * 100}%` }} aria-hidden="true" />
                          {ratio(r.low)}
                        </td>
                        <td className={r.high >= base ? 'gain-pos' : undefined}>
                          <span className="pay-bar alt" style={{ width: `${(r.high / tornadoMax) * 100}%` }} aria-hidden="true" />
                          {ratio(r.high)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">
                  Ranked by swing. Today: {ratio(base)}.
                  {inputs.monthlyPrice > 0 &&
                    (priceAt3x === null
                      ? ' No monthly price up to 100× today reaches 3×, so fix CAC, churn or cost first.'
                      : ` A monthly price of ${usd(priceAt3x)} would reach 3×, all else equal.`)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
