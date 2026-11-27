import { useMemo, useState } from 'react';
import {
  DCF_INPUT_SPECS,
  DEFAULT_DCF_INPUTS,
  dupontRoic,
  runDcf,
  sensitivityGrid,
  studioInvestedCapital,
  type DcfInputs,
  type DcfInputSpec,
} from '../lib/valuation';

const pctText = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const money = (v: number) => {
  const r = Math.round(v * 10) / 10;
  const s = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return r < 0 ? `(${s})` : s;
};

function formatInput(spec: DcfInputSpec, value: number): string {
  switch (spec.unit) {
    case '%':
      return `${value}%`;
    case '$M':
      return `$${value}M`;
    case 'x':
      return value.toFixed(2);
    case 'M':
      return `${value}M`;
  }
}

/** Interpolates between two theme colours by value position for the heatmap. */
function heatStyle(value: number | null, min: number, max: number) {
  if (value === null) return undefined;
  const t = max > min ? (value - min) / (max - min) : 0.5;
  const pctMix = Math.round(12 + t * 50);
  return { background: `color-mix(in srgb, var(--accent) ${pctMix}%, var(--surface))` };
}

function Slider({ spec, value, onChange }: { spec: DcfInputSpec; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider" title={spec.help}>
      <span className="slider-head">
        <span>{spec.label}</span>
        <output>{formatInput(spec, value)}</output>
      </span>
      <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small>{spec.help}</small>
    </label>
  );
}

