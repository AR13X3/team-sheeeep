import { Card, Status } from './ui.jsx';

const pct = (v) => `${Math.abs(Math.round(v * 100))}%`;

/** "Did my rotation work?" — cereals after a break crop vs after another cereal, from space. */
export default function RotationReportCard({ report, running }) {
  if (!report) {
    return (
      <Card title="Did my rotation work?" className="report-card">
        {running ? <Status state="loading">Reading your farm’s satellite record…</Status> : <p className="small">Open a paddock’s details once to read its history from space.</p>}
      </Card>
    );
  }
  const { afterBreak, afterCereal, difference, years, enough } = report;
  const max = Math.max(afterBreak.mean ?? 0, afterCereal.mean ?? 0, 1.2);
  return (
    <Card title="Did my rotation work?" className="report-card">
      <div className="report-card__grid">
        <div>
          <p className="report-card__headline">
            {difference == null
              ? 'Not enough rotations in your satellite record yet to compare.'
              : `Cereals grown after a break crop were ${pct(difference)} ${difference >= 0 ? 'more' : 'less'} vigorous than cereals after cereals.`}
          </p>
          <div className="report-bars">
            {[
              ['After a break crop', afterBreak],
              ['After a cereal', afterCereal],
            ].map(([label, g]) => (
              <div key={label} className="report-bars__row">
                <span>{label}</span>
                <span className="report-bars__track">
                  <span style={{ width: `${((g.mean ?? 0) / max) * 100}%` }} className={g === afterBreak ? 'is-break' : ''} />
                </span>
                <span className="report-bars__value">{g.mean != null ? `${g.mean.toFixed(2)}×` : '–'} <em>n={g.n}</em></span>
              </div>
            ))}
          </div>
          {!enough && <p className="small muted report-card__hint">Based on only a few paddock-seasons, so treat it as a first hint. It firms up every season.</p>}
        </div>
        <table className="report-years">
          <thead>
            <tr>
              <th>Season</th>
              <th>{report.rainLabel || 'Growing-season rain'}</th>
              <th>Water-limited wheat</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{y.rainMm != null ? `${y.rainMm} mm` : '–'}</td>
                <td>{y.potential != null ? `${y.potential.toFixed(1)} t/ha` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="source">
        Vigour = area under each season’s NASA HLS greenness curve, compared with the farm’s other cropped paddocks that season (1.00× = farm average). Rain: NASA POWER.
        Water-limited yield: French &amp; Schultz benchmark.
      </p>
    </Card>
  );
}
