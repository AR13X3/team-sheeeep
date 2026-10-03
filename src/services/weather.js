// 30 years of daily weather for the farm from NASA POWER (MERRA-2 based, ~50 km grid).
// https://power.larc.nasa.gov — free, no key. ~0.5 MB per request, cached in the browser.
const CACHE = 'sheeep-power-v1';

/**
 * @returns {Promise<{ days: string[], tmin: Float32Array, tmax: Float32Array, rain: Float32Array, source }>}
 *          days are 'YYYYMMDD'; missing values are NaN
 */
export async function fetchDailyWeather([lat, lng], { firstYear, lastYear } = {}) {
  const now = new Date();
  const last = lastYear ?? now.getFullYear() - 1;
  const first = firstYear ?? last - 29;
  const qs = new URLSearchParams({
    parameters: 'T2M_MIN,T2M_MAX,PRECTOTCORR',
    community: 'AG',
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    start: `${first}0101`,
    end: `${last}1231`,
    format: 'JSON',
  });
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?${qs}`;
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null;
  let res = cache && (await cache.match(url));
  if (!res) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
    if (cache) await cache.put(url, res.clone()).catch(() => {});
  }
  const json = await res.json();
  const p = json.properties.parameter;
  const days = Object.keys(p.T2M_MIN);
  const arr = (k) => Float32Array.from(days, (d) => (p[k][d] <= -998 ? NaN : p[k][d]));
  return { days, tmin: arr('T2M_MIN'), tmax: arr('T2M_MAX'), rain: arr('PRECTOTCORR'), source: 'NASA POWER daily (MERRA-2)' };
}

/** Rain (mm) between two month-days in each year, e.g. growing-season rain. */
export function seasonalRain(weather, fromMMDD, toMMDD) {
  const byYear = {};
  weather.days.forEach((d, i) => {
    const md = d.slice(4);
    if (md < fromMMDD || md > toMMDD || Number.isNaN(weather.rain[i])) return;
    const y = +d.slice(0, 4);
    byYear[y] = (byYear[y] || 0) + weather.rain[i];
  });
  return byYear;
}
