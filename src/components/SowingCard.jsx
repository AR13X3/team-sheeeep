import { useMemo } from 'react';
import { Card, Status } from './ui.jsx';
import { sowingRisk, fmtMMDD, CROP_PHENOLOGY } from '../logic/sowing.js';
import { CROP_BY_ID } from '../data/crops.js';

const pct = (v) => `${Math.round(v * 100)}%`;

function RiskChart({ result }) {
  const W = 260, H = 64, pad = 4;
  const d = result.dates.filter((x) => x.risk != null);
  if (d.length < 2) return null;
  const x = (i) => pad + (i / (result.dates.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - v * (H - 2 * pad);
  const line = (k) => result.dates.map((p, i) => (p[k] == null ? null : `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`)).filter(Boolean).join(' ');
  const i0 = result.dates.findIndex((p) => p.sow === result.window[0]);
  const i1 = result.dates.findIndex((p) => p.sow === result.window[1]);
  return (
    <svg className="risk-chart" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`Frost and heat risk by sowing date; best window ${fmtMMDD(result.window[0])} to ${fmtMMDD(result.window[1])}`}>
      <rect x={x(i0) - 4} y={pad - 2} width={Math.max(8, x(i1) - x(i0) + 8)} height={H - pad} rx="4" className="risk-chart__window" />
      <polyline points={line('frost')} className="risk-chart__frost" />
      <polyline points={line('heat')} className="risk-chart__heat" />
      <polyline points={line('risk')} className="risk-chart__risk" />
      <text x={pad} y={H + 12} className="risk-chart__axis">{fmtMMDD(result.dates[0].sow)}</text>
      <text x={W - pad} y={H + 12} textAnchor="end" className="risk-chart__axis">{fmtMMDD(result.dates.at(-1).sow)}</text>
    </svg>
  );
}

/**
 * Safest sowing window for each crop planned in a season, from 30 years of NASA POWER daily
 * temperatures: chance of frost at flowering and of heat stress during grain fill.
 */
export default function SowingCard({ cropIds, weather, error, lat, seasonLabel }) {
  const results = useMemo(
    () => (weather ? [...new Set(cropIds)].filter((id) => CROP_PHENOLOGY[id]).map((id) => sowingRisk(weather, id, lat)).filter(Boolean) : []),
    [weather, cropIds.join(), lat],
  );
  const noSowing = [...new Set(cropIds)].filter((id) => !CROP_PHENOLOGY[id]).map((id) => CROP_BY_ID[id]?.name);
  return (
    <Card className="plan-card sowing-card">
      <h2 className="card__title">Sowing window</h2>
      <p className="muted small">
        Season sown {seasonLabel} · from {weather ? `${weather.days.length / 365 | 0} years` : '30 years'} of NASA POWER daily weather
      </p>
      {!weather && !error && <Status state="loading">Fetching 30 years of NASA weather…</Status>}
      {error && <Status state="error">NASA POWER is unavailable right now.</Status>}
      <ul className="sow-list">
        {results.map((r) => {
          const crop = CROP_BY_ID[r.cropId];
          return (
            <li key={r.cropId}>
              <div className="sow-list__head">
                <span className="crop-chip">
                  <span className="crop-dot" style={{ background: crop.color }} />
                  {crop.name}
                </span>
                <strong>
                  Sow {fmtMMDD(r.window[0])}
                  {r.window[1] !== r.window[0] && ` – ${fmtMMDD(r.window[1])}`}
                </strong>
              </div>
              <p className="sow-list__facts">
                Flowers ~{fmtMMDD(r.best.flower)} · frost at flowering {pct(r.best.frost)} of years · heat in grain fill {pct(r.best.heat)}
              </p>
              <RiskChart result={r} />
            </li>
          );
        })}
      </ul>
      {results.length > 0 && (
        <p className="risk-legend">
          <i className="risk-legend__frost" /> frost <i className="risk-legend__heat" /> heat <i className="risk-legend__risk" /> either <i className="risk-legend__window" /> best window
        </p>
      )}
      {noSowing.length > 0 && <p className="small muted">{noSowing.join(', ')}: no sowing date needed.</p>}
      <p className="source">Typical mid-maturity varieties; long- or short-season varieties shift these dates. Frost counted at ≤ 1 °C screen minimum.</p>
    </Card>
  );
}
