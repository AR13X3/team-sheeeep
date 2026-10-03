import { useCallback, useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { analyseFarm, spaceKey } from '../services/space.js';

// One analysis at a time for the whole app, so it keeps running while you move between screens.
let running = null; // { key, promise }
let progress = { done: 0, total: 0, phase: '' };
let lastError = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l({ progress: { ...progress }, error: lastError, runningKey: running?.key ?? null }));

/**
 * Satellite history of the farm ("Paddock Memory from Space").
 * `result` is null until analysed; call `start()` to analyse (cached images make re-runs quick).
 */
export function useSpace() {
  const { state, dispatch } = useStore();
  const key = state.paddocks.length ? spaceKey(state.paddocks) : null;
  const result = key && state.space?.key === key ? state.space.result : null;
  const [snap, setSnap] = useState({ progress, error: lastError, runningKey: running?.key ?? null });

  useEffect(() => {
    listeners.add(setSnap);
    return () => listeners.delete(setSnap);
  }, []);

  const start = useCallback(() => {
    if (!key || result || running?.key === key) return;
    const paddocks = state.paddocks.map(({ id, name, coords }) => ({ id, name, coords }));
    lastError = null;
    progress = { done: 0, total: 0, phase: 'search' };
    const promise = analyseFarm(paddocks, {
      onProgress: (done, total, phase) => {
        progress = { done, total, phase };
        emit();
      },
    })
      .then((res) => dispatch({ type: 'setSpace', value: { key, result: res } }))
      .catch((err) => {
        console.warn('[space] analysis failed', err);
        lastError = err.message || String(err);
      })
      .finally(() => {
        if (running?.key === key) running = null;
        emit();
      });
    running = { key, promise };
    emit();
  }, [key, result, state.paddocks, dispatch]);

  return {
    result,
    running: !!key && snap.runningKey === key,
    progress: snap.progress,
    error: snap.error,
    start,
  };
}

/** The satellite record for one paddock, newest season first, mapped onto the history fields. */
export function paddockSpace(result, id) {
  const p = result?.paddocks?.[id];
  if (!p) return null;
  const seasons = [...p.seasons].reverse();
  return { pixels: p.pixels, seasons, byHistoryKey: { last: seasons[0], prev: seasons[1], prev2: seasons[2] } };
}