export function DcfStudio() {
  const [inputs, setInputs] = useState<DcfInputs>(DEFAULT_DCF_INPUTS);
  const { capital, result } = useMemo(() => runDcf(inputs), [inputs]);
  const grid = useMemo(() => sensitivityGrid(inputs, capital.wacc, inputs.terminalGrowthPct / 100), [inputs, capital.wacc]);
  const year1 = result.ok ? result.years[0] : undefined;
  const roic = useMemo(() => {
    if (!year1 || year1.revenue <= 0) return null;
    return dupontRoic({
      revenue: year1.revenue,
      ebit: year1.ebit,
      taxRate: inputs.taxRatePct / 100,
      investedCapital: studioInvestedCapital(inputs),
      wacc: capital.wacc,
    });
  }, [year1, inputs, capital.wacc]);

  const set = (key: keyof DcfInputs, v: number) => setInputs((prev) => ({ ...prev, [key]: v }));

  return (
    <section className="lab" aria-label="DCF, WACC and DuPont ROIC sensitivity studio">
      <div className="linker-intro">
        <p>
          Build WACC from CAPM, forecast five years of free cash flow to the firm, and see how value per share moves across a 5 × 5 grid of WACC and
          terminal growth. Every default is an <em>illustrative</em> company, not a real filing. Push terminal growth toward WACC to see the guard.
        </p>
        <div className={`badge ${result.ok ? 'ok' : 'bad'}`} role="status">
          {result.ok ? `✓ WACC ${pctText(capital.wacc, 2)} > g ${inputs.terminalGrowthPct.toFixed(1)}%` : '✗ WACC ≤ g: no terminal value'}
        </div>
      </div>

      <div className="lab-columns">
        <div className="sliders">
          <h3 className="group-title">Operations</h3>
          {DCF_INPUT_SPECS.filter((s) => s.group === 'operations').map((s) => (
            <Slider key={s.key} spec={s} value={inputs[s.key]} onChange={(v) => set(s.key, v)} />
          ))}
          <h3 className="group-title">Capital and valuation</h3>
          {DCF_INPUT_SPECS.filter((s) => s.group === 'capital').map((s) => (
            <Slider key={s.key} spec={s} value={inputs[s.key]} onChange={(v) => set(s.key, v)} />
          ))}
          <div className="slider-actions">
            <button type="button" onClick={() => setInputs(DEFAULT_DCF_INPUTS)}>
              Reset inputs
            </button>
          </div>
        </div>

        <div className="lab-results">
          <div className="stat-row" aria-live="polite">
            <div className="stat">
              <span>Equity beta</span>
              <strong>{capital.equityBeta.toFixed(2)}</strong>
              <small>β_A relevered at D/E {capital.debtToEquity.toFixed(2)}</small>
            </div>
            <div className="stat">
              <span>Cost of equity</span>
              <strong>{pctText(capital.costOfEquity, 2)}</strong>
              <small>r_f + β × MRP</small>
            </div>
            <div className="stat">
              <span>WACC</span>
              <strong>{pctText(capital.wacc, 2)}</strong>
              <small>after-tax r_D {pctText(capital.afterTaxCostOfDebt, 2)}</small>
            </div>
            <div className="stat">
              <span>Value per share</span>
              <strong>{result.ok ? `$${result.valuePerShare.toFixed(2)}` : '—'}</strong>
              <small>{result.ok ? `EV $${money(result.enterpriseValue)}M` : 'guard tripped'}</small>
            </div>
          </div>

          {!result.ok && (
            <p className="guard" role="alert">
              {result.reason} Lower terminal growth or raise WACC.
            </p>
          )}

          {result.ok && (
            <div className="statement">
              <h3>Free cash flow to the firm ($M)</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">$M</th>
                    {result.years.map((y) => (
                      <th scope="col" key={y.year}>
                        Year {y.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Revenue', 'revenue'],
                      ['EBIT', 'ebit'],
                      ['NOPAT = EBIT × (1 − t)', 'nopat'],
                      ['+ D&A', 'da'],
                      ['− CapEx', 'capex'],
                      ['− Increase in NWC', 'changeInNwc'],
                      ['FCFF', 'fcff'],
                      ['PV at WACC', 'pv'],
                    ] as const
                  ).map(([label, key]) => (
                    <tr key={key} className={key === 'fcff' || key === 'pv' ? 'strong' : undefined}>
                      <th scope="row">{label}</th>
                      {result.years.map((y) => (
                        <td key={y.year} className={y[key] < 0 ? 'neg' : undefined}>
                          {money(y[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="ev-bridge">
                <div>
                  <dt>PV of Years 1-5</dt>
                  <dd>{money(result.pvExplicit)}</dd>
                </div>
                <div>
                  <dt>PV of terminal value</dt>
                  <dd>
                    {money(result.pvTerminal)} <small>({pctText(result.terminalShare, 0)} of EV)</small>
                  </dd>
                </div>
                <div>
                  <dt>Enterprise value</dt>
                  <dd>{money(result.enterpriseValue)}</dd>
                </div>
                <div>
                  <dt>− Net debt</dt>
                  <dd>{money(inputs.netDebt)}</dd>
                </div>
                <div>
                  <dt>Equity value</dt>
                  <dd>{money(result.equityValue)}</dd>
                </div>
                <div>
                  <dt>Implied EV / final-year EBITDA</dt>
                  <dd>{Number.isFinite(result.impliedExitMultiple) ? `${result.impliedExitMultiple.toFixed(1)}x` : '—'}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="statement">
            <h3>Value per share: WACC × terminal growth</h3>
            <table className="heatmap">
              <thead>
                <tr>
                  <th scope="col">WACC ↓ / g →</th>
                  {grid.growths.map((g) => (
                    <th scope="col" key={g}>
                      {pctText(g, 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, i) => (
                  <tr key={grid.waccs[i]}>
                    <th scope="row">{pctText(grid.waccs[i] ?? 0, 2)}</th>
                    {row.map((cell, j) => (
                      <td
                        key={cell.growth}
                        className={`${cell.valuePerShare === null ? 'invalid' : ''}${i === 2 && j === 2 ? ' base' : ''}`}
                        style={heatStyle(cell.valuePerShare, grid.min, grid.max)}
                        title={cell.valuePerShare === null ? 'Rejected: WACC must exceed g' : undefined}
                      >
                        {cell.valuePerShare === null ? 'WACC ≤ g' : `$${cell.valuePerShare.toFixed(2)}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fine">
              Center cell is the base case. Each step is 0.5 percentage points. {grid.invalidCount > 0 && `${grid.invalidCount} cells rejected by the WACC > g guard.`}
            </p>
          </div>

          {roic && (
            <div className="statement">
              <h3>DuPont ROIC versus WACC (Year 1)</h3>
              <p className="dupont">
                <span>
                  NOPAT margin <strong>{pctText(roic.nopatMargin)}</strong>
                </span>
                <span>×</span>
                <span>
                  Capital turnover <strong>{roic.capitalTurnover.toFixed(2)}x</strong>
                </span>
                <span>=</span>
                <span>
                  ROIC <strong>{pctText(roic.roic)}</strong>
                </span>
              </p>
              <p className={roic.spread >= 0 ? 'spread up' : 'spread down'}>
                ROIC − WACC = {pctText(roic.spread)} → economic profit {money(roic.eva)} $M a year.{' '}
                {roic.spread >= 0 ? 'Growth at this return creates value.' : 'Growth at this return destroys value.'}
              </p>
              <p className="fine">
                Invested capital is illustrative: Year 0 NWC plus net fixed assets of 40% of Year 0 revenue (${money(studioInvestedCapital(inputs))}M).
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
