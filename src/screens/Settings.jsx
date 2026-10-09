import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import CropSetPicker from '../components/CropSetPicker.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Card, Segmented, Switch, TextField } from '../components/ui.jsx';
import { APP_NAME } from '../config.js';
import { DEFAULT_FARM } from '../logic/cropSet.js';
import { useStore } from '../state/store.jsx';
import { setPref, usePrefs } from '../state/prefs.js';
import { useToast } from '../state/toast.jsx';
import '../styles/settings.css';

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: 'user' },
  { key: 'farm', label: 'Crops & livestock', icon: 'sprout' },
  { key: 'appearance', label: 'Appearance', icon: 'sun' },
  { key: 'data', label: 'Data & privacy', icon: 'database' },
];

export default function Settings() {
  const { state, dispatch } = useStore();
  const prefs = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const file = useRef(null);
  const [section, setSection] = useState('profile');
  const [name, setName] = useState(state.user?.name || '');
  const [confirm, setConfirm] = useState(false);

  function exportFarm() {
    const farm = { ...state };
    delete farm.user; // the profile name stays out of the file
    const blob = new Blob([JSON.stringify({ app: APP_NAME, version: 1, exported: new Date().toISOString(), farm }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `farm-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast({ tone: 'ok', icon: 'download', title: 'Farm exported', description: `${state.paddocks.length} paddocks saved to a file.` });
  }

  async function importFarm(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const farm = data.farm || data;
      if (!Array.isArray(farm.paddocks)) throw new Error('No paddocks in this file');
      dispatch({ type: 'import', value: farm });
      toast({ tone: 'ok', icon: 'upload', title: 'Farm imported', description: `${farm.paddocks.length} paddocks loaded from ${f.name}.` });
    } catch (err) {
      toast({ tone: 'bad', title: 'Couldn’t import that file', description: err.message });
    }
  }

  return (
    <Page title="Settings" description="Your profile, crop list, appearance and data. Changes save as you go." tip="settings">
      <div className="settings">
        <nav className="settings__nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button key={s.key} type="button" className={section === s.key ? 'is-on' : ''} aria-current={section === s.key ? 'page' : undefined} onClick={() => setSection(s.key)}>
              <Icon name={s.icon} size={16} />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings__body">
          {section === 'profile' && (
            <>
              <Card title="Profile" subtitle="How you appear in the app" icon="user">
                <form
                  className="settings__row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    dispatch({ type: 'login', name: name.trim() });
                    toast({ tone: 'ok', title: 'Name updated' });
                  }}
                >
                  <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Button type="submit" tone="ghost" disabled={!name.trim() || name.trim() === state.user?.name}>
                    Save
                  </Button>
                </form>
              </Card>
              <Card title="Guidance" subtitle="How much help Manami gives" icon="chat">
                <div className="settings__field">
                  <span className="settings__label">Farming experience</span>
                  <Segmented
                    label="Farming experience"
                    value={state.experience || 'new'}
                    onChange={(value) => dispatch({ type: 'setExperience', value })}
                    options={[
                      { value: 'new', label: 'New farmer · tips on' },
                      { value: 'experienced', label: 'Experienced · tips off' },
                    ]}
                  />
                </div>
                <div className="switch-row">
                  <div>
                    <p className="switch-row__label">Show tips again</p>
                    <p className="switch-row__desc">Bring back every tip you’ve hidden.</p>
                  </div>
                  <Button
                    tone="ghost"
                    size="sm"
                    icon="refresh"
                    disabled={!Object.keys(state.dismissedTips).length}
                    onClick={() => {
                      dispatch({ type: 'resetTips' });
                      if (state.experience !== 'new') dispatch({ type: 'setExperience', value: 'new' });
                      toast({ tone: 'ok', title: 'Tips are back on' });
                    }}
                  >
                    Reset tips
                  </Button>
                </div>
              </Card>
            </>
          )}

          {section === 'farm' && (
            <Card title="Crops and livestock" subtitle="The planner only uses what you tick here" icon="sprout">
              <CropSetPicker farm={state.farm ?? DEFAULT_FARM} onChange={(value) => dispatch({ type: 'setFarm', value })} />
            </Card>
          )}

          {section === 'appearance' && (
            <Card title="Appearance" icon="sun">
              <div className="settings__field">
                <span className="settings__label">Theme</span>
                <Segmented
                  label="Theme"
                  value={prefs.theme}
                  onChange={(v) => setPref('theme', v)}
                  options={[
                    { value: 'light', label: 'Light', icon: 'sun' },
                    { value: 'dark', label: 'Dark', icon: 'moon' },
                    { value: 'system', label: 'System', icon: 'monitor' },
                  ]}
                />
              </div>
              <Switch checked={prefs.sidebar === 'closed'} onChange={(v) => setPref('sidebar', v ? 'closed' : 'open')} label="Compact sidebar" description="Icons only, to give pages more room. Hover an icon for its name." />
            </Card>
          )}

          {section === 'data' && (
            <>
              <Card title="Your data" subtitle="Everything is saved in this browser only" icon="database">
                <div className="switch-row">
                  <div>
                    <p className="switch-row__label">Export farm</p>
                    <p className="switch-row__desc">Paddocks, history, priorities, crop list and the satellite record as a JSON file.</p>
                  </div>
                  <Button tone="ghost" icon="download" onClick={exportFarm}>
                    Export
                  </Button>
                </div>
                <div className="switch-row">
                  <div>
                    <p className="switch-row__label">Import farm</p>
                    <p className="switch-row__desc">Replace this farm with one exported earlier (on this or another computer).</p>
                  </div>
                  <Button tone="ghost" icon="upload" onClick={() => file.current?.click()}>
                    Import…
                  </Button>
                  <input ref={file} type="file" accept="application/json,.json" hidden onChange={importFarm} />
                </div>
                <div className="switch-row">
                  <div>
                    <p className="switch-row__label">Read the satellites again</p>
                    <p className="switch-row__desc">Forget the stored satellite record and read it fresh (images stay cached, so it’s quick).</p>
                  </div>
                  <Button tone="ghost" icon="satellite" disabled={!state.space} onClick={() => (dispatch({ type: 'setSpace', value: null }), toast({ tone: 'info', icon: 'satellite', title: 'Satellite record cleared', description: 'It will be read again in the background.' }))}>
                    Re-read
                  </Button>
                </div>
              </Card>
              <Card title="Danger zone" icon="alert" className="settings__danger">
                <div className="switch-row">
                  <div>
                    <p className="switch-row__label">Delete this farm</p>
                    <p className="switch-row__desc">Signs you out and removes every paddock from this browser. Export first if you want a copy.</p>
                  </div>
                  <Button tone="danger" icon="delete" onClick={() => setConfirm(true)}>
                    Delete farm
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {confirm && (
        <Modal
          title="Delete this farm?"
          description="This can’t be undone."
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button tone="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                tone="danger"
                icon="delete"
                onClick={() => {
                  dispatch({ type: 'logout' });
                  navigate('/');
                }}
              >
                Delete farm
              </Button>
            </>
          }
        >
          <p>
            {state.paddocks.length} paddock{state.paddocks.length === 1 ? '' : 's'}, their history and priorities will be removed from this browser.
          </p>
        </Modal>
      )}
    </Page>
  );
}
