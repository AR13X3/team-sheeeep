import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import SeasonStrip from '../components/SeasonStrip.jsx';
import CropSetPicker from '../components/CropSetPicker.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { allowedCrops, describeCropSet, DEFAULT_FARM } from '../logic/cropSet.js';
import { SheepAvatar } from '../components/Art.jsx';
import { Button, Card } from '../components/ui.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { useLoadingGate } from '../state/useLoadingGate.js';
import { PLAN_SEASONS } from '../config.js';
import { planFarm } from '../logic/rotation.js';
import { sowingLabels } from '../logic/seasons.js';
import { FAMILY_LABEL } from '../data/crops.js';
import { useStore } from '../state/store.jsx';
import { useSiteData } from '../state/useSiteData.js';
import { useSpace } from '../state/useSpace.js';
import { withSpaceAll } from '../logic/spacePlanning.js';
import { useWeather } from '../state/useWeather.js';
import { interiorPoint } from '../logic/geometry.js';
import SowingCard from '../components/SowingCard.jsx';
import '../styles/space.css';
import '../styles/screens.css';

/** Loads soil/slope/climate for a paddock and reports its progress to the Planner. */
function SiteDataLoader({ paddock, onStatus }) {
  const status = useSiteData(paddock);
  const loading = Object.values(status).filter((s) => s === 'loading').length;
  useEffect(() => onStatus(paddock.id, loading), [paddock.id, loading, onStatus]);
  return null;
}

const SOURCES_PER_PADDOCK = 3; // soil, slope, climate
const MAX_WAIT_MS = 12000; // don't hold the plan back for a slow service

const pick = (crop) => ({ name: crop.name, color: crop.color });

