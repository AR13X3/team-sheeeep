import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from './store.jsx';
import { interiorPoint } from '../logic/geometry.js';
import { fetchSoil } from '../services/soil.js';
import { fetchTerrain } from '../services/terrain.js';
import { fetchClimate } from '../services/climate.js';

// Soil and climate are sampled at a point guaranteed to be inside the paddock;
// slope is fitted across the whole paddock.
export const SOURCES = {
  soil: (coords) => fetchSoil(interiorPoint(coords)),
  terrain: (coords) => fetchTerrain(coords),
  climate: (coords) => fetchClimate(interiorPoint(coords)),
};
export const SOURCE_COUNT = Object.keys(SOURCES).length;

// One status table for the whole app: { [paddockId]: { soil, terrain, climate } } with
// 'loading' | 'ok' | 'error'. Requests are shared, so a paddock is never fetched twice at once.
let statuses = {};
const inflight = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

function setStatus(id, key, value) {
  if (statuses[id]?.[key] === value) return;
  statuses = { ...statuses, [id]: { ...statuses[id], [key]: value } };
  emit();
}

/**
 * Fills paddock.site.{soil, terrain, climate} from the public data services the first
 * time a paddock is seen. `attempt` re-tries sources that failed. Returns this paddock's status.
 */
export function useSiteData(paddock, attempt = 0) {
  const { dispatch } = useStore();
  const id = paddock?.id;
  const coordsKey = paddock ? JSON.stringify(paddock.coords) : '';

  useEffect(() => {
    if (!paddock) return;
    for (const [key, fetcher] of Object.entries(SOURCES)) {
      // terrain cached before the whole-paddock slope fit has no `samples`: fetch it again
      const stale = key === 'terrain' && paddock.site?.terrain && paddock.site.terrain.samples == null;
      if (paddock.site?.[key] !== undefined && !stale) {
        setStatus(id, key, 'ok');
        continue;
      }
      const job = `${id}|${key}|${coordsKey}`;
      if (inflight.has(job)) continue;
      inflight.add(job);
      setStatus(id, key, 'loading');
      fetcher(paddock.coords)
        .then((value) => {
          // stored even if the screen was left: the data belongs to the paddock
          dispatch({ type: 'updatePaddock', id, patch: (p) => ({ site: { ...p.site, [key]: value } }) });
          setStatus(id, key, 'ok');
        })
        .catch((err) => {
          console.warn(`[site data] ${key} failed`, err);
          setStatus(id, key, 'error');
        })
        .finally(() => inflight.delete(job));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, coordsKey, attempt]);

  return useSiteStatus(id);
}

const EMPTY = {};
/** Status of one paddock's auto-filled data, without fetching anything. */
export function useSiteStatus(id) {
  return useSyncExternalStore(subscribe, () => statuses[id] || EMPTY);
}

/** Every paddock's status (for the planner's progress and the data-sources panel). */
export function useAllSiteStatus() {
  return useSyncExternalStore(subscribe, () => statuses);
}

/** Counts across the given paddocks: { loading, error, ok, total }. */
export function summariseSiteStatus(all, paddocks) {
  const out = { loading: 0, error: 0, ok: 0, total: paddocks.length * SOURCE_COUNT };
  for (const p of paddocks) for (const k of Object.keys(SOURCES)) {
    const s = all[p.id]?.[k];
    if (s === 'loading') out.loading++;
    else if (s === 'error') out.error++;
    else if (s === 'ok') out.ok++;
  }
  return out;
}
