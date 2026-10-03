// NASA HLS v2.0 (Harmonized Landsat Sentinel-2): 30 m surface reflectance every 2–3 days,
// from Landsat 8/9 (HLSL30) and Sentinel-2 A/B/C (HLSS30). Read through Microsoft Planetary
// Computer's public mirror, which needs no login and lets a browser fetch just the farm area.
//
// For each scene we ask the mirror to compute three layers over the farm's bounding box and
// return them as one small PNG: NDVI (greenness), NDYI (yellowness: canola flowers) and the
// HLS Fmask quality band (clouds, shadow, water).
import { pointInPolygon } from '../logic/geometry.js';

const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const DATA = 'https://planetarycomputer.microsoft.com/api/data/v1/item';
const NIR = { 'hls2-s30': 'B8A', 'hls2-l30': 'B05' }; // narrow NIR band in each product
const CACHE = 'sheeep-hls-v1';
export const HLS_SOURCE = 'NASA HLS v2.0 (Landsat 8/9 + Sentinel-2), via Microsoft Planetary Computer';

/** Bounding box [west, south, east, north] around all paddocks, padded by `bufferM` metres. */
export function farmBox(paddocks, bufferM = 1200) {
  const pts = paddocks.flatMap((p) => p.coords);
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const dLat = bufferM / 111320, dLng = bufferM / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const r = (v) => +v.toFixed(5);
  return [
    r(Math.min(...pts.map((p) => p[1])) - dLng),
    r(Math.min(...pts.map((p) => p[0])) - dLat),
    r(Math.max(...pts.map((p) => p[1])) + dLng),
    r(Math.max(...pts.map((p) => p[0])) + dLat),
  ];
}

