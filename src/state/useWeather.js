import { useEffect, useState } from 'react';
import { fetchDailyWeather } from '../services/weather.js';

// one request per farm location per session (the response is also kept in Cache Storage)
const memo = new Map();

/** 30 years of NASA POWER daily weather for a point; `null` until loaded. */
export function useWeather(point) {
  const key = point ? `${point[0].toFixed(2)},${point[1].toFixed(2)}` : null;
  const [state, setState] = useState(() => (key && memo.get(key)?.data) || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    if (!memo.has(key)) memo.set(key, { promise: fetchDailyWeather(point) });
    const entry = memo.get(key);
    entry.promise
      .then((data) => {
        entry.data = data;
        if (alive) setState(data);
      })
      .catch((err) => {
        memo.delete(key);
        if (alive) setError(err.message || String(err));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { weather: state, error };
}
