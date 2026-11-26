import { useMemo, useState } from 'react';
import {
  ASSUMPTIONS,
  DEFAULT_INPUTS,
  INPUT_SPECS,
  fcfBridge,
  runModel,
  type LinkerInputs,
  type YearResult,
} from '../lib/threeStatement';

type RowKey = keyof Omit<YearResult, 'year'>;

interface Row {
  key: RowKey;
  label: string;
  strong?: boolean;
  /** Row only has meaning for forecast years (flows), so Year 0 shows a dash. */
  flow?: boolean;
}

const INCOME_ROWS: Row[] = [
  { key: 'revenue', label: 'Revenue', strong: true },
  { key: 'cogs', label: 'COGS' },
  { key: 'grossProfit', label: 'Gross profit', strong: true },
  { key: 'opex', label: 'Operating expenses', flow: true },
  { key: 'depreciation', label: 'Depreciation', flow: true },
  { key: 'ebit', label: 'Operating income (EBIT)', strong: true, flow: true },
  { key: 'interest', label: 'Interest on revolver', flow: true },
  { key: 'tax', label: `Tax (${ASSUMPTIONS.taxRatePct}% if profitable)`, flow: true },
  { key: 'netIncome', label: 'Net income', strong: true, flow: true },
];

const BALANCE_ROWS: Row[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'receivables', label: 'Accounts receivable' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'netPpe', label: 'Net PP&E' },
  { key: 'totalAssets', label: 'Total assets', strong: true },
  { key: 'payables', label: 'Accounts payable' },
  { key: 'deferredRevenue', label: 'Deferred revenue' },
  { key: 'revolver', label: 'Revolver debt' },
  { key: 'totalLiabilities', label: 'Total liabilities', strong: true },
  { key: 'commonStock', label: 'Common stock' },
  { key: 'retainedEarnings', label: 'Retained earnings' },
  { key: 'totalEquity', label: 'Total equity', strong: true },
];

const CASH_ROWS: Row[] = [
  { key: 'netIncome', label: 'Net income', flow: true },
  { key: 'depreciation', label: '+ Depreciation', flow: true },
  { key: 'changeReceivables', label: '(Increase) / decrease in receivables', flow: true },
  { key: 'changeInventory', label: '(Increase) / decrease in inventory', flow: true },
  { key: 'changePayables', label: 'Increase / (decrease) in payables', flow: true },
  { key: 'changeDeferredRevenue', label: 'Increase / (decrease) in deferred revenue', flow: true },
  { key: 'cfo', label: 'Cash from operations', strong: true, flow: true },
  { key: 'cfi', label: 'Cash from investing (CapEx)', strong: true, flow: true },
  { key: 'cff', label: 'Cash from financing (revolver)', strong: true, flow: true },
  { key: 'netChangeInCash', label: 'Net change in cash', strong: true, flow: true },
  { key: 'fcf', label: 'Free cash flow (CFO − CapEx)', strong: true, flow: true },
];

/** Signs shown in the cash flow table: working capital increases are uses of cash. */
const NEGATE_IN_CFS = new Set<RowKey>(['changeReceivables', 'changeInventory']);

export function formatMoney(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '0.0';
  const abs = Math.abs(rounded).toFixed(1);
  return rounded < 0 ? `(${abs})` : abs;
}

