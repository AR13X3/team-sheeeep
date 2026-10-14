import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import PaddockTable from '../components/PaddockTable.jsx';
import RotationReportCard from '../components/RotationReportCard.jsx';
import Art from '../components/Art.jsx';
import Icon from '../components/Icon.jsx';
import { Donut, LineChart, Spark } from '../components/charts.jsx';
import { Badge, Button, Card, EmptyState, Kpi, Segmented } from '../components/ui.jsx';
import { useShell } from '../components/shell/ShellContext.js';
import { formatHa } from '../logic/geometry.js';
import { rotationReport } from '../logic/performance.js';
import { sowingRisk, fmtMMDD, CROP_PHENOLOGY } from '../logic/sowing.js';
import { timeAgo } from '../logic/seasons.js';
import { buildDemoPaddocks, DEMO_FARM } from '../data/demoFarm.js';
import { useStore } from '../state/store.jsx';
import { useFarm } from '../state/useFarm.js';
import { useWeather } from '../state/useWeather.js';
import { summariseSiteStatus, useAllSiteStatus } from '../state/useSiteData.js';
import '../styles/dashboard.css';
import '../styles/pages.css';

const greeting = (h) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
const ACTIVITY_ICON = { paddock: 'paddocks', delete: 'delete', satellite: 'satellite', crops: 'sprout', edit: 'edit' };

