import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { RoundButton } from './ui.jsx';
import { useStore } from '../state/store.jsx';

/** The Planner's top-right "Menue" button, opening a small navigation card. */
export default function AppMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const first = state.paddocks[0];

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
    <div className="app-menu" ref={box}>
      <RoundButton icon="menu" label="Menu" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} />
      {open && (
        <nav className="app-menu__panel card" aria-label="Main">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/planner">Planner</NavLink>
          <NavLink to="/paddocks" end>
            Outline paddocks
          </NavLink>
          {first && <NavLink to={`/paddocks/${first.id}/history`}>Paddock details</NavLink>}
          <NavLink to={`/farm?back=${encodeURIComponent(pathname)}`}>Your crops</NavLink>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'logout' });
              navigate('/');
            }}
          >
            Log out
          </button>
        </nav>
      )}
    </div>
  );
}
