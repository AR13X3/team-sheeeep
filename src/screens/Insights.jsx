import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import RotationReportCard from '../components/RotationReportCard.jsx';
import SowingCard from '../components/SowingCard.jsx';
import Icon from '../components/Icon.jsx';
import { SheepAvatar } from '../components/Art.jsx';
import { BarChart } from '../components/charts.jsx';
import { Badge, Button, Card, EmptyState, Progress, Source } from '../components/ui.jsx';
import { CROP_BY_ID } from '../data/crops.js';
import { rotationReport } from '../logic/performance.js';
import { BLACKLEG_DISTANCE_M } from '../logic/rotation.js';
import { CROP_PHENOLOGY } from '../logic/sowing.js';
import { useFarm } from '../state/useFarm.js';
import { useWeather } from '../state/useWeather.js';
import '../styles/insights.css';
import '../styles/pages.css';
import '../styles/paddock.css';

const CONF = { high: 'Sure', medium: 'Likely', low: 'Best guess' };

/** Paddock memory from space: what each paddock grew each season, as one grid. */
function SpaceMatrix({ farm }) {
  const { space, paddocks } = farm;
  const result = space.result;
  if (!result) {
    return (
      <Card title="Paddock memory from space" subtitle="What NASA satellites saw on every paddock, season by season" icon="satellite">
        {space.running ? (
          <div className="space-wait">
            <p>
              Reading NASA satellite images of your farm<span className="num">{space.progress.total ? ` · ${space.progress.done} of ${space.progress.total}` : '…'}</span>
            </p>
            <Progress value={space.progress.total ? (space.progress.done / space.progress.total) * 100 : 4} tone="teal" label="Satellite images read" />
          </div>
        ) : (
          <EmptyState icon="satellite" title={space.error ? 'Couldn’t read the satellite images' : 'Not read yet'} action={<Button icon={space.error ? 'refresh' : 'satellite'} onClick={space.start}>{space.error ? 'Try again' : 'Read from space'}</Button>}>
            {space.error || 'About 100 NASA images of your farm, read once and cached.'}
          </EmptyState>
        )}
      </Card>
    );
  }
  const years = result.paddocks[paddocks[0]?.id]?.seasons.map((s) => s.year) || [];
  return (
    <Card flush title="Paddock memory from space" subtitle={`What NASA satellites saw on every paddock · ${result.looks} images`} icon="satellite" actions={<Badge tone="info">NASA HLS 30 m</Badge>}>
      <div className="table-wrap">
        <table className="table memory">
          <thead>
            <tr>
              <th>Paddock</th>
              {years.map((y) => (
                <th key={y}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paddocks.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/paddocks/${p.id}/history`} className="pname">
                    <span className="pname__avatar">
                      <SheepAvatar n={p.sheep} size={24} />
                    </span>
                    {p.name}
                  </Link>
                </td>
                {(result.paddocks[p.id]?.seasons || []).map((s) => {
                  const crop = s.cropId && CROP_BY_ID[s.cropId];
                  return (
                    <td key={s.year}>
                      <span className="memory__cell" style={{ '--crop': crop?.color || 'transparent' }} title={s.evidence || s.reason}>
                        <strong>{crop ? crop.name : '—'}</strong>
                        <span className={`memory__conf memory__conf--${s.confidence || 'none'}`}>{s.confidence ? CONF[s.confidence] : s.complete ? 'Too cloudy' : 'In progress'}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="memory__foot">
        <Source>Crop type from each season’s greenness curve; canola from its yellow flowering. Checked against USDA crop maps: canola found 85–96% of the time; crop type right 78–88%.</Source>
      </div>
    </Card>
  );
}

function BlacklegCard({ farm }) {
  const { space, planned } = farm;
  const canola = space.result?.canola;
  return (
    <Card title="Neighbour canola and blackleg" subtitle={canola ? `Canola seen flowering in ${canola.year}; spores travel ~${BLACKLEG_DISTANCE_M} m` : 'Distance from each paddock to last season’s canola'} icon="alert">
      {!canola ? (
        <p className="muted">{space.running ? 'Waiting for the satellite canola map…' : 'Appears once the satellite record has been read.'}</p>
      ) : (
        <ul className="distance-list">
          {planned.map((p) => {
            const d = p.blackleg?.distanceM;
            const risky = d != null && d < BLACKLEG_DISTANCE_M;
            const w = d == null ? 100 : Math.min(100, (d / (BLACKLEG_DISTANCE_M * 2)) * 100);
            return (
              <li key={p.id}>
                <span className="distance-list__name">{p.name}</span>
                <span className="distance-list__track">
                  <span className="distance-list__limit" style={{ left: '50%' }} />
                  <span className={`distance-list__bar${risky ? ' is-risky' : ''}`} style={{ width: `${Math.max(3, w)}%` }} />
                </span>
                <span className="distance-list__value num">{d == null ? 'none' : d < 30 ? 'next to it' : `${d} m`}</span>
                {risky ? <Badge tone="bad">Risk</Badge> : <Badge tone="ok">Clear</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      <Source>Canola map from NASA HLS flowering detection. The line marks {BLACKLEG_DISTANCE_M} m (GRDC blackleg guidance).</Source>
    </Card>
  );
}

export default function Insights() {
  const farm = useFarm();
  const { paddocks, space, farmPoint, crops, labels } = farm;
  const { weather, error } = useWeather(farmPoint);
  const report = useMemo(() => rotationReport(space.result, weather, paddocks), [space.result, weather, paddocks]);
  const normal = paddocks[0]?.site?.climate?.growingSeasonRainMm;
  const rainItems = (report?.years || []).map((y) => ({ label: String(y.year), value: y.rainMm }));
  const sowIds = crops.filter((c) => CROP_PHENOLOGY[c.id]).map((c) => c.id);

  if (!paddocks.length)
    return (
      <Page title="Insights" description="Evidence from your own farm, read from NASA satellites and 30 years of weather." tip="insights">
        <Card>
          <EmptyState icon="insights" title="Nothing to show yet">
            Map your paddocks first. Insights appear once the satellite record and weather have been read.
          </EmptyState>
        </Card>
      </Page>
    );

  return (
    <Page wide title="Insights" description="Evidence from your own farm, read from NASA satellites and 30 years of NASA weather." tip="insights">
      <div className="split split--even">
        <RotationReportCard report={report} running={space.running} showYears={false} />
        <Card title="Growing-season rain" subtitle={report?.rainLabel ? `${report.rainLabel}, by season` : 'Rain in each season of the satellite record'} icon="rain">
          {rainItems.length ? (
            <>
              <BarChart items={rainItems} unit=" mm" color="var(--chart-1)" reference={normal} referenceLabel={normal ? `Long-term ${Math.round(normal)} mm` : undefined} />
              <div className="rain-table">
                {(report?.years || []).map((y) => (
                  <span key={y.year}>
                    <strong className="num">{y.year}</strong> water-limited wheat <b className="num">{y.potential != null ? `${y.potential.toFixed(1)} t/ha` : '–'}</b>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">{weather || error ? 'No rainfall record for these seasons.' : 'Fetching 30 years of NASA POWER weather…'}</p>
          )}
          <Source>NASA POWER daily rainfall. Water-limited wheat yield: French &amp; Schultz, (rain − 110 mm) × 20 kg/ha/mm.</Source>
        </Card>
      </div>

      <SpaceMatrix farm={farm} />

      <div className="split split--even">
        <BlacklegCard farm={farm} />
        <SowingCard cropIds={sowIds} weather={weather} error={error} lat={farmPoint?.[0] ?? -35} seasonLabel={labels[0]} compact />
      </div>
      <p className="muted small insights__note">
        <Icon name="info" size={13} /> Every number on this page is computed in your browser from public NASA and ISRIC data. Nothing about your farm is uploaded.
      </p>
    </Page>
  );
}
