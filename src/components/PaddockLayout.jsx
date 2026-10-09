import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Page from './Page.jsx';
import PaddockMap from './PaddockMap.jsx';
import Icon from './Icon.jsx';
import { SheepAvatar, SHEEP_COLORS } from './Art.jsx';
import { Badge, Card, CropChip, IconButton } from './ui.jsx';
import { areaHa, formatHa } from '../logic/geometry.js';
import { useStore } from '../state/store.jsx';
import { useFarm } from '../state/useFarm.js';

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

const TABS = [
  { key: '', label: 'Overview', icon: 'dashboard' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'conditions', label: 'Conditions', icon: 'mountain' },
  { key: 'priorities', label: 'Priorities', icon: 'target' },
];

/**
 * Paddock detail frame: header with the paddock's key facts and prev/next, tabs, the tab's
 * content on the left and a sticky rail (map + the paddock's plan) on the right.
 * `step` = the tab key; `action` = the setup flow's next button.
 */
export default function PaddockLayout({ paddock, index, total, step, action, overlay, overlayLabel, children }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { plans, years } = useFarm();
  const saved = useSavedFlash(paddock);
  const styleFor = useCallback((p) => ({ fillColor: SHEEP_COLORS[p.sheep], color: '#ece4d4' }), []);
  const labelFor = useCallback((p) => `${p.name} · ${formatHa(areaHa(p.coords))} ha`, []);
  const tagFor = useCallback((p) => p.name.replace('Paddock ', ''), []);
  const tab = (key) => `/paddocks/${paddock.id}${key ? `/${key}` : ''}`;
  const prev = state.paddocks[index - 1];
  const next = state.paddocks[index + 1];
  const soil = paddock.site?.soil;
  const terrain = paddock.site?.terrain;
  const plan = plans[paddock.id];
  const inSetup = !state.setupDone && (step === 'history' || step === 'priorities');

  return (
    <Page
      eyebrow={
        <Link to="/register">
          <Icon name="arrow-back" size={13} /> All paddocks
        </Link>
      }
      title={
        <span className="pd-title">
          <span className="pd-title__avatar">
            <SheepAvatar n={paddock.sheep} size={34} />
          </span>
          {paddock.name}
        </span>
      }
      meta={
        <>
          <Badge icon="paddocks">{formatHa(areaHa(paddock.coords))} ha</Badge>
          {soil?.texture && <Badge icon="mountain">{soil.texture}</Badge>}
          {soil?.ph != null && <Badge>pH {soil.ph.toFixed(1)}</Badge>}
          {terrain && <Badge icon="gauge">{terrain.slopePct.toFixed(1)}% slope</Badge>}
          <Badge>
            {index + 1} of {total}
          </Badge>
          <span className={`saved ${saved ? 'is-visible' : ''}`} role="status">
            {saved && (
              <>
                <Icon name="circle-check" size={14} /> Saved
              </>
            )}
          </span>
        </>
      }
      step={inSetup ? 'details' : undefined}
      tip={step || 'paddock'}
      actions={
        <>
          <div className="pd-nav">
            <IconButton icon="chevron-left" label={prev ? `Previous: ${prev.name}` : 'No previous paddock'} tone="outline" className="icon-btn--outline" disabled={!prev} onClick={() => navigate(`/paddocks/${prev.id}${step ? `/${step}` : ''}`)} />
            <IconButton icon="chevron-right" label={next ? `Next: ${next.name}` : 'No next paddock'} tone="outline" className="icon-btn--outline" disabled={!next} onClick={() => navigate(`/paddocks/${next.id}${step ? `/${step}` : ''}`)} />
          </div>
          {action}
        </>
      }
    >
      <nav className="tabs" aria-label={`${paddock.name} sections`}>
        {TABS.map((t) => (
          <NavLink key={t.key} to={tab(t.key)} end>
            <Icon name={t.icon} size={15} />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="pd">
        <div className="pd__main">{children}</div>
        <aside className="pd__rail">
          <Card flush className="pd__map-card">
            <div className="map-frame pd__map">
              <PaddockMap
                paddocks={state.paddocks}
                styleFor={styleFor}
                labelFor={labelFor}
                tagFor={tagFor}
                highlightId={paddock.id}
                onSelect={(id) => id !== paddock.id && navigate(`/paddocks/${id}${step ? `/${step}` : ''}`)}
                fitKey={state.paddocks.length}
                initialView={state.mapView}
                overlay={overlay}
              />
              {overlay && overlayLabel && (
                <div className="map-legend">
                  <ul>
                    <li>
                      <span className="canola-swatch" /> {overlayLabel}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </Card>
          {plan && (
            <Card title="Plan for this paddock" icon="planner" actions={<Link to="/planner" className="btn btn--plain btn--sm"><span className="btn__label">Planner</span></Link>}>
              <ol className="pd-plan">
                {plan.seasons.slice(0, 5).map((s, i) => (
                  <li key={i}>
                    <span className="pd-plan__year num">{years[i]}</span>
                    <CropChip crop={s.crop} size="sm" />
                    <span className="pd-plan__health num" title="Soil health after this season">
                      {s.health}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </aside>
      </div>
    </Page>
  );
}
