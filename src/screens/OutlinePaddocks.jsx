import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import PaddockMap from '../components/PaddockMap.jsx';
import Icon from '../components/Icon.jsx';
import { SheepAvatar, SHEEP_COLORS } from '../components/Art.jsx';
import { Button, Card } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { areaHa, formatHa, selfIntersects } from '../logic/geometry.js';
import { trimOverlaps } from '../logic/overlap.js';
import { searchPlace } from '../services/geocode.js';
import { buildDemoPaddocks, DEMO_FARM } from '../data/demoFarm.js';
import '../styles/screens.css';

export default function OutlinePaddocks() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const map = useRef(null);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState({ busy: false, error: '' });
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState({ corners: 0, ha: 0 });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [hint, setHint] = useState(''); // warnings (rose)
  const [info, setInfo] = useState(''); // what we did for you (cream)
  const [editKey, setEditKey] = useState(0);
  const [snap, setSnap] = useState(() => {
    try {
      return localStorage.getItem('sheeep:snap') !== 'off';
    } catch {
      return true;
    }
  });
  const { paddocks } = state;

  // One switch for drawing and reshaping: corners lock onto neighbouring paddocks.
  const snapToggle = (
    <button type="button" className={`snap-toggle ${snap ? 'is-on' : ''}`} role="switch" aria-checked={snap} onClick={() => setSnap((v) => !v)} title="Lock corners onto neighbouring paddocks (hold Alt to skip once)">
      <span className="snap-toggle__track" aria-hidden="true">
        <span />
      </span>
      Snap
    </button>
  );

  useEffect(() => {
    try {
      localStorage.setItem('sheeep:snap', snap ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, [snap]);

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

  function select(id) {
    setSelected((s) => (s === id ? null : id));
    setEditing(false);
  }

  function startDrawing() {
    setSelected(null);
    setEditing(false);
    setHint('');
    setInfo('');
    setDrawing(true);
  }

  function loadDemo() {
    dispatch({ type: 'setPaddocks', paddocks: buildDemoPaddocks() });
    dispatch({ type: 'setMapView', value: DEMO_FARM.view });
    setFitKey((k) => k + 1);
  }

  function next() {
    if (!paddocks.length) {
      setHint('Outline at least one paddock first, or try the demo farm.');
      return;
    }
    navigate('/paddocks/review');
  }

  return (
    <Screen scene="field" title="Your Paddocks" step={1} back="/experience" chat="paddocks">
      <div className="outline">
        <Card className="outline__card">
          <h2 className="outline__title">Outline your Paddocks</h2>
          <div className="map-frame outline__map">
            <PaddockMap
              ref={map}
              paddocks={paddocks}
              styleFor={styleFor}
              labelFor={labelFor}
              tagFor={tagFor}
              highlightId={selected}
              onSelect={select}
              drawing={drawing}
              onDraftChange={setDraft}
              onDrawCancel={() => setDrawing(false)}
              onDrawComplete={(coords) => {
                const kept = settle(coords);
                if (kept) dispatch({ type: 'addPaddock', coords: kept });
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

            {/* top-left: what you can do right now */}
            {!drawing && (
              <div className="map-tools map-tools--left">
                <Button size="compact" className="btn--map" icon="plus" onClick={startDrawing}>
                  Paddock
                </Button>
                {!paddocks.length && (
                  <Button tone="secondary" size="compact" className="btn--map" onClick={loadDemo}>
                    Demo farm
                  </Button>
                )}
                {current && (
                  <>
                    <Button tone="secondary" size="compact" className="btn--map" icon={editing ? 'done' : 'edit'} onClick={() => setEditing((e) => !e)}>
                      {editing ? 'Done editing' : 'Edit shape'}
                    </Button>
                    {editing && <div className="map-chip snap-chip">{snapToggle}</div>}
                    <Button
                      tone="danger"
                      size="compact"
                      className="btn--map btn--icon-only"
                      icon="delete"
                      aria-label={`Delete ${current.name}`}
                      title={`Delete ${current.name}`}
                      onClick={() => {
                        dispatch({ type: 'removePaddock', id: current.id });
                        setSelected(null);
                        setEditing(false);
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {/* top-right: find your farm */}
            <form className="map-search" role="search" onSubmit={onSearch}>
              <Icon name="search" size={28} className="map-search__icon" />
              <label className="visually-hidden" htmlFor="place-search">
                Search for a place
              </label>
              <input
                id="place-search"
                className="map-search__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchState.busy ? 'Searching…' : 'Search town, road or farm'}
                autoComplete="off"
              />
              {searchState.error && <span className="map-search__error">{searchState.error}</span>}
            </form>

            {/* bottom: drawing bar, or the paddock list + continue */}
            {drawing ? (
              <div className="draw-bar" role="status">
                <div className="draw-bar__text">
                  <strong>
                    {draft.corners
                      ? `${draft.corners} corner${draft.corners === 1 ? '' : 's'}${draft.ha ? ` · ${formatHa(draft.ha)} ha` : ''}`
                      : 'Click the map to place the first corner'}
                  </strong>
                  <span>
                    {snap ? 'Corners lock onto neighbouring paddocks (hold Alt to place freely) · ' : ''}Click the first corner or press Enter to finish · Backspace undoes · Esc cancels
                  </span>
                </div>
                <div className="draw-bar__actions">
                  {snapToggle}
                  <Button tone="secondary" size="compact" className="btn--map btn--icon-only" icon="undo" aria-label="Undo last corner" title="Undo last corner" disabled={!draft.corners} onClick={() => map.current?.undoPoint()} />
                  <Button tone="danger" size="compact" className="btn--map" onClick={() => setDrawing(false)}>
                    Cancel
                  </Button>
                  <Button size="compact" className="btn--map" icon="done" disabled={draft.corners < 3} onClick={() => map.current?.finishDrawing()}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="map-status">
                  {hint && (
                    <p className="map-chip map-chip--warn" role="alert">
                      {hint}
                    </p>
                  )}
                  {info && (
                    <p className="map-chip" role="status">
                      {info}
                    </p>
                  )}
                  {editing && current ? (
                    <p className="map-chip">Drag corners to reshape (they lock onto neighbours; Alt to place freely) · click a small dot to add a corner · right-click a corner to remove it</p>
                  ) : (
                    <ul className="paddock-chips" aria-label="Paddocks">
                      {paddocks.map((p) => (
                        <li key={p.id} className={`map-chip paddock-chip ${selected === p.id ? 'is-selected' : ''}`}>
                          <button
                            type="button"
                            className="paddock-chip__name"
                            aria-pressed={selected === p.id}
                            onClick={() => {
                              select(p.id);
                              if (selected !== p.id) map.current?.focus(p.coords);
                            }}
                          >
                            <SheepAvatar n={p.sheep} size={26} />
                            {p.name} · {formatHa(areaHa(p.coords))} ha
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button className="map-continue" iconEnd="arrow-forward" onClick={next}>
                  {paddocks.length ? `Continue with ${paddocks.length}` : 'Continue'}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </Screen>
  );
}