function AlertList({ alerts }) {
  if (!alerts.length)
    return (
      <EmptyState icon="circle-check" title="All clear">
        No blackleg risks, missing history or data problems right now.
      </EmptyState>
    );
  return (
    <ul className="alerts">
      {alerts.slice(0, 6).map((a) => (
        <li key={a.id}>
          <Link to={a.to} className={`alert alert--${a.tone}`}>
            <span className="alert__icon">
              <Icon name={a.icon} size={15} />
            </span>
            <span>
              <span className="alert__title">{a.title}</span>
              <span className="alert__text">{a.text}</span>
            </span>
            <Icon name="chevron-right" size={16} className="alert__go" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DataSources({ farm, weather, weatherError }) {
  const all = useAllSiteStatus();
  const { retrySiteData } = useShell();
  const s = summariseSiteStatus(all, farm.paddocks);
  const by = (key) => {
    let loading = 0, error = 0, ok = 0;
    for (const p of farm.paddocks) {
      const v = all[p.id]?.[key];
      if (v === 'loading') loading++;
      else if (v === 'error') error++;
      else if (v === 'ok' || p.site?.[key] !== undefined) ok++;
    }
    return error ? 'error' : loading ? 'loading' : ok ? 'ok' : 'idle';
  };
  const space = farm.space;
  const rows = [
    { name: 'NASA HLS', what: 'Crop history & canola from space', icon: 'satellite', state: space.result ? 'ok' : space.running ? 'loading' : space.error ? 'error' : 'idle' },
    { name: 'NASA POWER', what: '30 years of daily weather & rain', icon: 'rain', state: weather ? 'ok' : weatherError ? 'error' : 'loading' },
    { name: 'ISRIC SoilGrids', what: 'Texture, pH & organic carbon', icon: 'mountain', state: by('soil') },
    { name: 'Copernicus DEM', what: 'Slope, aspect & elevation', icon: 'gauge', state: by('terrain') },
  ];
  const LABEL = { ok: 'Connected', loading: 'Loading…', error: 'Unavailable', idle: 'Waiting' };
  const TONE = { ok: 'ok', loading: 'info', error: 'bad', idle: 'neutral' };
  return (
    <Card title="Data sources" subtitle="Live public datasets behind every number" icon="database" actions={s.error > 0 && <Button tone="ghost" size="sm" icon="refresh" onClick={retrySiteData}>Retry</Button>}>
      <ul className="sources">
        {rows.map((r) => (
          <li key={r.name}>
            <span className="sources__icon">
              <Icon name={r.icon} size={16} />
            </span>
            <span className="sources__text">
              <strong>{r.name}</strong>
              <span>{r.what}</span>
            </span>
            <Badge tone={TONE[r.state]} icon={r.state === 'loading' ? undefined : r.state === 'ok' ? 'check' : r.state === 'error' ? 'alert' : undefined}>
              {r.state === 'loading' && <Icon name="spinner" size={11} className="spin" />}
              {LABEL[r.state]}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Dashboard() {
  const farm = useFarm();
  const { state, paddocks, plans, farmHealth, baseHealth, years, totalHa, cropMix, alerts, space, farmPoint } = farm;
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [season, setSeason] = useState(0);
  const [activeCrop, setActiveCrop] = useState(null);
  const { weather, error: weatherError } = useWeather(farmPoint);
  const report = useMemo(() => rotationReport(space.result, weather, paddocks), [space.result, weather, paddocks]);

  const band = useMemo(
    () => years.map((_, i) => {
      const hs = paddocks.map((p) => plans[p.id].seasons[i].health);
      return [Math.min(...hs), Math.max(...hs)];
    }),
    [years, paddocks, plans],
  );

  const mix = cropMix[season] || [];
  const nextTop = cropMix[0]?.[0];
  const sowing = useMemo(() => {
    if (!weather || !nextTop || !CROP_PHENOLOGY[nextTop.crop.id]) return null;
    return sowingRisk(weather, nextTop.crop.id, farmPoint[0]);
  }, [weather, nextTop, farmPoint]);

  const styleFor = useCallback(
    (p) => {
      const crop = plans[p.id]?.seasons[season]?.crop;
      const dim = activeCrop && crop?.id !== activeCrop;
      return { fillColor: crop?.color, fillOpacity: dim ? 0.2 : 0.72, color: '#ece4d4' };
    },
    [plans, season, activeCrop],
  );
  const labelFor = useCallback((p) => `${p.name} · ${plans[p.id]?.seasons[season]?.crop.name}`, [plans, season]);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);

  const now = new Date();
  const name = state.user?.name || 'Guest';

  if (!paddocks.length) {
    return (
      <Page title={`${greeting(now.getHours())}, ${name}`} description="Your farm workspace. Start by mapping your paddocks." tip="dashboard">
        <Card>
          <EmptyState
            art={<Art name="manami-large" className="empty__art" label="Manami the sheep" />}
            title="Let’s map your farm"
            action={
              <>
                <Button icon="plus" onClick={() => navigate('/paddocks?draw=1')}>
                  Draw paddocks
                </Button>
                <Button
                  tone="ghost"
                  icon="sparkles"
                  onClick={() => {
                    dispatch({ type: 'setPaddocks', paddocks: buildDemoPaddocks(), note: 'Demo farm loaded (4 paddocks, NSW Riverina)' });
                    dispatch({ type: 'setMapView', value: DEMO_FARM.view });
                  }}
                >
                  Load the demo farm
                </Button>
              </>
            }
          >
            Outline your paddocks on the satellite map and Manami will read their history from space, check the soil and build a ten-season rotation.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const urgent = alerts.filter((a) => a.tone === 'bad').length;
  const endHealth = farmHealth.at(-1);
  const seasonOptions = years.slice(0, 5).map((y, i) => ({ value: i, label: i === 0 ? `${y} · next` : String(y) }));

  return (
    <Page wide className="dash">
      <section className="hero">
        <div className="hero__text">
          <p className="hero__date">{now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="hero__title">
            {greeting(now.getHours())}, {name}
          </h1>
          <p className="hero__lead">
            {paddocks.length} paddocks · {formatHa(totalHa)} ha
            {farmPoint && (
              <>
                {' '}
                · <Icon name="pin" size={13} /> {Math.abs(farmPoint[0]).toFixed(2)}°{farmPoint[0] < 0 ? 'S' : 'N'}, {Math.abs(farmPoint[1]).toFixed(2)}°{farmPoint[1] < 0 ? 'W' : 'E'}
              </>
            )}
          </p>
          <div className="hero__chips">
            {nextTop && (
              <span className="hero__chip">
                <Icon name="sprout" size={14} /> Next season ({years[0]}): <strong>{cropMix[0].map((m) => m.crop.name).join(', ')}</strong>
              </span>
            )}
            {sowing && (
              <span className="hero__chip">
                <Icon name="calendar" size={14} /> Sow {nextTop.crop.name.toLowerCase()} <strong>{fmtMMDD(sowing.window[0])}{sowing.window[1] !== sowing.window[0] && ` – ${fmtMMDD(sowing.window[1])}`}</strong>
              </span>
            )}
            {urgent > 0 && (
              <span className="hero__chip hero__chip--bad">
                <Icon name="alert" size={14} /> {urgent} blackleg risk{urgent > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="hero__actions">
          <Button size="lg" iconEnd="arrow-forward" onClick={() => navigate('/planner')}>
            Open planner
          </Button>
          <Button size="lg" tone="ghost" icon="plus" onClick={() => navigate('/paddocks?draw=1')}>
            Add paddock
          </Button>
        </div>
        <div className="hero__art" aria-hidden="true">
          <span className="hero__hill hero__hill--back" />
          <span className="hero__hill" />
          <Art name="manami-large" className="hero__manami" />
        </div>
      </section>

      <div className="grid-4">
        <Kpi label="Farm area" icon="paddocks" value={totalHa} decimals={1} unit="ha" onClick={() => navigate('/register')}>
          <p className="kpi__foot">{paddocks.length} paddocks mapped</p>
        </Kpi>
        <Kpi label="Soil health after the plan" icon="leaf" value={endHealth} unit="/ 100" delta={endHealth - baseHealth} deltaLabel={`from ${baseHealth} today`} chart={<Spark values={[baseHealth, ...farmHealth]} />} onClick={() => navigate('/planner')} />
        <Kpi label={`Crops in ${years[0]}`} icon="sprout" value={cropMix[0]?.length ?? 0} unit={cropMix[0]?.length === 1 ? 'crop' : 'crops'} onClick={() => navigate('/planner')}>
          <span className="mix-bar" aria-hidden="true">
            {cropMix[0]?.map((m) => (
              <i key={m.crop.id} style={{ flex: m.ha, background: m.crop.color }} title={`${m.crop.name} ${formatHa(m.ha)} ha`} />
            ))}
          </span>
        </Kpi>
        <Kpi label="Needs attention" icon="alert" value={alerts.length} unit={alerts.length === 1 ? 'item' : 'items'} tone={urgent ? 'alert' : undefined}>
          <p className="kpi__foot">{urgent ? `${urgent} urgent` : alerts.length ? 'Nothing urgent' : 'All clear'}</p>
        </Kpi>
      </div>

      <div className="split">
        <Card
          flush
          title="Farm map"
          subtitle={`Paddocks coloured by the crop planned for ${years[season]}`}
          icon="map"
          actions={<Segmented size="sm" label="Season" options={seasonOptions} value={season} onChange={setSeason} />}
          className="dash-map"
        >
          <div className="dash-map__frame">
            <div className="map-frame map-frame--flat">
              <PaddockMap paddocks={paddocks} styleFor={styleFor} labelFor={labelFor} tagFor={tagFor} onSelect={(id) => navigate(`/paddocks/${id}`)} fitKey={paddocks.length} initialView={state.mapView} />
            </div>
          </div>
          <div className="dash-map__legend legend-row">
            {mix.map((m) => (
              <span key={m.crop.id}>
                <i className="crop-dot" style={{ background: m.crop.color }} />
                {m.crop.name} · {formatHa(m.ha)} ha
              </span>
            ))}
          </div>
        </Card>
        <Card title="Needs attention" icon="flag" actions={alerts.length > 0 && <Badge tone={urgent ? 'bad' : 'warn'}>{alerts.length}</Badge>}>
          <AlertList alerts={alerts} />
        </Card>
      </div>

      <div className="split">
        <Card title="Soil health outlook" subtitle={`Farm average across ${years.length} seasons of the plan (0–100)`} icon="leaf" actions={<Badge tone={endHealth >= baseHealth ? 'ok' : 'bad'} icon={endHealth >= baseHealth ? 'trend-up' : 'trend-down'}>{endHealth - baseHealth >= 0 ? '+' : ''}{endHealth - baseHealth} pts</Badge>}>
          <LineChart labels={years} values={farmHealth} band={band} baseline={baseHealth} baselineLabel={`Today ${baseHealth}`} selected={season} onSelect={(i) => i < 5 && setSeason(i)} />
        </Card>
        <Card title={`Crop mix · ${years[season]}`} subtitle="Hectares by crop" icon="chart">
          <div className="mix">
            <Donut
              items={mix.map((m) => ({ id: m.crop.id, label: m.crop.name, value: m.ha, color: m.crop.color }))}
              total={formatHa(totalHa)}
              totalLabel="ha planned"
              format={(v) => `${formatHa(v)} ha`}
              active={activeCrop}
              onActive={setActiveCrop}
            />
            <ul className="mix__legend">
              {mix.map((m) => (
                <li key={m.crop.id} className={activeCrop && activeCrop !== m.crop.id ? 'is-dim' : ''} onPointerEnter={() => setActiveCrop(m.crop.id)} onPointerLeave={() => setActiveCrop(null)}>
                  <span className="mix__name">
                    <i className="crop-dot" style={{ background: m.crop.color }} />
                    {m.crop.name}
                  </span>
                  <span className="num">{formatHa(m.ha)} ha</span>
                  <span className="num muted">{Math.round((m.ha / totalHa) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card flush title="Paddocks" subtitle="Click a row for the paddock’s details" icon="paddocks" actions={<Button tone="ghost" size="sm" iconEnd="arrow-forward" onClick={() => navigate('/register')}>All paddocks</Button>}>
        <div style={{ height: 12 }} />
        <PaddockTable farm={farm} compact search={false} />
      </Card>

      <div className="split">
        <RotationReportCard report={report} running={space.running} />
        <Card title="Recent activity" icon="history">
          {state.activity?.length ? (
            <ul className="activity">
              {state.activity.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <span className={`activity__icon activity__icon--${a.kind}`}>
                    <Icon name={ACTIVITY_ICON[a.kind] || 'edit'} size={14} />
                  </span>
                  <span className="activity__text">{a.paddockId ? <Link to={`/paddocks/${a.paddockId}`}>{a.text}</Link> : a.text}</span>
                  <time className="activity__time" dateTime={new Date(a.at).toISOString()}>
                    {timeAgo(a.at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="history" title="No changes yet">
              Edits to paddocks, crops and the plan show up here.
            </EmptyState>
          )}
        </Card>
      </div>

      <DataSources farm={farm} weather={weather} weatherError={weatherError} />
    </Page>
  );
}
