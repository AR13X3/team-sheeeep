// Fetch helpers: localStorage cache + optional per-host request spacing and 429 back-off.
const CACHE_PREFIX = 'sheeep:cache:';
const DAY = 24 * 60 * 60 * 1000;

function readCache(key, maxAge) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
    if (hit && Date.now() - hit.t < maxAge) return hit.v;
  } catch {
    /* ignore */
  }
  return undefined;
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* quota exceeded: skip caching */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queues = new Map(); // host -> promise chain
const inFlight = new Map(); // url -> promise (de-duplicates concurrent identical requests)

/**
 * GET JSON with caching. `spacingMs` serialises requests to the same host
 * (SoilGrids asks for at most ~5 requests/minute).
 */
export async function getJSON(url, options = {}) {
  const { cacheKey, maxAge = 30 * DAY } = options;
  if (cacheKey) {
    const hit = readCache(cacheKey, maxAge);
    if (hit !== undefined) return hit;
  }
  if (!inFlight.has(url)) {
    inFlight.set(url, request(url, options).finally(() => inFlight.delete(url)));
  }
  return inFlight.get(url);
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error(`${new URL(url).host} timed out`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function request(url, { cacheKey, spacingMs = 0, retries = 3, timeoutMs = 20000 }) {
  const host = new URL(url).host;
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 15;
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`${host} responded ${res.status}`);
      return res.json();
    }
  };
  let result;
  if (spacingMs) {
    const prev = queues.get(host) || Promise.resolve();
    const job = prev.catch(() => {}).then(run);
    queues.set(host, job.catch(() => {}).then(() => sleep(spacingMs)));
    result = await job;
  } else {
    result = await run();
  }
  if (cacheKey) writeCache(cacheKey, result);
  return result;
}

export const round = (v, dp = 4) => Number(v).toFixed(dp);
