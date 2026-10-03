import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import Modal from '../components/Modal.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { useLoadingGate } from '../state/useLoadingGate.js';
import { SoilFacts } from '../components/SiteCards.jsx';
import { Button, Card, TextArea } from '../components/ui.jsx';
import { newPaddockId, renumberPaddocks, useStore } from '../state/store.jsx';
import { interiorPoint, splitAcrossLongAxis, areaHa, formatHa } from '../logic/geometry.js';
import { averageSoil, fetchSoil, soilsDiffer } from '../services/soil.js';
import '../styles/screens.css';

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

export default function ReviewPaddocks() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { paddocks } = state;
  const { results, retry } = useSoilSplitAnalysis(paddocks, dispatch);
  const [selected, setSelected] = useState(null);
  const [askWhy, setAskWhy] = useState(false);
  const [why, setWhy] = useState(state.keepReason);

  const done = paddocks.filter((p) => ['done', 'error'].includes(results[p.id]?.status)).length;
  const finished = paddocks.length > 0 && done === paddocks.length;
  const splitCount = paddocks.filter((p) => results[p.id]?.differ).length;
  const failed = paddocks.filter((p) => results[p.id]?.status === 'error').length;
  const showLoading = useLoadingGate(paddocks.length > 0 && !finished);

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
    (s) => (s.soil?.texture ? { fillColor: TEXTURE_COLORS[s.soil.texture] || '#989b66', fillOpacity: 0.6, color: '#ece4d4' } : { fillColor: '#ece4d4', fillOpacity: 0.2, color: '#ece4d4' }),
    [],
  );
  const labelFor = useCallback((s) => `${s.name} · ${s.soil?.texture || 'no soil data'}`, []);
  const tagFor = useCallback((s) => s.name.replace('Paddock ', ''), []);

  if (!paddocks.length) return <Navigate to="/paddocks" replace />;

  function goToFirst(list) {
    navigate(`/paddocks/${list[0].id}/history`);
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
    dispatch({ type: 'setPaddocks', paddocks: list });
    goToFirst(list);
  }

  function keep() {
    dispatch({ type: 'setKeepReason', value: why.trim() });
    setAskWhy(false);
    goToFirst(paddocks);
  }

  const textures = [...new Set(suggested.map((s) => s.soil?.texture).filter(Boolean))];
  const samples = paddocks.flatMap((p) => (results[p.id]?.halves || []).map((h) => ({ at: interiorPoint(h), label: `Soil sampled here (${p.name})` })));

  return (
    <Screen scene="field" title="Soil Check" step={2} back="/paddocks" chat="review">
      <div className="cols cols--review">
        <div className="cols__left">
          <Card className="map-card">
            <div className="map-frame">
              <PaddockMap paddocks={suggested} markers={samples} styleFor={styleFor} labelFor={labelFor} tagFor={tagFor} highlightId={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} fitKey={paddocks.length} initialView={state.mapView} />
              {textures.length > 0 && (
                <ul className="legend" aria-label="Soil texture">
                  {textures.map((t) => (
                    <li key={t}>
                      <span className="crop-dot" style={{ background: TEXTURE_COLORS[t] }} />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              {finished && failed > 0 && <p className="map-chip map-note">Soil colours unavailable for {failed === paddocks.length ? 'these paddocks' : `${failed} paddock${failed > 1 ? 's' : ''}`}</p>}
            </div>
          </Card>
        </div>

        <div className="cols__right review__right">
          <Card title={current ? `Soil · ${current.name}` : 'Soil'} className="data-card">
            {current ? (
              <>
                <p className="muted small">{formatHa(areaHa(current.coords))} ha{current.id.includes(':') ? ' · suggested new paddock' : ''}</p>
                {current.soil ? <SoilFacts soil={current.soil} /> : <p className="status">Soil data unavailable here.</p>}
              </>
            ) : !finished ? (
              <p className="status">Checking the soil at both ends of each paddock… ({done}/{paddocks.length})</p>
            ) : (
              <>
                {splitCount > 0 && (
                  <p>
                    {splitCount} of {paddocks.length} paddock{paddocks.length > 1 ? 's have' : ' has'} different soil at each end, so I’ve split {splitCount > 1 ? 'them' : 'it'} into new paddocks. Click one to see its soil.
                  </p>
                )}
                {!splitCount && !failed && <p>Good news — the soil is consistent inside each paddock, so there’s nothing to change. Click a paddock to see its soil.</p>}
                {failed > 0 && (
                  <p className="status status--error">
                    I couldn’t reach the soil service for {failed === paddocks.length ? 'your paddocks' : `${failed} paddock${failed > 1 ? 's' : ''}`}, so I can’t check {failed > 1 ? 'them' : 'it'} for soil changes right now.{' '}
                    <button type="button" className="link-btn" onClick={retry}>
                      Try again
                    </button>
                  </p>
                )}
              </>
            )}
            <p className="source">ISRIC SoilGrids 2.0 · 0–30 cm</p>
          </Card>

          <div className="review__actions">
            {!finished ? (
              <>
                <Button disabled>Checking soil…</Button>
                <Button tone="danger" onClick={() => goToFirst(paddocks)}>
                  Skip
                </Button>
              </>
            ) : splitCount ? (
              <>
                <Button onClick={accept} icon="done">
                  Accept new paddocks
                </Button>
                <Button tone="danger" onClick={() => setAskWhy(true)}>
                  Keep old paddocks
                </Button>
              </>
            ) : (
              <Button onClick={() => goToFirst(paddocks)} iconEnd="arrow-forward">
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      {showLoading && (
        <LoadingScreen
          title="Checking the soil"
          detail={`Manami is sampling both ends of every paddock (${done} of ${paddocks.length} done). This can take a little while.`}
          progress={paddocks.length ? done / paddocks.length : 0}
          action={
            <Button tone="danger" size="compact" onClick={() => goToFirst(paddocks)}>
              Skip for now
            </Button>
          }
        />
      )}

      {askWhy && (
        <Modal
          title="Why?"
          onClose={() => setAskWhy(false)}
          footer={
            <Button size="compact" onClick={keep} icon="done">
              OK
            </Button>
          }
        >
          <TextArea label="Why do you want to keep your old paddocks?" value={why} onChange={(e) => setWhy(e.target.value)} />
        </Modal>
      )}
    </Screen>
  );
}