function StatementTable({ title, rows, years, negate }: { title: string; rows: Row[]; years: YearResult[]; negate?: Set<RowKey> }) {
  return (
    <div className="statement">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">$M</th>
            {years.map((y) => (
              <th scope="col" key={y.year}>
                {y.year === 0 ? 'Year 0' : `Year ${y.year}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.strong ? 'strong' : undefined}>
              <th scope="row">{r.label}</th>
              {years.map((y) => {
                const raw = y[r.key];
                const v = negate?.has(r.key) ? -raw : raw;
                return (
                  <td key={y.year} className={v < 0 ? 'neg' : undefined}>
                    {r.flow && y.year === 0 ? '—' : formatMoney(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Waterfall({ year }: { year: YearResult }) {
  const steps = fcfBridge(year);
  const width = 680;
  const height = 270;
  const pad = { top: 22, bottom: 58, left: 44, right: 12 };
  let running = 0;
  const bars = steps.map((s) => {
    if (s.kind === 'start') {
      running = s.value;
      return { ...s, from: 0, to: s.value };
    }
    if (s.kind === 'total') return { ...s, from: 0, to: s.value };
    const from = running;
    running += s.value;
    return { ...s, from, to: running };
  });
  const values = bars.flatMap((b) => [b.from, b.to, 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const y = (v: number) => pad.top + ((max - v) / span) * (height - pad.top - pad.bottom);
  const slot = (width - pad.left - pad.right) / bars.length;
  const barW = slot * 0.62;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="waterfall" role="img" aria-label={`Bridge from net income to free cash flow, Year ${year.year}`}>
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="axis" />
      {bars.map((b, i) => {
        const x = pad.left + i * slot + (slot - barW) / 2;
        const top = y(Math.max(b.from, b.to));
        const h = Math.max(1, Math.abs(y(b.from) - y(b.to)));
        const cls = b.kind === 'delta' ? (b.value >= 0 ? 'up' : 'down') : b.kind;
        return (
          <g key={b.label}>
            <rect x={x} y={top} width={barW} height={h} className={`wf ${cls}`} rx={2} />
            <text x={x + barW / 2} y={top - 6} textAnchor="middle" className="wf-value">
              {formatMoney(b.value)}
            </text>
            <text x={x + barW / 2} y={height - pad.bottom + 16} textAnchor="middle" className="wf-label">
              {b.label.split(' ').slice(0, 2).join(' ')}
            </text>
            <text x={x + barW / 2} y={height - pad.bottom + 30} textAnchor="middle" className="wf-label">
              {b.label.split(' ').slice(2).join(' ')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LinkerSandbox() {
  const [inputs, setInputs] = useState<LinkerInputs>(DEFAULT_INPUTS);
  const [bridgeYear, setBridgeYear] = useState(3);
  const result = useMemo(() => runModel(inputs), [inputs]);
  const selected = result.years[bridgeYear] ?? result.years[result.years.length - 1];

  return (
    <section className="linker" aria-label="Three-statement linker sandbox">
      <div className="linker-intro">
        <p>
          Move a slider and watch all three statements re-link. Cash is never typed in: it comes out of the cash flow statement, and a revolver
          borrows to keep at least ${ASSUMPTIONS.minimumCash}M on hand. Year 0 is an <em>illustrative</em> company, not a real filing.
        </p>
        <div className={`badge ${result.balanced ? 'ok' : 'bad'}`} role="status">
          {result.balanced ? '✓ Assets === Liabilities + Equity' : `✗ Out of balance by ${result.maxBalanceGap.toExponential(2)}`}
        </div>
      </div>

      <div className="sliders">
        {INPUT_SPECS.map((s) => (
          <label key={s.key} className="slider" title={s.help}>
            <span className="slider-head">
              <span>{s.label}</span>
              <output>
                {s.unit === '$M' ? `$${inputs[s.key]}M` : `${inputs[s.key]}${s.unit === '%' ? '%' : ` ${s.unit}`}`}
              </output>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={inputs[s.key]}
              onChange={(e) => setInputs((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
            />
            <small>{s.help}</small>
          </label>
        ))}
        <div className="slider-actions">
          <button type="button" onClick={() => setInputs(DEFAULT_INPUTS)}>
            Reset sliders
          </button>
          <p className="fine">
            Fixed: tax {ASSUMPTIONS.taxRatePct}%, revolver rate {ASSUMPTIONS.revolverRatePct}%, existing PP&E depreciates over{' '}
            {ASSUMPTIONS.existingPpeLifeYears} years, no dividends or equity raises.
          </p>
        </div>
      </div>

      <div className="statements">
        <StatementTable title="Income statement" rows={INCOME_ROWS} years={result.years} />
        <StatementTable title="Balance sheet" rows={BALANCE_ROWS} years={result.years} />
        <StatementTable title="Cash flow statement" rows={CASH_ROWS} years={result.years} negate={NEGATE_IN_CFS} />
      </div>

      {selected && (
        <div className="bridge">
          <div className="bridge-head">
            <h3>Free cash flow bridge</h3>
            <div className="seg" role="group" aria-label="Bridge year">
              {[1, 2, 3].map((yr) => (
                <button key={yr} type="button" className={bridgeYear === yr ? 'on' : ''} aria-pressed={bridgeYear === yr} onClick={() => setBridgeYear(yr)}>
                  Year {yr}
                </button>
              ))}
            </div>
          </div>
          <Waterfall year={selected} />
        </div>
      )}
    </section>
  );
}
