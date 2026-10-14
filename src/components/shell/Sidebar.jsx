import { Link, useNavigate } from 'react-router-dom';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';
import { NAV } from './routeMeta.js';
import { APP_NAME } from '../../config.js';
import { formatHa } from '../../logic/geometry.js';
import { useStore } from '../../state/store.jsx';
import { setPref, usePrefs } from '../../state/prefs.js';
import { setupProgress, useFarm } from '../../state/useFarm.js';

function Ring({ value, size = 34 }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring__track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

export default function Sidebar({ meta }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const collapsed = prefs.sidebar === 'closed';
  const { totalHa, alerts } = useFarm();
  const progress = setupProgress(state);
  const name = state.user?.name || 'Guest';
  const tip = (label) => (collapsed ? { 'data-tip': label, 'data-tip-pos': 'right' } : {});
  const urgent = alerts.filter((a) => a.tone === 'bad').length;
  const badges = { map: state.paddocks.length || null, dashboard: urgent || null };

  return (
    <aside className="side" aria-label="Main navigation">
      <Link to="/dashboard" className="side__brand" {...tip(APP_NAME)}>
        <span className="side__logo">
          <Art name="manami" />
        </span>
        <span className="side__name">
          {APP_NAME}
          <small>Paddock &amp; rotation planner</small>
        </span>
      </Link>

      <Link to="/dashboard" className="side__farm" {...tip(`${name}’s farm`)}>
        <span className="side__farm-badge" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="side__farm-text">
          <strong>{name}’s farm</strong>
          <span>
            {state.paddocks.length} paddock{state.paddocks.length === 1 ? '' : 's'} · {totalHa ? formatHa(totalHa) : 0} ha
          </span>
        </span>
      </Link>

      <nav className="side__nav">
        <p className="side__group">Workspace</p>
        {NAV.map((item) => (
          <Link key={item.key} to={item.to} className={`side__item${meta.section === item.key ? ' is-active' : ''}`} aria-current={meta.section === item.key ? 'page' : undefined} {...tip(item.label)}>
            <Icon name={item.icon} size={18} />
            <span className="side__label">{item.label}</span>
            {badges[item.key] && <span className={`side__count${item.key === 'dashboard' ? ' is-alert' : ''}`}>{badges[item.key]}</span>}
          </Link>
        ))}
      </nav>

      {!progress.complete && (
        <button type="button" className="side__setup" onClick={() => navigate(progress.next.to(state))} {...tip(`Getting started · ${progress.count} of ${progress.total}`)}>
          <span className="side__setup-ring">
            <Ring value={progress.count / progress.total} />
            <em>
              {progress.count}/{progress.total}
            </em>
          </span>
          <span className="side__setup-text">
            <strong>Getting started</strong>
            <span>Next: {progress.next.label}</span>
          </span>
          <Icon name="chevron-right" size={16} className="side__setup-go" />
        </button>
      )}

      <div className="side__bottom">
        <Link to="/settings" className={`side__item${meta.section === 'settings' ? ' is-active' : ''}`} {...tip('Settings')}>
          <Icon name="settings" size={18} />
          <span className="side__label">Settings</span>
        </Link>
        <button type="button" className="side__item side__collapse" onClick={() => setPref('sidebar', collapsed ? 'open' : 'closed')} {...tip(collapsed ? 'Expand sidebar' : 'Collapse sidebar')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name={collapsed ? 'panel-open' : 'panel-close'} size={18} />
          <span className="side__label">Collapse</span>
        </button>
        <div className="side__user">
          <span className="side__avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="side__user-text">
            <strong>{name}</strong>
            <span>Saved in this browser</span>
          </span>
          <button
            type="button"
            className="side__logout"
            aria-label="Sign out"
            data-tip="Sign out"
            data-tip-pos={collapsed ? 'right' : undefined}
            onClick={() => {
              dispatch({ type: 'logout' });
              navigate('/');
            }}
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
