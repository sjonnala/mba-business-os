import { useMemo, useState } from 'react';
import {
  DEFAULT_EXIT,
  DEFAULT_ROUND,
  formatBps,
  runRound,
  waterfall,
  type PreferenceType,
  type RoundInput,
  type SafeInput,
} from '../lib/capTable';

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const usdM = (v: number) => `$${(v / 1_000_000).toFixed(2)}M`;
const shares = (v: number) => Math.round(v).toLocaleString('en-US');

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
          value={value}
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

export function CapTableLab() {
  const [round, setRound] = useState<RoundInput>(DEFAULT_ROUND);
  const [exit, setExit] = useState(DEFAULT_EXIT);
  const [pref, setPref] = useState<PreferenceType>('non-participating');
  const outcome = useMemo(() => runRound(round), [round]);

  const patch = (p: Partial<RoundInput>) => setRound((prev) => ({ ...prev, ...p }));
  const patchSafe = (i: number, p: Partial<SafeInput>) =>
    setRound((prev) => ({ ...prev, safes: prev.safes.map((s, j) => (j === i ? { ...s, ...p } : s)) }));
  const addSafe = () =>
    setRound((prev) => ({
      ...prev,
      safes: [...prev.safes, { label: `SAFE ${prev.safes.length + 1}`, investment: 250_000, postMoneyCap: 12_000_000, discountPct: 0 }],
    }));
  const removeSafe = (i: number) => setRound((prev) => ({ ...prev, safes: prev.safes.filter((_, j) => j !== i) }));

  const payouts = useMemo(() => (outcome.ok ? waterfall(outcome.after, exit, pref) : []), [outcome, exit, pref]);
  const other = useMemo(
    () => (outcome.ok ? waterfall(outcome.after, exit, pref === 'participating' ? 'non-participating' : 'participating') : []),
    [outcome, exit, pref],
  );
  const totalBps = outcome.ok ? outcome.after.reduce((s, r) => s + r.bps, 0) : 0;
  const maxPayout = Math.max(1, ...payouts.map((p) => p.amount), ...other.map((p) => p.amount));

  return (
    <section className="lab" aria-label="SAFE, seed and Series A cap table simulator">
      <div className="linker-intro">
        <p>
          Stack post-money SAFEs, price a Series A with the option pool shuffle, then run a 1x liquidation waterfall. Ownership is allocated in whole
          basis points so the column always totals exactly 100.00%. Defaults are <em>illustrative</em>.
        </p>
        <div className={`badge ${outcome.ok && totalBps === 10000 ? 'ok' : 'bad'}`} role="status">
          {outcome.ok ? `✓ Ownership = ${formatBps(totalBps)}` : '✗ Check inputs'}
        </div>
      </div>

      <div className="lab-columns">
        <div className="cap-inputs">
          <fieldset>
            <legend>Before the round</legend>
            <NumberField label="Founder shares" value={round.founderShares} step={100_000} onChange={(v) => patch({ founderShares: v })} />
            <NumberField label="Existing option pool" value={round.existingPoolShares} step={50_000} onChange={(v) => patch({ existingPoolShares: v })} />
          </fieldset>

          <fieldset>
            <legend>Post-money SAFEs</legend>
            {round.safes.map((s, i) => (
              <div className="safe-row" key={i}>
                <input className="safe-label" aria-label={`SAFE ${i + 1} name`} value={s.label} onChange={(e) => patchSafe(i, { label: e.target.value })} />
                <NumberField label="Investment" value={s.investment} step={50_000} suffix="$" onChange={(v) => patchSafe(i, { investment: v })} />
                <NumberField label="Post-money cap" value={s.postMoneyCap} step={500_000} suffix="$" onChange={(v) => patchSafe(i, { postMoneyCap: v })} />
                <NumberField label="Discount" value={s.discountPct} step={5} max={90} suffix="%" onChange={(v) => patchSafe(i, { discountPct: v })} />
                <button type="button" className="link" onClick={() => removeSafe(i)} aria-label={`Remove ${s.label}`}>
                  Remove
                </button>
              </div>
            ))}
            {round.safes.length < 4 && (
              <button type="button" onClick={addSafe}>
                Add SAFE
              </button>
            )}
          </fieldset>

          <fieldset>
            <legend>Series A</legend>
            <NumberField label="Pre-money valuation" value={round.preMoney} step={1_000_000} suffix="$" onChange={(v) => patch({ preMoney: v })} />
            <NumberField label="New money" value={round.investment} step={500_000} suffix="$" onChange={(v) => patch({ investment: v })} />
            <NumberField label="Target pool (post-money)" value={round.targetPoolPct} step={1} max={50} suffix="%" onChange={(v) => patch({ targetPoolPct: v })} />
          </fieldset>

          <fieldset>
            <legend>Exit</legend>
            <NumberField label="Proceeds to equity" value={exit} step={5_000_000} suffix="$" onChange={setExit} />
            <div className="seg" role="group" aria-label="Preference type">
              {(['non-participating', 'participating'] as const).map((t) => (
                <button key={t} type="button" className={pref === t ? 'on' : ''} aria-pressed={pref === t} onClick={() => setPref(t)}>
                  1x {t}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => { setRound(DEFAULT_ROUND); setExit(DEFAULT_EXIT); }}>
            Reset lab
          </button>
        </div>

        <div className="lab-results">
          {!outcome.ok && (
            <p className="guard" role="alert">
              {outcome.reason}
            </p>
          )}

          {outcome.ok && (
            <>
              <div className="stat-row" aria-live="polite">
                <div className="stat">
                  <span>Series A price</span>
                  <strong>${outcome.pricePerShare.toFixed(4)}</strong>
                  <small>pre-money ÷ {shares(outcome.preMoneyShares)} FD shares</small>
                </div>
                <div className="stat">
                  <span>Post-money</span>
                  <strong>{usdM(outcome.postMoney)}</strong>
                  <small>{shares(outcome.postMoneyShares)} shares</small>
                </div>
                <div className="stat">
                  <span>Pool top-up</span>
                  <strong>{shares(outcome.newPoolShares)}</strong>
                  <small>created inside the pre-money</small>
                </div>
                <div className="stat">
                  <span>Effective pre-money</span>
                  <strong>{usdM(outcome.effectivePreMoney)}</strong>
                  <small>headline less pool and SAFE shares</small>
                </div>
              </div>

              <div className="statement">
                <h3>Cap table</h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Holder</th>
                      <th scope="col">Shares</th>
                      <th scope="col">Ownership</th>
                      <th scope="col">Paid in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.after.map((r) => (
                      <tr key={r.label}>
                        <th scope="row">{r.label}</th>
                        <td>{shares(r.shares)}</td>
                        <td>{formatBps(r.bps)}</td>
                        <td>{r.invested > 0 ? usd(r.invested) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="strong">
                      <th scope="row">Total</th>
                      <td>{shares(outcome.postMoneyShares)}</td>
                      <td>{formatBps(totalBps)}</td>
                      <td>{usd(outcome.after.reduce((s, r) => s + r.invested, 0))}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="fine">
                  Founders before the round: {formatBps(outcome.before[0]?.bps ?? 0)} → after: {formatBps(outcome.after[0]?.bps ?? 0)}.
                </p>
              </div>

              {outcome.safes.length > 0 && (
                <div className="statement">
                  <h3>SAFE conversions</h3>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">SAFE</th>
                        <th scope="col">Cap price</th>
                        <th scope="col">Discount price</th>
                        <th scope="col">Converts at</th>
                        <th scope="col">Shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outcome.safes.map((s) => (
                        <tr key={s.label}>
                          <th scope="row">{s.label}</th>
                          <td className={!s.usedDiscount ? 'pick' : undefined}>${s.capPrice.toFixed(4)}</td>
                          <td className={s.usedDiscount ? 'pick' : undefined}>${s.discountPrice.toFixed(4)}</td>
                          <td>{s.usedDiscount ? 'Discount' : 'Cap'}</td>
                          <td>{shares(s.shares)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="statement">
                <h3>Waterfall at {usdM(exit)} exit</h3>
                <table className="payouts">
                  <thead>
                    <tr>
                      <th scope="col">Holder</th>
                      <th scope="col">1x {pref}</th>
                      <th scope="col">1x {pref === 'participating' ? 'non-participating' : 'participating'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p, i) => {
                      const alt = other[i];
                      return (
                        <tr key={p.label}>
                          <th scope="row">
                            {p.label}
                            {p.converted && <small> converts</small>}
                          </th>
                          <td>
                            <span className="pay-bar" style={{ width: `${(p.amount / maxPayout) * 100}%` }} aria-hidden="true" />
                            {usd(p.amount)}
                          </td>
                          <td className="muted">
                            <span className="pay-bar alt" style={{ width: `${((alt?.amount ?? 0) / maxPayout) * 100}%` }} aria-hidden="true" />
                            {usd(alt?.amount ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="fine">
                  SAFE holders and Series A rank pari passu with a 1x preference equal to cash invested. Options are treated as exercised common, ignoring
                  strike prices.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