export default function Planner() {
  const { state, dispatch } = useStore();
  const { paddocks } = state;
  const farm = state.farm ?? DEFAULT_FARM;
  const crops = useMemo(() => allowedCrops(farm), [farm]);
  const [editCrops, setEditCrops] = useState(false);
  const [season, setSeason] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [pendingBy, setPendingBy] = useState({});
  const [gaveUp, setGaveUp] = useState(false);
  const onStatus = useCallback((id, n) => setPendingBy((m) => (m[id] === n ? m : { ...m, [id]: n })), []);
  const pending = Object.values(pendingBy).reduce((a, b) => a + b, 0);
  const showLoading = useLoadingGate(pending > 0 && !gaveUp) && !gaveUp;
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);
  const labels = useMemo(() => sowingLabels(PLAN_SEASONS), []);
  const space = useSpace();
  useEffect(() => {
    space.start();
  }, [space.start]);
  // what the satellites saw fills blank history and adds blackleg risk
  const planned = useMemo(() => withSpaceAll(paddocks, space.result), [paddocks, space.result]);
  const { plans, farmHealth, baseHealth } = useMemo(() => planFarm(planned, PLAN_SEASONS, crops), [planned, crops]);
  const canola = space.result?.canola;
  const farmPoint = useMemo(() => (paddocks.length ? interiorPoint(paddocks[0].coords) : null), [paddocks]);
  const { weather, error: weatherError } = useWeather(farmPoint);
  const overlay = canola && { url: canola.overlay, bounds: [[space.result.bbox[1], space.result.bbox[0]], [space.result.bbox[3], space.result.bbox[2]]] };

  const styleFor = useCallback((p) => ({ fillColor: plans[p.id].seasons[season].crop.color, fillOpacity: 0.7, color: '#ece4d4' }), [plans, season]);
  const labelFor = useCallback((p) => `${p.name} · ${plans[p.id].seasons[season].crop.name}`, [plans, season]);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);

  if (!paddocks.length) return <Navigate to="/paddocks" replace />;
  const last = paddocks[paddocks.length - 1];

  return (
    <Screen scene="field" title="Your Plan" step={4} back={`/paddocks/${last.id}/priorities`} menu chat="planner" className="planner-screen">
      {paddocks.map((p) => (
        <SiteDataLoader key={p.id} paddock={p} onStatus={onStatus} />
      ))}
      {showLoading && (
        <LoadingScreen
          title="Planning your seasons"
          detail="Fetching soil, slope and NASA climate data for each paddock."
          progress={1 - pending / (paddocks.length * SOURCES_PER_PADDOCK)}
          action={
            <Button tone="secondary" size="compact" onClick={() => setGaveUp(true)}>
              Show plan now
            </Button>
          }
        />
      )}
      <div className="cols cols--planner">
        <SeasonStrip
          labels={labels}
          crops={labels.map((_, i) => paddocks.map((p) => ({ paddock: p.name, ...pick(plans[p.id].seasons[i].crop) })))}
          selected={season}
          onChange={setSeason}
          nowIndex={0}
        />
        <div className="cols__left">
          <Card className="map-card">
            <div className="map-frame">
              <PaddockMap paddocks={paddocks} styleFor={styleFor} labelFor={labelFor} tagFor={tagFor} highlightId={hovered} onSelect={(id) => setHovered((h) => (h === id ? null : id))} fitKey={paddocks.length} initialView={state.mapView} overlay={season === 0 ? overlay : null} />
              {season === 0 && canola && (
                <p className="canola-legend">
                  <i /> Canola {canola.year} · blackleg source
                </p>
              )}
              {space.running && !space.result && (
                <p className="map-chip map-note status--loading">Reading satellite history…</p>
              )}
            </div>
          </Card>
          <ProgressBar value={farmHealth[season]} label={`Projected soil health across the farm in the season sown ${labels[season]}`} />
        </div>

        <div className="cols__right">
          <div className="scroll-col scroll-col--planner">
            <Card className="plan-card">
              <div className="plan-card__head">
                <h2 className="card__title">Crops to Grow</h2>
                <button type="button" className="crop-set-btn" onClick={() => setEditCrops(true)} title="Choose which crops (and livestock) the plan may use">
                  <Icon name="edit" size={16} />
                  {describeCropSet(farm)}
                </button>
              </div>
              <p className="muted small">Season sown {labels[season]}</p>
              <ul className="plan-list">
                {paddocks.map((p) => {
                  const s = plans[p.id].seasons[season];
                  return (
                    <li key={p.id} className={hovered === p.id ? 'is-active' : ''} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}>
                      <SheepAvatar n={p.sheep} size={38} />
                      <div className="plan-list__body">
                        <p className="plan-list__title">
                          <strong>{p.name}</strong>
                          <span className="crop-chip">
                            <span className="crop-dot" style={{ background: s.crop.color }} />
                            {s.crop.name}
                          </span>
                        </p>
                        <p className="plan-list__why">{s.why.length ? s.why.join(' · ') : FAMILY_LABEL[s.crop.family]}</p>
                        {s.note && <p className="plan-list__note">{s.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <SowingCard
              cropIds={paddocks.map((p) => plans[p.id].seasons[season].crop.id)}
              weather={weather}
              error={weatherError}
              lat={farmPoint?.[0] ?? -35}
              seasonLabel={labels[season]}
            />

            <Card className="plan-card">
              <h2 className="card__title">Soil Health</h2>
              <p className="muted small">
                Farm today {baseHealth}% → {farmHealth[season]}% after this season
              </p>
              <ul className="health-list">
                {paddocks.map((p) => {
                  const plan = plans[p.id];
                  const h = plan.seasons[season].health;
                  const delta = h - plan.base;
                  return (
                    <li key={p.id}>
                      <span className="health-list__name">{p.name}</span>
                      <span className="health-bar" aria-hidden="true">
                        <span style={{ width: `${h}%` }} />
                      </span>
                      <span className="health-list__value">
                        {h}% <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? `+${delta}` : delta}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="source">Index from soil carbon, pH and known issues, adjusted each season by the crop grown.</p>
            </Card>
          </div>
        </div>
      </div>
      {editCrops && (
        <Modal
          title="Your crops"
          wide
          onClose={() => setEditCrops(false)}
          footer={
            <Button size="compact" icon="done" onClick={() => setEditCrops(false)}>
              Done
            </Button>
          }
        >
          <CropSetPicker farm={farm} onChange={(value) => dispatch({ type: 'setFarm', value })} />
        </Modal>
      )}
    </Screen>
  );
}
