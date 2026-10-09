import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { SheepAvatar } from '../components/Art.jsx';
import { SoilFacts } from '../components/SiteCards.jsx';
import { Badge, Button, Card, Progress, Source, TextArea } from '../components/ui.jsx';
import { newPaddockId, renumberPaddocks, useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';
import { interiorPoint, splitAcrossLongAxis, areaHa, formatHa } from '../logic/geometry.js';
import { averageSoil, fetchSoil, soilsDiffer } from '../services/soil.js';
import '../styles/paddock.css';

export const TEXTURE_COLORS = {
  Sand: '#efe3c4',
  'Loamy sand': '#e2cf98',
  'Sandy loam': '#cfb173',
  Loam: '#b08a5c',
  'Silt loam': '#c4a37a',
  Silt: '#d8c29c',
  'Sandy clay loam': '#9b7255',
  'Clay loam': '#86634d',
  'Silty clay loam': '#8f7563',
  'Sandy clay': '#76594a',
  'Silty clay': '#6b5649',
  Clay: '#58463c',
};

/** Samples the soil at the centre of each half of every paddock (2 SoilGrids calls each). */
function useSoilSplitAnalysis(paddocks, dispatch) {
  const [results, setResults] = useState({});
  const [attempt, setAttempt] = useState(0);
  const key = paddocks.map((p) => p.id + JSON.stringify(p.coords)).join('|');

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of paddocks) {
        if (attempt > 0 && results[p.id]?.status === 'done') continue; // retry only the failures
        const halves = splitAcrossLongAxis(p.coords);
        if (alive) setResults((r) => ({ ...r, [p.id]: { status: 'loading', halves } }));
        try {
          const soils = [];
          for (const h of halves) soils.push(await fetchSoil(interiorPoint(h)));
          const differ = halves.length === 2 && soilsDiffer(soils[0], soils[1]);
          if (p.site?.soil === undefined) {
            dispatch({ type: 'updatePaddock', id: p.id, patch: (q) => ({ site: { ...q.site, soil: averageSoil(soils) } }) });
          }
          if (alive) setResults((r) => ({ ...r, [p.id]: { status: 'done', halves, soils, differ } }));
        } catch (err) {
          console.warn('[soil split] failed for', p.name, err);
          if (alive) setResults((r) => ({ ...r, [p.id]: { status: 'error', halves } }));
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { results, retry: () => setAttempt((a) => a + 1) };
}

const STATUS = {
  waiting: { icon: 'clock', label: 'Waiting', tone: 'neutral' },
  loading: { icon: 'spinner', label: 'Sampling both ends…', tone: 'info' },
  same: { icon: 'circle-check', label: 'Consistent soil', tone: 'ok' },
  split: { icon: 'paddocks', label: 'Soil differs: split suggested', tone: 'warn' },
  error: { icon: 'alert', label: 'Soil service unavailable', tone: 'bad' },
};

export default function ReviewPaddocks() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const { paddocks } = state;
  const { results, retry } = useSoilSplitAnalysis(paddocks, dispatch);
  const [selected, setSelected] = useState(null);
  const [askWhy, setAskWhy] = useState(false);
  const [why, setWhy] = useState(state.keepReason);

  const done = paddocks.filter((p) => ['done', 'error'].includes(results[p.id]?.status)).length;
  const finished = paddocks.length > 0 && done === paddocks.length;
  const splitCount = paddocks.filter((p) => results[p.id]?.differ).length;
  const failed = paddocks.filter((p) => results[p.id]?.status === 'error').length;

  // The "new paddocks": split where the soil differs, unchanged elsewhere.
  const suggested = useMemo(
    () =>
      paddocks.flatMap((p) => {
        const r = results[p.id];
        if (r?.differ) {
          return r.halves.map((coords, i) => ({ id: `${p.id}:${i}`, coords, soil: r.soils[i], name: `${p.name} ${i ? 'B' : 'A'}`, parent: p }));
        }
        return [{ id: p.id, coords: p.coords, soil: r?.soils ? averageSoil(r.soils) : p.site?.soil, name: p.name, parent: p }];
      }),
    [paddocks, results],
  );
  const current = suggested.find((s) => s.id === selected);

  const styleFor = useCallback(
    (s) => (s.soil?.texture ? { fillColor: TEXTURE_COLORS[s.soil.texture] || '#989b66', fillOpacity: 0.65, color: '#ece4d4' } : { fillColor: '#ece4d4', fillOpacity: 0.2, color: '#ece4d4' }),
    [],
  );
  const labelFor = useCallback((s) => `${s.name} · ${s.soil?.texture || 'no soil data'}`, []);
  const tagFor = useCallback((s) => s.name.replace('Paddock ', ''), []);

  if (!paddocks.length) return <Navigate to="/paddocks" replace />;

  function goToFirst(list) {
    dispatch({ type: 'completeStep', step: 'soil' });
    navigate(state.setupDone ? '/register' : `/paddocks/${list[0].id}/history`);
  }

  function accept() {
    const next = [];
    for (const p of paddocks) {
      const r = results[p.id];
      if (r?.differ) {
        r.halves.forEach((coords, i) => next.push({ ...p, id: newPaddockId(), coords, site: { soil: r.soils[i] } }));
      } else next.push(p);
    }
    const list = renumberPaddocks(next);
    dispatch({ type: 'setPaddocks', paddocks: list, note: `Soil check: split ${splitCount} paddock${splitCount > 1 ? 's' : ''} (${list.length} now)` });
    toast({ tone: 'ok', title: 'New paddocks accepted', description: `You now have ${list.length} paddocks, each on one soil.` });
    goToFirst(list);
  }

  function keep() {
    dispatch({ type: 'setKeepReason', value: why.trim() });
    setAskWhy(false);
    goToFirst(paddocks);
  }

  const textures = [...new Set(suggested.map((s) => s.soil?.texture).filter(Boolean))];
  const samples = paddocks.flatMap((p) => (results[p.id]?.halves || []).map((h) => ({ at: interiorPoint(h), label: `Soil sampled here (${p.name})` })));
  const statusOf = (p) => {
    const r = results[p.id];
    if (!r) return 'waiting';
    if (r.status === 'loading') return 'loading';
    if (r.status === 'error') return 'error';
    return r.differ ? 'split' : 'same';
  };

  const actions = !finished ? (
    <>
      <Button tone="ghost" onClick={() => goToFirst(paddocks)}>
        Skip for now
      </Button>
      <Button loading>Checking soil…</Button>
    </>
  ) : splitCount ? (
    <>
      <Button tone="danger" onClick={() => setAskWhy(true)}>
        Keep old paddocks
      </Button>
      <Button onClick={accept} icon="done">
        Accept new paddocks
      </Button>
    </>
  ) : (
    <Button onClick={() => goToFirst(paddocks)} iconEnd="arrow-forward">
      Continue
    </Button>
  );

  return (
    <Page title="Soil check" description="Manami samples the soil at both ends of every paddock and suggests a split where it changes." step="soil" tip="review" actions={actions}>
      <div className="split split--map">
        <Card flush className="map-card">
          <div className="map-frame map-card__frame">
            <PaddockMap paddocks={suggested} markers={samples} styleFor={styleFor} labelFor={labelFor} tagFor={tagFor} highlightId={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} fitKey={paddocks.length} initialView={state.mapView} />
            {textures.length > 0 && (
              <div className="map-legend">
                <span className="map-legend__title">Soil texture (0–30 cm)</span>
                <ul aria-label="Soil texture">
                  {textures.map((t) => (
                    <li key={t}>
                      <span className="crop-dot" style={{ background: TEXTURE_COLORS[t] }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <div className="stack">
          <Card
            title="Soil sampling"
            subtitle={finished ? (splitCount ? `${splitCount} of ${paddocks.length} paddocks have two soils` : 'Every paddock is on one soil') : `Checked ${done} of ${paddocks.length} paddocks`}
            icon="mountain"
            actions={failed > 0 && finished && <Button tone="ghost" size="sm" icon="refresh" onClick={retry}>Retry</Button>}
          >
            <Progress value={(done / paddocks.length) * 100} tone={finished ? 'accent' : 'teal'} className={finished ? '' : 'progress--live'} label="Soil check progress" />
            <ul className="sample-list">
              {paddocks.map((p) => {
                const st = STATUS[statusOf(p)];
                const r = results[p.id];
                return (
                  <li key={p.id}>
                    <button type="button" className={`sample-list__row${selected && (selected === p.id || selected.startsWith(`${p.id}:`)) ? ' is-active' : ''}`} onClick={() => setSelected(r?.differ ? `${p.id}:0` : p.id)}>
                      <SheepAvatar n={p.sheep} size={26} />
                      <span className="sample-list__text">
                        <strong>{p.name}</strong>
                        <span>
                          {formatHa(areaHa(p.coords))} ha
                          {r?.soils && ` · ${r.differ ? r.soils.map((s) => s?.texture || '?').join(' / ') : averageSoil(r.soils)?.texture || 'no data'}`}
                        </span>
                      </span>
                      <Badge tone={st.tone}>
                        <Icon name={st.icon} size={12} className={st.icon === 'spinner' ? 'spin' : ''} />
                        {st.label}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
            {finished && !splitCount && !failed && (
              <p className="callout callout--ok">
                <Icon name="circle-check" size={16} />
                <span>Good news: the soil is consistent inside each paddock, so there’s nothing to change.</span>
              </p>
            )}
            {finished && splitCount > 0 && (
              <p className="callout callout--warn">
                <Icon name="paddocks" size={16} />
                <span>
                  Splitting gives {splitCount > 1 ? 'these paddocks' : 'this paddock'} two halves that can be managed for their own soil. Click one on the map to compare.
                </span>
              </p>
            )}
            {finished && failed > 0 && (
              <p className="callout callout--bad">
                <Icon name="alert" size={16} />
                <span>I couldn’t reach the soil service for {failed === paddocks.length ? 'your paddocks' : `${failed} paddock${failed > 1 ? 's' : ''}`}. Retry, or continue and check later.</span>
              </p>
            )}
          </Card>

          <Card title={current ? current.name : 'Soil detail'} subtitle={current ? `${formatHa(areaHa(current.coords))} ha${current.id.includes(':') ? ' · suggested new paddock' : ''}` : 'Click a paddock on the map'} icon="info">
            {current ? current.soil ? <SoilFacts soil={current.soil} /> : <p className="muted">Soil data unavailable here.</p> : <p className="muted">Texture, pH, clay and organic carbon for the paddock or half you select.</p>}
            <Source>ISRIC SoilGrids 2.0 · 0–30 cm average at the centre of each half</Source>
          </Card>
        </div>
      </div>

      {askWhy && (
        <Modal
          title="Keep your old paddocks?"
          description="A short note helps you (and Manami) remember why."
          onClose={() => setAskWhy(false)}
          footer={
            <>
              <Button tone="ghost" onClick={() => setAskWhy(false)}>
                Cancel
              </Button>
              <Button onClick={keep} icon="done">
                Keep old paddocks
              </Button>
            </>
          }
        >
          <TextArea label="Why do you want to keep your old paddocks?" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. same fence line, managed as one block" />
        </Modal>
      )}
    </Page>
  );
}
