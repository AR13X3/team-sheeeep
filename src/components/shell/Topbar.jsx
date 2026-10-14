import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';
import { IconButton, Kbd } from '../ui.jsx';
import { useShell } from './ShellContext.js';
import { MASCOT_NAME } from '../../config.js';
import { useStore } from '../../state/store.jsx';
import { setPref, usePrefs } from '../../state/prefs.js';
import { useSpace } from '../../state/useSpace.js';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Live state of the satellite read: progress while running, then a link to the results. */
function SatelliteStatus() {
  const { state } = useStore();
  const space = useSpace();
  const navigate = useNavigate();
  if (!state.paddocks.length) return null;
  const { running, result, error, progress } = space;
  const pct = progress.total ? progress.done / progress.total : 0;

  if (running)
    return (
      <button type="button" className="sat-pill is-running" onClick={() => navigate('/insights')} title="Reading NASA satellite images of your farm">
        <svg className="sat-pill__ring" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" />
          <circle cx="10" cy="10" r="8" style={{ strokeDasharray: 50.3, strokeDashoffset: 50.3 * (1 - Math.max(0.04, pct)) }} />
        </svg>
        <span className="sat-pill__text">
          Reading satellites<span className="num">{progress.total ? ` ${progress.done}/${progress.total}` : '…'}</span>
        </span>
      </button>
    );
  if (result)
    return (
      <button type="button" className="sat-pill is-ready" onClick={() => navigate('/insights')} title={result.source}>
        <Icon name="satellite" size={15} />
        <span className="sat-pill__text">
          Satellite record <span className="num">· {result.looks} images</span>
        </span>
      </button>
    );
  return (
    <button type="button" className={`sat-pill${error ? ' is-error' : ''}`} onClick={space.start} title={error || 'Read what NASA satellites saw on your paddocks'}>
      <Icon name={error ? 'alert' : 'satellite'} size={15} />
      <span className="sat-pill__text">{error ? 'Satellite read failed · retry' : 'Read from space'}</span>
    </button>
  );
}

function UserMenu() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const name = state.user?.name || 'Guest';

  useEffect(() => {
    if (!open) return;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="menu" ref={box}>
      <button type="button" className="top__avatar" aria-haspopup="menu" aria-expanded={open} aria-label="Account" onClick={() => setOpen((o) => !o)}>
        {name.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="menu__panel" role="menu">
          <div className="menu__head">
            <strong>{name}</strong>
            <span>{state.experience === 'experienced' ? 'Experienced farmer' : 'New farmer · tips on'}</span>
          </div>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)}>
            <Icon name="settings" size={16} /> Settings
          </Link>
          <Link role="menuitem" to="/farm?back=%2Fsettings" onClick={() => setOpen(false)}>
            <Icon name="sprout" size={16} /> Your crops
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              dispatch({ type: 'logout' });
              navigate('/');
            }}
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ meta, onMenu }) {
  const { openPalette, openManami, manamiOpen, closeManami, hasTip } = useShell();
  const prefs = usePrefs();
  return (
    <header className="top">
      <IconButton icon="menu" label="Open navigation" className="top__menu" onClick={onMenu} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          {meta.crumbs.map((c, i) => (
            <li key={i}>
              {i > 0 && <Icon name="chevron-right" size={14} className="crumbs__sep" />}
              {c.to && i < meta.crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === meta.crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="top__right">
        <button type="button" className="top__search" onClick={openPalette} aria-label="Search pages, paddocks and actions">
          <Icon name="search" size={16} />
          <span className="top__search-text">Search or jump to…</span>
          <span className="top__search-keys">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <SatelliteStatus />
        <IconButton icon={prefs.dark ? 'sun' : 'moon'} label={prefs.dark ? 'Light mode' : 'Dark mode'} onClick={() => setPref('theme', prefs.dark ? 'light' : 'dark')} />
        <button type="button" className={`top__manami${manamiOpen ? ' is-open' : ''}`} onClick={() => (manamiOpen ? closeManami() : openManami())} aria-expanded={manamiOpen}>
          <span className="top__manami-face">
            <Art name="manami" />
            {hasTip && <span className="top__manami-dot" aria-hidden="true" />}
          </span>
          <span className="top__manami-text">{hasTip ? `${MASCOT_NAME} has a tip` : `Ask ${MASCOT_NAME}`}</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
