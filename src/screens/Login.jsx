import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import Art from '../components/Art.jsx';
import { Button, TextField } from '../components/ui.jsx';
import { APP_NAME } from '../config.js';
import { useStore } from '../state/store.jsx';
import { buildDemoPaddocks, DEMO_FARM } from '../data/demoFarm.js';
import '../styles/screens.css';

// Front-end only: there is no backend yet, so "logging in" just names the local profile.
// Swap `submit` for a real auth call when one exists — passwords are never stored.
export default function Login() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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
    dispatch({ type: 'setPaddocks', paddocks: buildDemoPaddocks() });
    dispatch({ type: 'setMapView', value: DEMO_FARM.view });
    navigate('/paddocks');
  }

  return (
    <Screen scene="meadow">
      <div className="login">
        <form
          className="card login__card"
          onSubmit={(e) => {
            e.preventDefault();
            submit('login');
          }}
          noValidate
        >
          <Art name="manami" className="login__mascot" label="Manami the sheep" />
          <h1 className="login__title">{APP_NAME}</h1>
          <div className="login__fields">
            <TextField label="Username" autoComplete="username" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
            <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(''))} />
          </div>
          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}
          <div className="login__actions">
            <Button tone="login" size="small" type="submit">
              Login
            </Button>
            <Button tone="outline" size="small" onClick={() => submit('signup')}>
              Sign up
            </Button>
          </div>
          <p className="login__demo">
            Just looking?{' '}
            <button type="button" className="link-btn" onClick={tryDemo}>
              Try the demo farm
            </button>
          </p>
        </form>
      </div>
    </Screen>
  );
}
