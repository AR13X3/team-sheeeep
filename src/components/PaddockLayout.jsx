import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import PaddockMap from './PaddockMap.jsx';
import { SheepAvatar, SHEEP_COLORS } from './Art.jsx';
import { Card } from './ui.jsx';
import { areaHa, formatHa } from '../logic/geometry.js';
import { useStore } from '../state/store.jsx';

/** Briefly shows "Saved" whenever the farmer's inputs for this paddock change. */
function useSavedFlash(paddock) {
  const [visible, setVisible] = useState(false);
  const last = useRef({ id: paddock.id, sig: null });
  const sig = JSON.stringify([paddock.history, paddock.issues, paddock.comments, paddock.priorities, paddock.reasons]);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: paddock.id, sig };
    if (prev.sig === null || prev.id !== paddock.id || prev.sig === sig) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [paddock.id, sig]);
  return visible;
}

/**
 * Left: "Paddock #N" card (with History / Priorities switcher) + map with the current
 * paddock highlighted, and the step's main action underneath so it's always in reach.
 * Right: the vertically scrolling column of input cards.
 */
export default function PaddockLayout({ paddock, index, total, step, actions, overlay, overlayLabel, children }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const saved = useSavedFlash(paddock);
  const styleFor = useCallback((p) => ({ fillColor: SHEEP_COLORS[p.sheep], color: '#ece4d4' }), []);
  const labelFor = useCallback((p) => `${p.name} · ${formatHa(areaHa(p.coords))} ha`, []);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);

  return (
    <div className="cols cols--paddock">
      <div className="cols__left">
        <Card className="name-card">
          <div className="name-card__row">
            <SheepAvatar n={paddock.sheep} size={46} />
            <h2>{paddock.name}</h2>
          </div>
          <p className="name-card__meta">
            <span>
              {formatHa(areaHa(paddock.coords))} ha · paddock {index + 1} of {total}
            </span>
            <span className={`saved ${saved ? 'is-visible' : ''}`} role="status">
              {saved ? '✓ Saved' : ''}
            </span>
          </p>
          <nav className="segmented" aria-label={`${paddock.name} sections`}>
            <NavLink to={`/paddocks/${paddock.id}/history`}>1 · History</NavLink>
            <NavLink to={`/paddocks/${paddock.id}/priorities`}>2 · Priorities</NavLink>
          </nav>
        </Card>
        <Card className="map-card">
          <div className="map-frame">
            <PaddockMap
              paddocks={state.paddocks}
              styleFor={styleFor}
              labelFor={labelFor}
              tagFor={tagFor}
              highlightId={paddock.id}
              onSelect={(id) => id !== paddock.id && navigate(`/paddocks/${id}/${step}`)}
              fitKey={state.paddocks.length}
              initialView={state.mapView}
              overlay={overlay}
            />
            {overlay && overlayLabel && (
              <p className="canola-legend">
                <i /> {overlayLabel}
              </p>
            )}
          </div>
        </Card>
      </div>
      <div className="cols__right">
        <div className="scroll-col">{children}</div>
      </div>
      <div className="cols__actions">{actions}</div>
    </div>
  );
}
