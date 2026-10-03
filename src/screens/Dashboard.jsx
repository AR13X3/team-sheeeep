import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Art, { SheepAvatar } from '../components/Art.jsx';
import { Button, Card } from '../components/ui.jsx';
import { PLAN_SEASONS } from '../config.js';
import { planFarm } from '../logic/rotation.js';
import { allowedCrops } from '../logic/cropSet.js';
import { sowingLabels } from '../logic/seasons.js';
import { areaHa, formatHa } from '../logic/geometry.js';
import { useStore } from '../state/store.jsx';
import { useSpace } from '../state/useSpace.js';
import { withSpaceAll } from '../logic/spacePlanning.js';
import { useWeather } from '../state/useWeather.js';
import { rotationReport } from '../logic/performance.js';
import { interiorPoint } from '../logic/geometry.js';
import RotationReportCard from '../components/RotationReportCard.jsx';
import '../styles/space.css';
import '../styles/screens.css';

/** The design's Dashboard frame is just the title and the pond; these cards summarise the farm. */
export default function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();
  const { paddocks } = state;
  const labels = useMemo(() => sowingLabels(PLAN_SEASONS), []);
  const space = useSpace();
  const planned = useMemo(() => withSpaceAll(paddocks, space.result), [paddocks, space.result]);
  const farmPoint = useMemo(() => (paddocks.length ? interiorPoint(paddocks[0].coords) : null), [paddocks]);
  const { weather } = useWeather(farmPoint);
  const report = useMemo(() => rotationReport(space.result, weather, paddocks), [space.result, weather, paddocks]);
  const crops = useMemo(() => allowedCrops(state.farm), [state.farm]);
  const { plans, farmHealth, baseHealth } = useMemo(() => planFarm(planned, PLAN_SEASONS, crops), [planned, crops]);

  const totalHa = paddocks.reduce((s, p) => s + areaHa(p.coords), 0);
  const nextCrops = useMemo(() => {
    const byCrop = new Map();
    for (const p of paddocks) {
      const crop = plans[p.id].seasons[0].crop;
      const entry = byCrop.get(crop.id) || { crop, ha: 0 };
      entry.ha += areaHa(p.coords);
      byCrop.set(crop.id, entry);
    }
    return [...byCrop.values()].sort((a, b) => b.ha - a.ha);
  }, [paddocks, plans]);

  return (
    <Screen scene="pond" title="Dashboard" menu>
      <div className="dashboard">
        {!paddocks.length ? (
          <Card className="dashboard__empty">
            <Art name="manami-large" className="dashboard__mascot" label="Manami the sheep" />
            <h2 className="card__title">No paddocks yet</h2>
            <p>Outline your paddocks and I’ll put together a crop rotation plan.</p>
            <Button icon="plus" onClick={() => navigate('/paddocks')}>
              Outline paddocks
            </Button>
          </Card>
        ) : (
          <>
            <Card title={state.user ? `${state.user.name}’s farm` : 'Your farm'} className="stat-card">
              <p className="stat">
                {paddocks.length} <span>paddock{paddocks.length > 1 ? 's' : ''}</span>
              </p>
              <p className="muted">{formatHa(totalHa)} ha outlined</p>
              <div className="flock" aria-hidden="true">
                {paddocks.slice(0, 6).map((p) => (
                  <SheepAvatar key={p.id} n={p.sheep} size={40} />
                ))}
              </div>
            </Card>

            <Card title="Next season" className="stat-card">
              <p className="muted small">Sown {labels[0]}</p>
              <ul className="crop-mix">
                {nextCrops.map(({ crop, ha }) => (
                  <li key={crop.id}>
                    <span className="crop-dot" style={{ background: crop.color }} />
                    <span>{crop.name}</span>
                    <span className="muted">{formatHa(ha)} ha</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Soil health" className="stat-card">
              <p className="stat">
                {baseHealth}% <span>→ {farmHealth[PLAN_SEASONS - 1]}%</span>
              </p>
              <p className="muted small">today → after {PLAN_SEASONS} seasons of the plan</p>
              <ProgressBar value={farmHealth[PLAN_SEASONS - 1]} label="Projected soil health at the end of the plan" />
            </Card>

            <RotationReportCard report={report} running={space.running} />

            <div className="dashboard__actions">
              <Button iconEnd="arrow-forward" onClick={() => navigate('/planner')}>
                Open planner
              </Button>
              <Button tone="secondary" icon="edit" onClick={() => navigate('/paddocks')}>
                Edit paddocks
              </Button>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
