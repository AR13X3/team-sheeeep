import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import PaddockLayout from '../components/PaddockLayout.jsx';
import SowingCard from '../components/SowingCard.jsx';
import Icon from '../components/Icon.jsx';
import { LineChart } from '../components/charts.jsx';
import { Card, Kpi } from '../components/ui.jsx';
import { FAMILY_LABEL } from '../data/crops.js';
import { BLACKLEG_DISTANCE_M } from '../logic/rotation.js';
import { usePaddock } from '../state/store.jsx';
import { useFarm } from '../state/useFarm.js';
import { useWeather } from '../state/useWeather.js';
import '../styles/paddock.css';
import '../styles/pages.css';

/** Paddock overview: soil health, next crop, blackleg and sowing at a glance, plus its ten-season plan. */
export default function PaddockOverview() {
  const { id } = useParams();
  const { paddock, index, total } = usePaddock(id);
  const farm = useFarm();
  const { weather, error } = useWeather(farm.farmPoint);
  const i = farm.paddocks.findIndex((p) => p.id === id);
  const planned = farm.planned[i];
  const plan = farm.plans[id];
  const alerts = useMemo(() => farm.alerts.filter((a) => a.id.endsWith(`:${id}`)), [farm.alerts, id]);

  if (!paddock || !plan) return <Navigate to="/register" replace />;
  const end = plan.seasons.at(-1).health;
  const next = plan.seasons[0];
  const bl = planned?.blackleg;
  const risky = bl?.distanceM != null && bl.distanceM < BLACKLEG_DISTANCE_M;

  return (
    <PaddockLayout paddock={paddock} index={index} total={total} step="">
      <div className="grid-3">
        <Kpi label="Soil health after the plan" icon="leaf" value={end} unit="/ 100" delta={end - plan.base} deltaLabel={`from ${plan.base} today`} />
        <Kpi label={`Next season · ${farm.years[0]}`} icon="sprout" value={null}>
          <p className="kpi-crop">
            <span className="crop-dot" style={{ background: next.crop.color }} />
            {next.crop.name}
          </p>
          <p className="kpi__foot">{next.why.length ? next.why.join(' · ') : FAMILY_LABEL[next.crop.family]}</p>
        </Kpi>
        <Kpi label="Blackleg" icon="alert" value={null} tone={risky ? 'alert' : undefined}>
          <p className={`kpi-crop${risky ? ' is-bad' : ''}`}>{bl?.distanceM == null ? 'No canola nearby' : risky ? `Canola ${bl.distanceM} m away` : `Nearest canola ${bl.distanceM} m`}</p>
          <p className="kpi__foot">{bl?.year ? `Seen flowering from space in ${bl.year}` : farm.space.result ? 'From the satellite canola map' : 'Waiting for the satellite record'}</p>
        </Kpi>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a) => (
            <Link key={a.id} to={a.to} className={`alert alert--${a.tone}`}>
              <span className="alert__icon">
                <Icon name={a.icon} size={15} />
              </span>
              <span>
                <span className="alert__title">{a.title}</span>
                <span className="alert__text">{a.text}</span>
              </span>
              <Icon name="chevron-right" size={16} className="alert__go" />
            </Link>
          ))}
        </div>
      )}

      <Card title="Ten-season plan" subtitle="Best crop each season and why. Change priorities to steer it." icon="planner">
        <ol className="timeline">
          {plan.seasons.map((s, k) => (
            <li key={k} className="timeline__item" style={{ '--crop': s.crop.color }}>
              <span className="timeline__year num">
                {farm.years[k]}
                {k === 0 && <span className="badge badge--accent">Next</span>}
              </span>
              <span className="timeline__crop">{s.crop.name}</span>
              <span className="timeline__why">{s.why.length ? s.why.join(' · ') : FAMILY_LABEL[s.crop.family]}</span>
              <span className="timeline__health num">Soil health {s.health}</span>
            </li>
          ))}
        </ol>
        {next.note && (
          <p className="callout callout--warn plan-note">
            <Icon name="alert" size={16} />
            <span>{next.note}</span>
          </p>
        )}
      </Card>

      <div className="split">
        <Card title="Soil health outlook" subtitle={`${paddock.name} across the plan (0–100)`} icon="leaf">
          <LineChart labels={farm.years} values={plan.seasons.map((s) => s.health)} baseline={plan.base} baselineLabel={`Today ${plan.base}`} seriesLabel={paddock.name} height={200} />
        </Card>
        <SowingCard cropIds={[next.crop.id]} weather={weather} error={error} lat={farm.farmPoint?.[0] ?? -35} seasonLabel={farm.labels[0]} compact />
      </div>
    </PaddockLayout>
  );
}
