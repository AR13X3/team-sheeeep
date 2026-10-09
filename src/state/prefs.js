import { useSyncExternalStore } from 'react';

// Per-device preferences, kept apart from the farm (they survive "Sign out").
// index.html applies the theme before the first paint using the same key.
const KEYS = { theme: 'sheeep:theme', sidebar: 'sheeep:sidebar' };
const DEFAULTS = { theme: 'system', sidebar: 'open' };

const read = (k) => {
  try {
    return localStorage.getItem(KEYS[k]) || DEFAULTS[k];
  } catch {
    return DEFAULTS[k];
  }
};

let prefs = { theme: read('theme'), sidebar: read('sidebar') };
const listeners = new Set();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const resolvedTheme = (t = prefs.theme) => (t === 'dark' || (t === 'system' && media?.matches) ? 'dark' : 'light');

function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolvedTheme());
}

media?.addEventListener('change', () => {
  if (prefs.theme !== 'system') return;
  prefs = { ...prefs }; // new snapshot so subscribers re-render
  applyTheme();
  listeners.forEach((l) => l());
});

export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  try {
    localStorage.setItem(KEYS[key], value);
  } catch {
    /* private window: the choice lasts this visit */
  }
  if (key === 'theme') applyTheme();
  listeners.forEach((l) => l());
}

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

/** { theme: 'light'|'dark'|'system', sidebar: 'open'|'closed', dark: boolean } */
export function usePrefs() {
  const p = useSyncExternalStore(subscribe, () => prefs);
  return { ...p, dark: resolvedTheme(p.theme) === 'dark' };
}
