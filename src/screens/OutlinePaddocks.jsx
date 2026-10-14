import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import Icon from '../components/Icon.jsx';
import { SheepAvatar, SHEEP_COLORS } from '../components/Art.jsx';
import { Badge, Button, EmptyState, IconButton, Kbd, Switch } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';
import { areaHa, formatHa, selfIntersects } from '../logic/geometry.js';
import { trimOverlaps } from '../logic/overlap.js';
import { searchPlace } from '../services/geocode.js';
import { buildDemoPaddocks, DEMO_FARM } from '../data/demoFarm.js';
import '../styles/editor.css';

/** Farm map: find the farm, draw and reshape paddocks (snapping to neighbours), then go on to the soil check. */
export default function OutlinePaddocks() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const map = useRef(null);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState({ busy: false, error: '' });
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState({ corners: 0, ha: 0 });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [hint, setHint] = useState(''); // warnings
  const [info, setInfo] = useState(''); // what we did for you
  const [editKey, setEditKey] = useState(0);
  const [snap, setSnap] = useState(() => {
    try {
      return localStorage.getItem('sheeep:snap') !== 'off';
    } catch {
      return true;
    }
  });
  const { paddocks } = state;
  const totalHa = paddocks.reduce((s, p) => s + areaHa(p.coords), 0);

  useEffect(() => {
    try {
      localStorage.setItem('sheeep:snap', snap ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, [snap]);

  // "?draw=1" (from Ctrl K or the dashboard) starts drawing straight away
  useEffect(() => {
    if (params.get('draw')) {
      startDrawing();
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // messages fade away on their own
  useEffect(() => {
    if (!hint && !info) return;
    const t = setTimeout(() => (setHint(''), setInfo('')), 7000);
    return () => clearTimeout(t);
  }, [hint, info]);

  /**
   * Checks an outline and trims any part that overlaps other paddocks (they can't share ground,
   * and overlaps would double-count area and soil). Returns the outline to keep, or null.
   */
  function settle(coords, exceptId) {
    if (selfIntersects(coords)) {
      setHint('That outline crosses itself — click the corners in order around the edge.');
      return null;
    }
    const others = paddocks.filter((p) => p.id !== exceptId);
    const t = trimOverlaps(coords, others);
    if (!t.coords) {
      setHint(`That shape is entirely inside ${t.overlapped.join(' and ')}.`);
      return null;
    }
    const ha = areaHa(t.coords);
    if (ha < 0.05) {
      setHint(`That shape is only ${(ha * 10000).toFixed(0)} m² — was it a mis-click? Zoom in and try again.`);
      return null;
    }
    setHint('');
    if (t.trimmedHa >= 0.01) {
      setInfo(`Trimmed ${formatHa(t.trimmedHa)} ha that overlapped ${t.overlapped.join(' and ')}, so they now share an edge.${t.pieces > 1 ? ' Kept the largest piece.' : ''}`);
    } else setInfo('');
    return t.coords;
  }
  const current = paddocks.find((p) => p.id === selected);

  const styleFor = useCallback((p) => ({ fillColor: SHEEP_COLORS[p.sheep], color: '#ece4d4' }), []);
  const labelFor = useCallback((p) => `${p.name} · ${formatHa(areaHa(p.coords))} ha`, []);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);

  async function onSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchState({ busy: true, error: '' });
    try {
      const hit = await searchPlace(query);
      if (!hit) setSearchState({ busy: false, error: 'No place found — try a nearby town' });
      else {
        map.current?.flyToBounds(hit.bounds);
        setSearchState({ busy: false, error: '' });
      }
    } catch {
      setSearchState({ busy: false, error: 'Search is unavailable right now' });
    }
  }

  function select(id, fly = false) {
    setSelected((s) => (s === id ? null : id));
    setEditing(false);
    const p = paddocks.find((q) => q.id === id);
    if (fly && p && selected !== id) map.current?.focus(p.coords);
  }

  function startDrawing() {
    setSelected(null);
    setEditing(false);
    setHint('');
    setInfo('');
    setDrawing(true);
  }

  function loadDemo() {
    dispatch({ type: 'setPaddocks', paddocks: buildDemoPaddocks(), note: 'Demo farm loaded (4 paddocks, NSW Riverina)' });
    dispatch({ type: 'setMapView', value: DEMO_FARM.view });
    setFitKey((k) => k + 1);
  }

  function remove(p) {
    const before = paddocks;
    dispatch({ type: 'removePaddock', id: p.id });
    setSelected(null);
    setEditing(false);
    toast({ tone: 'info', icon: 'delete', title: `${p.name} deleted`, description: `${formatHa(areaHa(p.coords))} ha removed from the farm.`, action: { label: 'Undo', onClick: () => dispatch({ type: 'setPaddocks', paddocks: before, note: `${p.name} restored` }) } });
  }

  function next() {
    if (!paddocks.length) {
      setHint('Outline at least one paddock first, or load the demo farm.');
      return;
    }
    dispatch({ type: 'completeStep', step: 'paddocks' });
    navigate('/paddocks/review');
  }

  return (
    <Page
      fill
      wide
      title="Farm map"
      description="Find your farm, then outline each paddock by clicking its corners."
      step="paddocks"
      tip="paddocks"
      meta={
        paddocks.length > 0 && (
          <>
            <Badge icon="paddocks">
              {paddocks.length} paddock{paddocks.length === 1 ? '' : 's'}
            </Badge>
            <Badge>{formatHa(totalHa)} ha</Badge>
          </>
        )
      }
      actions={
        <>
          {!paddocks.length && (
            <Button tone="ghost" icon="sparkles" onClick={loadDemo}>
              Load demo farm
            </Button>
          )}
          <Button iconEnd="arrow-forward" onClick={next} disabled={drawing}>
            {paddocks.length ? `Soil check (${paddocks.length})` : 'Soil check'}
          </Button>
        </>
      }
    >
      <div className={`editor${drawing ? ' is-drawing' : ''}`}>
        <aside className="editor__panel card" aria-label="Paddocks">
          <div className="editor__panel-head">
            <Button block icon="plus" onClick={startDrawing} disabled={drawing}>
              {drawing ? 'Drawing…' : 'Draw paddock'}
            </Button>
          </div>
          {paddocks.length ? (
            <ul className="editor__list paddock-chips" aria-label="Paddocks">
              {paddocks.map((p) => {
                const on = selected === p.id;
                return (
                  <li key={p.id} className={`paddock-chip${on ? ' is-selected' : ''}`}>
                    <button type="button" className="paddock-chip__name" aria-pressed={on} onClick={() => select(p.id, true)}>
                      <span className="paddock-chip__swatch" style={{ background: SHEEP_COLORS[p.sheep] }} />
                      <SheepAvatar n={p.sheep} size={26} />
                      <span className="paddock-chip__text">
                        <strong>{p.name}</strong>
                        <span>{formatHa(areaHa(p.coords))} ha</span>
                      </span>
                    </button>
                    {on && (
                      <div className="paddock-chip__actions">
                        <Button tone={editing ? 'primary' : 'ghost'} size="sm" icon={editing ? 'done' : 'edit'} onClick={() => setEditing((e) => !e)}>
                          {editing ? 'Done' : 'Edit shape'}
                        </Button>
                        <Link to={`/paddocks/${p.id}`} className="btn btn--ghost btn--sm">
                          <span className="btn__label">Details</span>
                        </Link>
                        <IconButton icon="delete" label={`Delete ${p.name}`} tone="danger" size="sm" className="icon-btn--danger" onClick={() => remove(p)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="map" title="No paddocks yet">
              Press “Draw paddock” and click each corner on the map, or load the demo farm.
            </EmptyState>
          )}
          <div className="editor__panel-foot">
            <Switch checked={snap} onChange={setSnap} label="Snap to neighbours" description="Corners lock onto nearby paddocks. Hold Alt to skip once." />
            <p className="editor__keys">
              <Kbd>Enter</Kbd> finish <Kbd>⌫</Kbd> undo <Kbd>Esc</Kbd> cancel
            </p>
          </div>
        </aside>

        <div className="editor__map map-frame">
          <PaddockMap
            ref={map}
            paddocks={paddocks}
            styleFor={styleFor}
            labelFor={labelFor}
            tagFor={tagFor}
            highlightId={selected}
            onSelect={(id) => select(id)}
            drawing={drawing}
            onDraftChange={setDraft}
            onDrawCancel={() => setDrawing(false)}
            onDrawComplete={(coords) => {
              const kept = settle(coords);
              if (kept) {
                dispatch({ type: 'addPaddock', coords: kept });
                toast({ tone: 'ok', title: 'Paddock added', description: `${formatHa(areaHa(kept))} ha outlined.` });
              }
              setDrawing(false);
            }}
            snap={snap}
            editableId={editing ? selected : null}
            editKey={editKey}
            onEditCoords={(id, coords) => {
              const kept = settle(coords, id);
              setEditKey((k) => k + 1); // redraw the handles on the shape we kept
              if (kept) dispatch({ type: 'updatePaddock', id, patch: { coords: kept, site: {} } }); // new shape: re-fetch soil etc.
            }}
            locate
            fitKey={fitKey}
            initialView={state.mapView}
            onViewChange={(value) => dispatch({ type: 'setMapView', value })}
          />

          <form className="map-search" role="search" onSubmit={onSearch}>
            <Icon name={searchState.busy ? 'spinner' : 'search'} size={16} className={`map-search__icon${searchState.busy ? ' spin' : ''}`} />
            <label className="visually-hidden" htmlFor="place-search">
              Search for a place
            </label>
            <input id="place-search" className="map-search__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search town, road or farm" autoComplete="off" />
            {searchState.error && <span className="map-search__error">{searchState.error}</span>}
          </form>

          <div className="map-status">
            {hint && (
              <p className="map-chip map-chip--warn" role="alert">
                <Icon name="alert" size={14} /> {hint}
              </p>
            )}
            {info && (
              <p className="map-chip map-chip--info" role="status">
                <Icon name="info" size={14} /> {info}
              </p>
            )}
            {editing && current && !hint && (
              <p className="map-chip">
                <Icon name="edit" size={14} /> Drag corners to reshape · click a small dot to add a corner · right-click a corner to remove it
              </p>
            )}
          </div>

          {drawing && (
            <div className="draw-bar" role="status">
              <span className="draw-bar__pulse" aria-hidden="true" />
              <div className="draw-bar__text">
                <strong>
                  {draft.corners ? `${draft.corners} corner${draft.corners === 1 ? '' : 's'}${draft.ha ? ` · ${formatHa(draft.ha)} ha` : ''}` : 'Click the map to place the first corner'}
                </strong>
                <span>{snap ? 'Corners snap to neighbours (Alt to place freely) · ' : ''}Click the first corner or press Enter to finish</span>
              </div>
              <div className="draw-bar__actions">
                <IconButton icon="undo" label="Undo last corner" disabled={!draft.corners} onClick={() => map.current?.undoPoint()} />
                <Button tone="ghost" size="sm" onClick={() => setDrawing(false)}>
                  Cancel
                </Button>
                <Button size="sm" icon="done" disabled={draft.corners < 3} onClick={() => map.current?.finishDrawing()}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
