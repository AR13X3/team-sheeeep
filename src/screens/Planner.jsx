import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import CropSetPicker from '../components/CropSetPicker.jsx';
import SowingCard from '../components/SowingCard.jsx';
import Modal, { Drawer } from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { SheepAvatar } from '../components/Art.jsx';
import { Meter } from '../components/charts.jsx';
import { Badge, Button, Card, CropChip, IconButton, Kpi } from '../components/ui.jsx';
import { describeCropSet } from '../logic/cropSet.js';
import { formatHa } from '../logic/geometry.js';
import { rankNextSeason } from '../logic/rotation.js';
import { FAMILY_LABEL } from '../data/crops.js';
import { useStore } from '../state/store.jsx';
import { useFarm } from '../state/useFarm.js';
import { useWeather } from '../state/useWeather.js';
import { summariseSiteStatus, useAllSiteStatus } from '../state/useSiteData.js';
import { useToast } from '../state/toast.jsx';
import '../styles/planner.css';
import '../styles/paddock.css';

const short = (name) => name.replace(' (sheep)', '').replace(' (hay)', '');

/** CSV of the whole rotation (one row per paddock, one column per season). */
function exportCsv(farm) {
  const { paddocks, plans, years, areas, farmHealth } = farm;
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Paddock', 'Area (ha)', ...years.map(String)]];
  for (const p of paddocks) rows.push([p.name, areas[p.id].toFixed(1), ...plans[p.id].seasons.map((s) => s.crop.name)]);
  rows.push(['Farm soil health (0-100)', '', ...farmHealth.map(String)]);
  const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `rotation-plan-${years[0]}-${years.at(-1)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Why the planner chose a crop, and (for next season) how the alternatives scored. */
function CellDetail({ farm, cell, onClose }) {
  const { paddocks, planned, plans, years, crops } = farm;
  const i = paddocks.findIndex((p) => p.id === cell.paddockId);
  const p = paddocks[i];
  const s = plans[p.id].seasons[cell.season];
  const prevHealth = cell.season ? plans[p.id].seasons[cell.season - 1].health : plans[p.id].base;
  const ranking = useMemo(() => (cell.season === 0 ? rankNextSeason(planned[i], crops).slice(0, 5) : null), [cell.season, planned, i, crops]);
  const top = ranking?.[0]?.score ?? 1;
  const bottom = ranking ? Math.min(...ranking.map((r) => r.score)) : 0;
  return (
    <Drawer
      title={`${p.name} · ${years[cell.season]}`}
      icon={<SheepAvatar n={p.sheep} size={30} />}
      onClose={onClose}
      footer={
        <>
          <Link className="btn btn--ghost btn--md" to={`/paddocks/${p.id}/priorities`} onClick={onClose}>
            <span className="btn__label">Adjust priorities</span>
          </Link>
          <Link className="btn btn--primary btn--md" to={`/paddocks/${p.id}`} onClick={onClose}>
            <span className="btn__label">Open paddock</span>
          </Link>
        </>
      }
    >
      <div className="cell-detail">
        <div className="cell-detail__crop" style={{ '--crop': s.crop.color }}>
          <span className="cell-detail__swatch" />
          <div>
            <p className="cell-detail__name">{s.crop.name}</p>
            <p className="muted small">
              {FAMILY_LABEL[s.crop.family]}
              {s.crop.price ? ` · ~$${s.crop.price}/t` : ''}
            </p>
          </div>
        </div>
        <section>
          <h3 className="cell-detail__h">Why this crop</h3>
          {s.why.length ? (
            <ul className="cell-detail__why">
              {s.why.map((w) => (
                <li key={w}>
                  <Icon name="check" size={14} /> {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Best overall fit for this paddock’s rotation and your priorities.</p>
          )}
          {s.note && (
            <p className="callout callout--warn plan-list__note" style={{ marginTop: 10 }}>
              <Icon name="alert" size={16} />
              <span>{s.note}</span>
            </p>
          )}
        </section>
        <section>
          <h3 className="cell-detail__h">Soil health</h3>
          <Meter value={s.health} delta={s.health - prevHealth} />
          <p className="muted small" style={{ marginTop: 4 }}>
            {s.health - prevHealth >= 0 ? 'Builds' : 'Runs down'} soil health by {Math.abs(s.health - prevHealth)} points this season.
          </p>
        </section>
        {ranking && (
          <section>
            <h3 className="cell-detail__h">How the options scored</h3>
            <ul className="ranking">
              {ranking.map((r, k) => (
                <li key={r.crop.id} className={r.crop.id === s.crop.id ? 'is-chosen' : ''}>
                  <span className="ranking__name">
                    <span className="crop-dot" style={{ background: r.crop.color }} />
                    {r.crop.name}
                    {r.crop.id === s.crop.id && <Badge tone="ok">Chosen</Badge>}
                    {k === 0 && r.crop.id !== s.crop.id && <Badge tone="bad">Blackleg risk</Badge>}
                  </span>
                  <span className="ranking__bar">
                    <span style={{ width: `${Math.max(6, ((r.score - bottom) / (top - bottom || 1)) * 100)}%`, background: r.crop.color }} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted small">Relative scores from your priorities, the paddock’s history, soil and climate.</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}

export default function Planner() {
  const farm = useFarm();
  const { state, paddocks, plans, years, labels, farmHealth, baseHealth, cropMix, breakShare, farm: farmList, space, farmPoint, areas } = farm;
  const { dispatch } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [season, setSeason] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [cell, setCell] = useState(null);
  const [editCrops, setEditCrops] = useState(false);
  const { weather, error: weatherError } = useWeather(farmPoint);
  const site = summariseSiteStatus(useAllSiteStatus(), paddocks);

  // Reaching the plan finishes setup.
  useEffect(() => {
    if (!paddocks.length || state.setupDone) return;
    dispatch({ type: 'completeStep', step: 'plan' });
    toast({ tone: 'ok', icon: 'sparkles', title: 'Your plan is ready', description: 'Setup is complete. Everything is now in the sidebar.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "?export=1" from Ctrl K
  useEffect(() => {
    if (params.get('export') && paddocks.length) {
      exportCsv(farm);
      setParams({}, { replace: true });
      toast({ tone: 'ok', icon: 'download', title: 'Plan exported', description: 'The rotation was saved as a CSV file.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ← → move between seasons
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [role="slider"], .leaflet-container') || cell || editCrops) return;
      if (e.key === 'ArrowRight') setSeason((s) => Math.min(years.length - 1, s + 1));
      if (e.key === 'ArrowLeft') setSeason((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [years.length, cell, editCrops]);

  const canola = space.result?.canola;
  const overlay = canola && { url: canola.overlay, bounds: [[space.result.bbox[1], space.result.bbox[0]], [space.result.bbox[3], space.result.bbox[2]]] };
  const styleFor = useCallback((p) => ({ fillColor: plans[p.id].seasons[season].crop.color, fillOpacity: 0.72, color: '#ece4d4' }), [plans, season]);
  const labelFor = useCallback((p) => `${p.name} · ${plans[p.id].seasons[season].crop.name}`, [plans, season]);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);

  if (!paddocks.length) return <Navigate to="/paddocks" replace />;
  const endHealth = farmHealth.at(-1);
  const diversity = cropMix.reduce((s, m) => s + m.length, 0) / cropMix.length;
  const steered = paddocks.filter((p) => plans[p.id].seasons[0].note?.startsWith('Canola would suit')).length;
  const mix = cropMix[season];

  return (
    <Page
      wide
      title="Rotation planner"
      description="Ten seasons for every paddock. Click a season to see it on the map, or any cell to see why that crop was chosen."
      step="plan"
      tip="planner"
      meta={
        <>
          <button type="button" className="crop-set-btn" onClick={() => setEditCrops(true)} title="Choose which crops (and livestock) the plan may use">
            <Icon name="sprout" size={14} />
            {describeCropSet(farmList)}
            <Icon name="edit" size={12} />
          </button>
          {site.loading > 0 ? (
            <Badge tone="info">
              <Icon name="spinner" size={12} className="spin" /> Refining with soil, slope &amp; climate · {site.ok}/{site.total}
            </Badge>
          ) : (
            site.total > 0 && <Badge tone="ok" icon="check">Soil, slope &amp; climate included</Badge>
          )}
          {space.running ? (
            <Badge tone="info">
              <Icon name="spinner" size={12} className="spin" /> Reading satellite history
            </Badge>
          ) : (
            space.result && <Badge tone="ok" icon="satellite">History &amp; blackleg from space</Badge>
          )}
        </>
      }
      actions={
        <>
          <Button tone="ghost" icon="printer" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            tone="ghost"
            icon="download"
            onClick={() => {
              exportCsv(farm);
              toast({ tone: 'ok', icon: 'download', title: 'Plan exported', description: 'The rotation was saved as a CSV file.' });
            }}
          >
            Export CSV
          </Button>
        </>
      }
    >
      <div className="grid-4">
        <Kpi label="Soil health after 10 seasons" icon="leaf" value={endHealth} unit="/ 100" delta={endHealth - baseHealth} deltaLabel={`from ${baseHealth}`} />
        <Kpi label="Break crops in the plan" icon="shield" value={Math.round(breakShare * 100)} unit="%">
          <p className="kpi__foot">Legumes, canola and pasture between cereals</p>
        </Kpi>
        <Kpi label="Crops per season" icon="sprout" value={diversity} decimals={1} unit="on average">
          <p className="kpi__foot">{(() => {
            const n = cropMix.filter((m) => m.length === 1).length;
            return n ? `${n} season${n === 1 ? '' : 's'} with a single crop` : 'Every season grows more than one crop';
          })()}</p>
        </Kpi>
        <Kpi label="Blackleg steering" icon="alert" value={steered} unit={steered === 1 ? 'paddock' : 'paddocks'} tone={steered ? 'alert' : undefined}>
          <p className="kpi__foot">{space.result ? 'Moved away from canola next season' : 'Waiting for the satellite canola map'}</p>
        </Kpi>
      </div>

      <Card flush title="Rotation" subtitle="Rows are paddocks, columns are seasons (harvest year). Use ← → to change season." icon="planner" className="rotation-card">
        <div className="table-wrap rotation-wrap">
          <table className="rotation" onMouseLeave={() => setHovered(null)}>
            <thead>
              <tr>
                <th scope="col" className="rotation__corner">
                  Paddock
                </th>
                {years.map((y, i) => (
                  <th key={y} scope="col" className={i === season ? 'is-selected' : ''}>
                    <button type="button" className="rotation__season" aria-pressed={i === season} onClick={() => setSeason(i)} title={`Sown ${labels[i]}`}>
                      <span className="num">{y}</span>
                      <small>{i === 0 ? 'Next' : `+${i}`}</small>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paddocks.map((p) => (
                <tr key={p.id} className={hovered?.paddock === p.id ? 'is-hover' : ''}>
                  <th scope="row">
                    <Link to={`/paddocks/${p.id}`} className="pname">
                      <span className="pname__avatar">
                        <SheepAvatar n={p.sheep} size={24} />
                      </span>
                      <span>
                        {p.name}
                        <span className="pname__sub">{formatHa(areas[p.id])} ha</span>
                      </span>
                    </Link>
                  </th>
                  {plans[p.id].seasons.map((s, i) => (
                    <td key={i} className={`${i === season ? 'is-selected' : ''}${hovered?.season === i ? ' is-hover' : ''}`}>
                      <button
                        type="button"
                        key={s.crop.id}
                        className={`rotation-cell${s.note ? ' has-note' : ''}`}
                        style={{ '--crop': s.crop.color }}
                        data-crop={s.crop.name}
                        data-paddock={p.name}
                        title={`${p.name} · ${years[i]}: ${s.crop.name}${s.why.length ? ` (${s.why.join(', ')})` : ''}`}
                        onMouseEnter={() => setHovered({ paddock: p.id, season: i })}
                        onFocus={() => setHovered({ paddock: p.id, season: i })}
                        onClick={() => (setSeason(i), setCell({ paddockId: p.id, season: i }))}
                      >
                        <span className="rotation-cell__name">{short(s.crop.name)}</span>
                        {s.note && <Icon name="alert" size={12} className="rotation-cell__flag" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Farm soil health</th>
                {farmHealth.map((h, i) => (
                  <td key={i} className={i === season ? 'is-selected' : ''}>
                    <span className="rotation__health num">
                      {h}
                      <i style={{ height: `${h * 0.22}px` }} />
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="split">
        <Card flush title={`Farm map · ${years[season]}`} subtitle={season === 0 && canola ? `Yellow: canola seen flowering in ${canola.year} (blackleg source)` : 'Paddocks coloured by their crop this season'} icon="map" className="planner-map" actions={
          <div className="season-stepper">
            <IconButton icon="chevron-left" label="Previous season" size="sm" disabled={season === 0} onClick={() => setSeason((s) => s - 1)} />
            <span className="num">{years[season]}</span>
            <IconButton icon="chevron-right" label="Next season" size="sm" disabled={season === years.length - 1} onClick={() => setSeason((s) => s + 1)} />
          </div>
        }>
          <div className="planner-map__frame">
            <div className="map-frame">
              <PaddockMap paddocks={paddocks} styleFor={styleFor} labelFor={labelFor} tagFor={tagFor} highlightId={hovered?.paddock} onSelect={(id) => setCell({ paddockId: id, season })} fitKey={paddocks.length} initialView={state.mapView} overlay={season === 0 ? overlay : null} />
            </div>
          </div>
          <div className="legend-row planner-map__legend">
            {mix.map((m) => (
              <span key={m.crop.id}>
                <i className="crop-dot" style={{ background: m.crop.color }} />
                {m.crop.name} · {formatHa(m.ha)} ha
              </span>
            ))}
            {season === 0 && canola && (
              <span>
                <i className="canola-swatch" /> Canola {canola.year}
              </span>
            )}
          </div>
        </Card>

        <Card title={`Crops to grow · ${years[season]}`} subtitle={`Sown ${labels[season]}`} icon="sprout" className="plan-card">
          <ul className="plan-list">
            {paddocks.map((p) => {
              const s = plans[p.id].seasons[season];
              const prev = season ? plans[p.id].seasons[season - 1].health : plans[p.id].base;
              return (
                <li key={p.id} className={hovered?.paddock === p.id ? 'is-active' : ''} onMouseEnter={() => setHovered({ paddock: p.id, season })} onMouseLeave={() => setHovered(null)}>
                  <button type="button" className="plan-list__row" onClick={() => setCell({ paddockId: p.id, season })}>
                    <SheepAvatar n={p.sheep} size={30} />
                    <span className="plan-list__body">
                      <span className="plan-list__title">
                        <strong>{p.name}</strong>
                        <CropChip crop={s.crop} size="sm" />
                      </span>
                      <span className="plan-list__why">{s.why.length ? s.why.join(' · ') : FAMILY_LABEL[s.crop.family]}</span>
                      {s.note && <span className="plan-list__note">{s.note}</span>}
                    </span>
                    <span className="plan-list__health num" title="Soil health after this season">
                      {s.health}
                      <em className={s.health - prev >= 0 ? 'is-up' : 'is-down'}>{s.health - prev >= 0 ? `+${s.health - prev}` : s.health - prev}</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <SowingCard cropIds={paddocks.map((p) => plans[p.id].seasons[season].crop.id)} weather={weather} error={weatherError} lat={farmPoint?.[0] ?? -35} seasonLabel={labels[season]} />

      {cell && <CellDetail farm={farm} cell={cell} onClose={() => setCell(null)} />}
      {editCrops && (
        <Modal
          title="Your crops"
          description="The plan only uses crops you tick. It updates as you change them."
          wide
          onClose={() => setEditCrops(false)}
          footer={
            <Button icon="done" onClick={() => setEditCrops(false)}>
              Done
            </Button>
          }
        >
          <CropSetPicker farm={farmList} onChange={(value) => dispatch({ type: 'setFarm', value })} />
        </Modal>
      )}
    </Page>
  );
}
