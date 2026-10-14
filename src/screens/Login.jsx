import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Scene from '../components/Scene.jsx';
import Art from '../components/Art.jsx';
import Icon from '../components/Icon.jsx';
import { Button, TextField } from '../components/ui.jsx';
import { APP_NAME } from '../config.js';
import { useStore } from '../state/store.jsx';
import { buildDemoPaddocks, DEMO_FARM } from '../data/demoFarm.js';
import '../styles/auth.css';

const FEATURES = [
  { icon: 'satellite', title: 'Paddock memory from space', text: 'Five seasons of NASA satellite images show what grew where.' },
  { icon: 'alert', title: 'Blackleg early warning', text: 'Neighbouring canola spotted from orbit steers your rotation.' },
  { icon: 'calendar', title: 'Safest sowing window', text: '30 years of NASA weather: less frost at flowering, less heat at fill.' },
];

// Front-end only: there is no backend yet, so "signing in" names the local profile.
// Swap `submit` for a real auth call when one exists; passwords are never stored.
export default function Login() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  function submit(mode) {
    if (!name.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Choose a password with at least 6 characters.');
      return;
    }
    dispatch({ type: 'login', name: name.trim() });
    navigate('/experience');
  }

  function tryDemo() {
    dispatch({ type: 'login', name: 'Guest' });
    dispatch({ type: 'setExperience', value: 'new' });
    dispatch({ type: 'setPaddocks', paddocks: buildDemoPaddocks(), note: 'Demo farm loaded (4 paddocks, NSW Riverina)' });
    dispatch({ type: 'setMapView', value: DEMO_FARM.view });
    dispatch({ type: 'completeSetup' });
    navigate('/dashboard');
  }

  return (
    <div className="auth">
      <Scene name="meadow" />
      <div className="auth__inner">
        <section className="auth__brand">
          <div className="auth__logo">
            <span className="auth__logo-mark">
              <Art name="manami" />
            </span>
            <span>{APP_NAME}</span>
          </div>
          <h1 className="auth__headline">Plan every paddock with NASA satellite data.</h1>
          <p className="auth__lead">Map your paddocks, see what grew on them from space, and get a ten-season crop rotation that protects your soil and your margins.</p>
          <ul className="auth__features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="auth__feature-icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <strong>{f.title}</strong>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <form
          className="auth__card"
          onSubmit={(e) => {
            e.preventDefault();
            submit('login');
          }}
          noValidate
        >
          <div className="auth__card-head">
            <Art name="manami" className="auth__mascot" label="Manami the sheep" />
            <div>
              <h2>Welcome back</h2>
              <p>Sign in to your farm workspace.</p>
            </div>
          </div>

          {state.user && (
            <button type="button" className="auth__resume" onClick={() => navigate(state.setupDone ? '/dashboard' : '/experience')}>
              <span className="auth__resume-badge">{state.user.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>Continue as {state.user.name}</strong>
                <span>{state.paddocks.length ? `${state.paddocks.length} paddocks saved in this browser` : 'Pick up where you left off'}</span>
              </span>
              <Icon name="arrow-forward" size={16} />
            </button>
          )}

          <div className="auth__fields">
            <TextField label="Username" icon="user" autoComplete="username" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
            <TextField
              label="Password"
              icon="shield"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => (setPassword(e.target.value), setError(''))}
              end={
                <button type="button" className="auth__peek" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  <Icon name={show ? 'eye-off' : 'eye'} size={16} />
                </button>
              }
            />
          </div>
          {error && (
            <p className="auth__error" role="alert">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
          <div className="auth__actions">
            <Button tone="login" size="lg" type="submit" block>
              Sign in
            </Button>
            <Button tone="outline" size="lg" block onClick={() => submit('signup')}>
              Create account
            </Button>
          </div>
          <div className="auth__or">
            <span>or</span>
          </div>
          <Button tone="secondary" size="lg" icon="sparkles" block onClick={tryDemo}>
            Try the demo farm
          </Button>
          <p className="auth__note">
            <Icon name="shield" size={13} /> No account needed for the demo. Everything stays in this browser.
          </p>
        </form>
      </div>
      <p className="auth__sources">Data: NASA HLS · NASA POWER · ISRIC SoilGrids · Copernicus DEM</p>
    </div>
  );
}
