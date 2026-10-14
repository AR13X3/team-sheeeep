// Auto-filled paddock data (soil, terrain, climate) and indicative prices, backed by real datasets.
import { Card, Facts, Skeleton, Source, Status } from './ui.jsx';
import { describePh } from '../services/soil.js';
import { describeSlope } from '../services/terrain.js';
import { CROP_BY_ID } from '../data/crops.js';

const fmt = (v, dp = 1) => (v == null ? '–' : Number(v).toFixed(dp));

const Loading = ({ rows = 4 }) => (
  <div className="facts" style={{ '--cols': 2 }} aria-busy="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="facts__item">
        <Skeleton w={70} h={10} />
        <Skeleton w={110} h={18} className="mt-6" />
      </div>
    ))}
  </div>
);

export function SoilFacts({ soil }) {
  if (!soil) return null;
  return (
    <Facts
      items={[
        { label: 'Texture', value: soil.texture || '–' },
        { label: 'pH (water)', value: fmt(soil.ph), sub: describePh(soil.ph) },
        { label: 'Clay / sand', value: `${fmt(soil.clay, 0)}% / ${fmt(soil.sand, 0)}%` },
        { label: 'Organic carbon', value: `${fmt(soil.soc)} g/kg` },
      ]}
    />
  );
}

export function SoilCard({ paddock, status = {} }) {
  const soil = paddock.site?.soil;
  return (
    <Card title="Soil" subtitle="Top 30 cm at the centre of the paddock" icon="mountain">
      {status.soil === 'loading' && soil === undefined ? <Loading /> : <Status state={status.soil === 'error' ? 'error' : null} />}
      {soil === null && <p className="muted">No soil data for this spot (water or built-up area).</p>}
      <SoilFacts soil={soil} />
      {soil && <Source>ISRIC SoilGrids 2.0 (250 m), 0–30 cm average</Source>}
    </Card>
  );
}

export function TerrainCard({ paddock, status = {} }) {
  const t = paddock.site?.terrain;
  return (
    <Card title="Slope and terrain" subtitle="Fitted across the whole paddock" icon="gauge">
      {status.terrain === 'loading' && !t ? <Loading /> : <Status state={status.terrain === 'error' ? 'error' : null} />}
      {t && (
        <>
          <Facts
            items={[
              { label: 'Slope', value: `${fmt(t.slopePct)}%`, sub: describeSlope(t.slopePct) },
              { label: 'Faces', value: t.aspect },
              t.reliefM != null && { label: 'Height difference', value: `${Math.round(t.reliefM)} m` },
              { label: 'Elevation', value: `${Math.round(t.elevationM)} m` },
            ]}
          />
          <Source>Copernicus 90 m DEM via Open-Meteo</Source>
        </>
      )}
    </Card>
  );
}

export function ClimateCard({ paddock, status = {} }) {
  const c = paddock.site?.climate;
  return (
    <Card title="Climate" subtitle="Long-term averages for this location" icon="rain">
      {status.climate === 'loading' && !c ? <Loading rows={2} /> : <Status state={status.climate === 'error' ? 'error' : null}>NASA POWER is unavailable right now.</Status>}
      {c && (
        <>
          <Facts
            items={[
              { label: 'Rainfall', value: `${Math.round(c.rainfallMm)} mm/yr`, sub: `${Math.round(c.growingSeasonRainMm)} mm in the growing season` },
              { label: 'Root-zone moisture', value: `${Math.round(c.rootZoneWetness * 100)}%`, sub: c.rootZoneWetness < 0.35 ? 'Dry' : c.rootZoneWetness < 0.6 ? 'Moderate' : 'Moist' },
            ]}
          />
          <Source>NASA POWER (satellite + model climate, ~50 km grid)</Source>
        </>
      )}
    </Card>
  );
}

/** Indicative prices for the crops the planner is leaning towards. */
export function PricesCard({ cropIds }) {
  const crops = cropIds.map((id) => CROP_BY_ID[id]).filter(Boolean);
  const max = Math.max(...crops.map((c) => c.price || 0), 1);
  return (
    <Card title="Indicative prices" subtitle="For the crops the plan leans towards" icon="coins">
      <ul className="price-list">
        {crops.map((c) => (
          <li key={c.id}>
            <span className="crop-dot" style={{ background: c.color }} />
            <span className="price-list__name">{c.name}</span>
            <span className="price-list__bar">
              <span style={{ width: `${((c.price || 0) / max) * 100}%`, background: c.color }} />
            </span>
            <span className="price-list__value num">{c.price ? `$${c.price}/t` : c.id === 'pasture' ? 'wool & meat' : '–'}</span>
          </li>
        ))}
      </ul>
      <Source>Indicative AUD example prices, not live market data.</Source>
    </Card>
  );
}
