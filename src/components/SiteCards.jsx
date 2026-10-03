// The "auto filled" cards from the design (Soil, Slope, Prices), backed by real data.
import { Card, Status } from './ui.jsx';
import { describePh } from '../services/soil.js';
import { describeSlope } from '../services/terrain.js';
import { CROP_BY_ID } from '../data/crops.js';

const fmt = (v, dp = 1) => (v == null ? '–' : Number(v).toFixed(dp));

export function SoilFacts({ soil, climate }) {
  return (
    <dl className="facts">
      {soil ? (
        <>
          <div>
            <dt>Texture</dt>
            <dd>{soil.texture || '–'}</dd>
          </div>
          <div>
            <dt>pH</dt>
            <dd>
              {fmt(soil.ph)} <span className="muted">{describePh(soil.ph)}</span>
            </dd>
          </div>
          <div>
            <dt>Clay / Sand</dt>
            <dd>
              {fmt(soil.clay, 0)}% / {fmt(soil.sand, 0)}%
            </dd>
          </div>
          <div>
            <dt>Organic carbon</dt>
            <dd>{fmt(soil.soc)} g/kg</dd>
          </div>
        </>
      ) : null}
      {climate ? (
        <>
          <div>
            <dt>Rainfall</dt>
            <dd>
              {Math.round(climate.rainfallMm)} mm/yr <span className="muted">({Math.round(climate.growingSeasonRainMm)} in season)</span>
            </dd>
          </div>
          <div>
            <dt>Root-zone moisture</dt>
            <dd>{Math.round(climate.rootZoneWetness * 100)}%</dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}

export function SoilCard({ paddock, status = {} }) {
  const soil = paddock.site?.soil;
  const climate = paddock.site?.climate;
  return (
    <Card title="Soil" className="data-card">
      <Status state={status.soil} />
      {soil === null && <p className="status">No soil data for this spot (water or built-up area).</p>}
      <Status state={status.climate}>Fetching NASA climate data…</Status>
      <SoilFacts soil={soil} climate={climate} />
      {(soil || climate) && (
        <p className="source">
          {[soil && 'ISRIC SoilGrids (0–30 cm)', climate && 'NASA POWER'].filter(Boolean).join(' · ')}
        </p>
      )}
    </Card>
  );
}

export function SlopeCard({ paddock, status = {} }) {
  const t = paddock.site?.terrain;
  return (
    <Card title="Slope" className="data-card">
      <Status state={status.terrain} />
      {t && (
        <>
          <dl className="facts">
            <div>
              <dt>Slope</dt>
              <dd>
                {fmt(t.slopePct)}% <span className="muted">{describeSlope(t.slopePct)}</span>
              </dd>
            </div>
            <div>
              <dt>Faces</dt>
              <dd>{t.aspect}</dd>
            </div>
            {t.reliefM != null && (
              <div>
                <dt>Height difference</dt>
                <dd>{Math.round(t.reliefM)} m</dd>
              </div>
            )}
            <div>
              <dt>Elevation</dt>
              <dd>{Math.round(t.elevationM)} m</dd>
            </div>
          </dl>
          <p className="source">Average across the paddock · Copernicus 90 m DEM via Open-Meteo</p>
        </>
      )}
    </Card>
  );
}

/** Indicative prices for the crops the planner is leaning towards. */
export function PricesCard({ cropIds }) {
  const crops = cropIds.map((id) => CROP_BY_ID[id]).filter(Boolean);
  return (
    <Card title="Prices" className="data-card">
      <ul className="price-list">
        {crops.map((c) => (
          <li key={c.id}>
            <span className="crop-dot" style={{ background: c.color }} />
            <span className="price-list__name">{c.name}</span>
            <span className="price-list__value">{c.price ? `$${c.price}/t` : c.id === 'pasture' ? 'wool & meat' : '–'}</span>
          </li>
        ))}
      </ul>
      <p className="source">Indicative AUD example prices — not live market data.</p>
    </Card>
  );
}
