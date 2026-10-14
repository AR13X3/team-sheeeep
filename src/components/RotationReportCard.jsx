import Icon from './Icon.jsx';
import { Badge, Card, Source, Status } from './ui.jsx';

const pct = (v) => `${Math.abs(Math.round(v * 100))}%`;

/** "Did my rotation work?" — cereals after a break crop vs after another cereal, from space. */
export default function RotationReportCard({ report, running, showYears = true }) {
  if (!report) {
    return (
      <Card title="Did my rotation work?" subtitle="Cereal vigour after a break crop vs after a cereal" icon="target">
        {running ? <Status state="loading">Reading your farm’s satellite record…</Status> : <p className="muted">The answer appears once the satellite record has been read.</p>}
      </Card>
    );
  }
  const { afterBreak, afterCereal, difference, years, enough } = report;
  const max = Math.max(afterBreak.mean ?? 0, afterCereal.mean ?? 0, 1.2);
  const good = difference != null && difference >= 0;
  return (
    <Card
      title="Did my rotation work?"
      subtitle="Cereal vigour after a break crop vs after a cereal, from space"
      icon="target"
      actions={difference != null && <Badge tone={good ? 'ok' : 'warn'} icon={good ? 'trend-up' : 'trend-down'}>{good ? '+' : '−'}{pct(difference)}</Badge>}
    >
      <p className="report__headline">
        {difference == null ? 'Not enough rotations in your satellite record yet to compare.' : (
          <>
            Cereals grown after a break crop were <strong>{pct(difference)} {good ? 'more' : 'less'} vigorous</strong> than cereals after cereals.
          </>
        )}
      </p>
      <div className="report__bars">
        {[
          ['After a break crop', afterBreak, true],
          ['After a cereal', afterCereal, false],
        ].map(([label, g, br]) => (
          <div key={label} className="report__row">
            <span className="report__label">{label}</span>
            <span className="report__track">
              <span style={{ width: `${((g.mean ?? 0) / max) * 100}%` }} className={br ? 'is-break' : ''} />
            </span>
            <span className="report__value num">
              {g.mean != null ? `${g.mean.toFixed(2)}×` : '–'} <em>n={g.n}</em>
            </span>
          </div>
        ))}
      </div>
      {!enough && (
        <p className="report__hint">
          <Icon name="info" size={13} /> Based on only a few paddock-seasons, so treat it as a first hint. It firms up every season.
        </p>
      )}
      {showYears && years.length > 0 && (
        <div className="table-wrap report__years">
          <table className="table">
            <thead>
              <tr>
                <th>Season</th>
                <th className="is-num">{report.rainLabel || 'Growing-season rain'}</th>
                <th className="is-num">Water-limited wheat</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td className="is-num">{y.rainMm != null ? `${y.rainMm} mm` : '–'}</td>
                  <td className="is-num">{y.potential != null ? `${y.potential.toFixed(1)} t/ha` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Source>
        Vigour = area under each season’s NASA HLS greenness curve, compared with the farm’s other cropped paddocks that season (1.00× = farm average). Rain: NASA POWER. Water-limited yield: French &amp; Schultz benchmark.
      </Source>
    </Card>
  );
}
