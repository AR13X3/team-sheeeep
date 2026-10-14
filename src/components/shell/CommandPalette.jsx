import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { SheepAvatar } from '../Art.jsx';
import { Kbd } from '../ui.jsx';
import { NAV } from './routeMeta.js';
import { useShell } from './ShellContext.js';
import { areaHa, formatHa } from '../../logic/geometry.js';
import { useStore } from '../../state/store.jsx';
import { setPref, usePrefs } from '../../state/prefs.js';

/** Ctrl/⌘ K: jump to any page or paddock, or run an action, by typing a few letters. */
export default function CommandPalette({ onClose }) {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { openManami } = useShell();
  const prefs = usePrefs();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  const items = useMemo(() => {
    const go = (to) => () => navigate(to);
    const pages = [...NAV, { key: 'settings', label: 'Settings', icon: 'settings', to: '/settings' }].map((n) => ({ group: 'Pages', id: n.key, label: n.label, icon: n.icon, run: go(n.to) }));
    const paddocks = state.paddocks.map((p) => ({
      group: 'Paddocks',
      id: p.id,
      label: p.name,
      hint: `${formatHa(areaHa(p.coords))} ha`,
      sheep: p.sheep,
      keywords: 'paddock field',
      run: go(`/paddocks/${p.id}`),
    }));
    const actions = [
      { id: 'draw', label: 'Draw a new paddock', icon: 'plus', keywords: 'add outline create', run: go('/paddocks?draw=1') },
      { id: 'soil', label: 'Run the soil check', icon: 'mountain', keywords: 'split review', run: go('/paddocks/review') },
      { id: 'crops', label: 'Choose your crops', icon: 'sprout', keywords: 'livestock crop list', run: go('/farm?back=%2Fplanner') },
      { id: 'export', label: 'Export the plan (CSV)', icon: 'download', keywords: 'excel download spreadsheet', run: go('/planner?export=1') },
      { id: 'manami', label: 'Ask Manami a question', icon: 'chat', keywords: 'help assistant chat', run: () => openManami() },
      { id: 'theme', label: prefs.dark ? 'Switch to light mode' : 'Switch to dark mode', icon: prefs.dark ? 'sun' : 'moon', keywords: 'theme dark light', run: () => setPref('theme', prefs.dark ? 'light' : 'dark') },
      {
        id: 'logout',
        label: 'Sign out',
        icon: 'logout',
        keywords: 'log out exit',
        run: () => {
          dispatch({ type: 'logout' });
          navigate('/');
        },
      },
    ].map((a) => ({ ...a, group: 'Actions' }));
    const all = [...pages, ...paddocks, ...actions];
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((i) => `${i.label} ${i.keywords || ''} ${i.group}`.toLowerCase().includes(t));
  }, [q, state.paddocks, prefs.dark, navigate, openManami, dispatch]);

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function run(item) {
    onClose();
    item?.run();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
    else if (e.key === 'Enter') (e.preventDefault(), run(items[active]));
    else if (e.key === 'Escape') onClose();
  }

  let lastGroup = null;
  return createPortal(
    <div className="palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette__search">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, paddocks and actions…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pal-${active}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="palette__list" id="palette-list" role="listbox" ref={list}>
          {!items.length && <li className="palette__empty">Nothing matches “{q}”.</li>}
          {items.map((item, i) => {
            const head = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <li key={`${item.group}:${item.id}`} role="presentation">
                {head && <p className="palette__group">{item.group}</p>}
                <button
                  type="button"
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className={`palette__item${i === active ? ' is-active' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(item)}
                >
                  {item.sheep ? <SheepAvatar n={item.sheep} size={22} /> : <Icon name={item.icon} size={16} />}
                  <span className="palette__label">{item.label}</span>
                  {item.hint && <span className="palette__hint">{item.hint}</span>}
                  {i === active && <Icon name="enter" size={14} className="palette__enter" />}
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="palette__foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
          <span>
            <Kbd>/</Kbd> opens search from anywhere
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
