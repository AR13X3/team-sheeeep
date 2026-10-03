import { useEffect, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { interiorPoint } from '../logic/geometry.js';
import { fetchSoil } from '../services/soil.js';
import { fetchTerrain } from '../services/terrain.js';
import { fetchClimate } from '../services/climate.js';

// Soil and climate are sampled at a point guaranteed to be inside the paddock;
// slope is fitted across the whole paddock.
const SOURCES = {
  soil: (coords) => fetchSoil(interiorPoint(coords)),
  terrain: (coords) => fetchTerrain(coords),
  climate: (coords) => fetchClimate(interiorPoint(coords)),
};

/**
 * Fills paddock.site.{soil, terrain, climate} from the public data services the first
 * time a paddock is viewed. Returns a status per source: 'loading' | 'ok' | 'error'.
 */
export function useSiteData(paddock) {
  const { dispatch } = useStore();
  const [status, setStatus] = useState({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const id = paddock?.id;
  const coordsKey = paddock ? JSON.stringify(paddock.coords) : '';

  useEffect(() => {
    if (!paddock) return;
    const next = {};
    for (const [key, fetcher] of Object.entries(SOURCES)) {
      // terrain cached before the whole-paddock slope fit has no `samples`: fetch it again
      const stale = key === 'terrain' && paddock.site?.terrain && paddock.site.terrain.samples == null;
      if (paddock.site?.[key] !== undefined && !stale) {
        next[key] = 'ok';
        continue;
      }
      next[key] = 'loading';
      fetcher(paddock.coords)
        .then((value) => {
          // Store even if the screen was left — the data belongs to the paddock.
          dispatch({ type: 'updatePaddock', id, patch: (p) => ({ site: { ...p.site, [key]: value } }) });
          if (mounted.current) setStatus((s) => ({ ...s, [key]: 'ok' }));
        })
        .catch((err) => {
          console.warn(`[site data] ${key} failed`, err);
          if (mounted.current) setStatus((s) => ({ ...s, [key]: 'error' }));
        });
    }
    setStatus(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, coordsKey]);

  return status;
}