/** All HLS scenes over the box between two dates (ISO), with less than `maxCloud` % cloud. */
export async function searchScenes(bbox, start, end, maxCloud = 40) {
  const out = [];
  for (const collection of Object.keys(NIR)) {
    let body = { collections: [collection], bbox, datetime: `${start}/${end}`, limit: 500, query: { 'eo:cloud_cover': { lt: maxCloud } } };
    for (let page = 0; page < 10 && body; page++) {
      const res = await fetch(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Satellite catalogue responded ${res.status}`);
      const json = await res.json();
      for (const f of json.features) {
        const [w, s, e, n] = f.bbox;
        out.push({
          collection,
          id: f.id,
          date: f.properties.datetime.slice(0, 10),
          cloud: f.properties['eo:cloud_cover'],
          covers: w <= bbox[0] && s <= bbox[1] && e >= bbox[2] && n >= bbox[3],
        });
      }
      const next = json.links?.find((l) => l.rel === 'next');
      body = next?.body ? { ...body, ...next.body } : null;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Keeps one scene per time window (the clearest that covers the whole farm), so we sample the
 * season evenly without downloading every pass. `windowDays(date)` sets the window length.
 */
export function thinScenes(scenes, windowDays) {
  const buckets = new Map();
  for (const s of scenes) {
    const day = Math.floor(Date.parse(s.date) / 86400000);
    const len = windowDays(s.date);
    const key = `${len}:${Math.floor(day / len)}`;
    const best = buckets.get(key);
    const better = !best || (s.covers && !best.covers) || (s.covers === best.covers && s.cloud < best.cloud);
    if (better) buckets.set(key, s);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// `size` = [width, height] puts every scene on the same pixel grid; otherwise `maxSize` bounds it.
function layersUrl(scene, bbox, { size, maxSize = 400 }) {
  const nir = NIR[scene.collection];
  const expr = encodeURIComponent(`(${nir}-B04)/(${nir}+B04);(B03-B02)/(B03+B02);Fmask`);
  const path = size ? `${bbox.join(',')}/${size[0]}x${size[1]}.png` : `${bbox.join(',')}.png`;
  const q = `collection=${scene.collection}&item=${scene.id}&expression=${expr}&asset_as_band=true&rescale=-1,1&rescale=-1,1&rescale=0,255`;
  return `${DATA}/bbox/${path}?${q}${size ? '' : `&max_size=${maxSize}`}`;
}

/** True-colour picture of an HLS scene; `size` = [width, height] in pixels (ground-shaped, ~30 m each). */
export function trueColourUrl(scene, bbox, [w, h]) {
  return `${DATA}/bbox/${bbox.join(',')}/${w}x${h}.png?collection=${scene.collection}&item=${scene.id}&assets=B04&assets=B03&assets=B02&rescale=0,1600`;
}

/**
 * HLS's Sentinel scenes (S30) are Sentinel-2 passes resampled to 30 m. For pictures we can use the
 * original 10 m Sentinel-2 L2A image of the same pass: same tile, same day → 3× sharper.
 */
export async function sentinel2Twin(scene, bbox) {
  if (scene.collection !== 'hls2-s30') return null;
  const tile = scene.id.split('.')[2]; // HLS.S30.T55HEB.2026213T001251.v2.0 → T55HEB
  const res = await fetch(STAC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['sentinel-2-l2a'], bbox, datetime: `${scene.date}T00:00:00Z/${scene.date}T23:59:59Z`, limit: 20 }),
  });
  if (!res.ok) return null;
  const item = (await res.json()).features?.find((f) => f.id.includes(`_${tile}_`));
  return item ? { id: item.id, date: scene.date, baseline: item.properties['s2:processing_baseline'] } : null;
}

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Does a STAC item's footprint (GeoJSON) contain the whole box? */
const coversBox = (geometry, [w, s, e, n]) => {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return [[w, s], [e, s], [e, n], [w, n]].every(([x, y]) => polys.some((p) => inRing(x, y, p[0])));
};

// Sentinel-2 scene classification: no data, defective, cloud shadow, cloud (medium, high), cirrus
const SCL_NOT_CLEAR = new Set([0, 1, 3, 8, 9, 10]);

/**
 * For pictures only: the Sentinel-2 L2A pass nearest to `date` (within `maxDays`) that is clear over
 * the box itself, judged from a small scene-classification image rather than the whole tile's cloud.
 */
export async function clearSentinel2Near(date, bbox, { maxDays = 12, decode = decodePng, getBlob = cachedBlob } = {}) {
  const t = Date.parse(date), day = 86400000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const res = await fetch(STAC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['sentinel-2-l2a'], bbox, datetime: `${iso(t - maxDays * day)}/${iso(t + maxDays * day)}T23:59:59Z`, limit: 100, query: { 'eo:cloud_cover': { lt: 60 } } }),
  });
  if (!res.ok) return null;
  const items = (await res.json()).features
    .filter((f) => coversBox(f.geometry, bbox))
    .map((f) => ({ id: f.id, date: f.properties.datetime.slice(0, 10), baseline: f.properties['s2:processing_baseline'] }))
    .sort((a, b) => Math.abs(Date.parse(a.date) - t) - Math.abs(Date.parse(b.date) - t));
  for (const item of items.slice(0, 5)) {
    const img = await decode(await getBlob(`${DATA}/bbox/${bbox.join(',')}/64x64.png?collection=sentinel-2-l2a&item=${item.id}&assets=SCL&rescale=0,255&resampling=nearest`));
    let bad = 0;
    for (let i = 0; i < img.rgba.length; i += 4) if (img.rgba[i + 3] === 0 || SCL_NOT_CLEAR.has(img.rgba[i])) bad++;
    if (bad / (img.rgba.length / 4) < 0.02) return item;
  }
  return null;
}

/** True-colour picture of a Sentinel-2 L2A item at 10 m; `size` = [width, height] (~10 m pixels). */
export function sentinel2Url(twin, bbox, [w, h]) {
  // from processing baseline 04.00 (Jan 2022) L2A reflectances carry a +1000 offset
  const rescale = parseFloat(twin.baseline) >= 4 ? '1000,2600' : '0,1600';
  return `${DATA}/bbox/${bbox.join(',')}/${w}x${h}.png?collection=sentinel-2-l2a&item=${twin.id}&assets=B04&assets=B03&assets=B02&rescale=${rescale}`;
}

async function cachedBlob(url) {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null;
  const hit = cache && (await cache.match(url));
  if (hit) return hit.blob();
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) {
        if (cache) await cache.put(url, res.clone()).catch(() => {});
        return res.blob();
      }
      if (attempt >= 2 || (res.status < 500 && res.status !== 429)) throw new Error(`Satellite image responded ${res.status}`);
    } catch (err) {
      if (attempt >= 2) throw err;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
}

/** Default PNG decoder (browser). Tests can pass their own. */
export async function decodePng(blob) {
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return { width: bmp.width, height: bmp.height, rgba: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
}

/**
 * How yellow the given pixels *look* in the true-colour picture: mean of (R+G)/2 − B on the
 * 0–255 scale. Canola in full bloom reflects strongly in red and green, which the flower index
 * (green vs blue, relative to the scene) under-rates late in the season when everything is green.
 */
export async function visibleYellow(scene, bbox, size, idx, { decode = decodePng, getBlob = cachedBlob } = {}) {
  const img = await decode(await getBlob(trueColourUrl(scene, bbox, size)));
  let sum = 0, n = 0;
  for (const i of idx) {
    const o = i * 4;
    if (img.rgba[o + 3] === 0) continue;
    sum += (img.rgba[o] + img.rgba[o + 1]) / 2 - img.rgba[o + 2];
    n++;
  }
  return n ? sum / n : -Infinity;
}

// Fmask bits: 1 cloud, 2 adjacent to cloud, 3 cloud shadow, 4 snow/ice, 5 water; 6–7 aerosol level.
const isClear = (f) => (f & 0b00111110) === 0 && ((f >> 6) & 3) !== 3;

/**
 * Fetches one scene's layers for the box.
 * @returns {{ width, height, ndvi: Float32Array, ndyi: Float32Array, clear: Uint8Array }}
 */
export async function fetchLayers(scene, bbox, { size, maxSize = 400, decode = decodePng, getBlob = cachedBlob } = {}) {
  const img = await decode(await getBlob(layersUrl(scene, bbox, { size, maxSize })));
  const n = img.width * img.height;
  const ndvi = new Float32Array(n), ndyi = new Float32Array(n), clear = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2], a = img.rgba[i * 4 + 3];
    ndvi[i] = (r / 255) * 2 - 1;
    ndyi[i] = (g / 255) * 2 - 1;
    clear[i] = a > 0 && isClear(b) ? 1 : 0;
  }
  return { width: img.width, height: img.height, ndvi, ndyi, clear };
}

/** Pixel indices whose centres fall inside each paddock (falls back to the nearest pixel for tiny ones). */
// Read a paddock from pixels lying wholly inside it when there are at least this many; edge pixels
// mix in fences, tracks and the neighbour's crop. On USDA fields this lifted crop-type accuracy
// from 62–73% to 78–79% (20–60 ha) and 68–88% to 85–93% (> 60 ha); see tools/validation.
export const MIN_PURE_PIXELS = 6;

/**
 * Pixels of each paddock on the grid: `all` (centre inside) and `read` (the ones to read the
 * paddock from: pure pixels, or all of them for small paddocks with too few pure ones).
 */
export function paddockPixels(paddocks, bbox, width, height) {
  const [w, s, e, n] = bbox;
  const lng = (i) => w + ((i + 0.5) / width) * (e - w);
  const lat = (j) => n - ((j + 0.5) / height) * (n - s);
  const dx = (e - w) / width / 2, dy = (n - s) / height / 2;
  const out = {};
  for (const p of paddocks) {
    const lats = p.coords.map((c) => c[0]), lngs = p.coords.map((c) => c[1]);
    const i0 = Math.max(0, Math.floor(((Math.min(...lngs) - w) / (e - w)) * width));
    const i1 = Math.min(width - 1, Math.ceil(((Math.max(...lngs) - w) / (e - w)) * width));
    const j0 = Math.max(0, Math.floor(((n - Math.max(...lats)) / (n - s)) * height));
    const j1 = Math.min(height - 1, Math.ceil(((n - Math.min(...lats)) / (n - s)) * height));
    const idx = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (pointInPolygon([lat(j), lng(i)], p.coords)) idx.push(j * width + i);
    if (!idx.length) idx.push(Math.round((j0 + j1) / 2) * width + Math.round((i0 + i1) / 2));
    // pure: all four corners of the pixel inside the paddock
    const pure = idx.filter((k) => {
      const cy = lat((k / width) | 0), cx = lng(k % width);
      return [[cy + dy, cx - dx], [cy + dy, cx + dx], [cy - dy, cx - dx], [cy - dy, cx + dx]].every((c) => pointInPolygon(c, p.coords));
    });
    out[p.id] = { all: idx, read: pure.length >= MIN_PURE_PIXELS ? pure : idx, pure: pure.length };
  }
  return out;
}

/** Median NDYI of clear, green pixels in a scene — the reference "ordinary crop" yellowness. */
export function sceneYellowBaseline(layers) {
  const vals = [];
  for (let i = 0; i < layers.ndvi.length; i++) if (layers.clear[i] && layers.ndvi[i] > 0.5) vals.push(layers.ndyi[i]);
  if (vals.length < 50) return null;
  vals.sort((a, b) => a - b);
  return vals[vals.length >> 1];
}

/** Mean NDVI and yellowness anomaly over a paddock's clear pixels, plus the clear fraction. */
export function paddockReading(layers, idx, baseline) {
  let n = 0, sv = 0, sy = 0;
  for (const i of idx) {
    if (!layers.clear[i]) continue;
    n++;
    sv += layers.ndvi[i];
    sy += layers.ndyi[i];
  }
  return {
    clear: n / idx.length,
    ndvi: n ? sv / n : null,
    yellow: n && baseline != null ? sy / n - baseline : null,
  };
}

/** Runs async jobs with limited concurrency, reporting progress. */
export async function pool(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let next = 0, done = 0;
  const run = async () => {
    while (next < items.length) {
      const k = next++;
      try {
        results[k] = await worker(items[k], k);
      } catch (err) {
        results[k] = { error: err };
      }
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
