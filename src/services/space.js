// "Paddock Memory from Space": reads ~5 seasons of NASA HLS images over the whole farm (plus a
// 1.2 km border) and works out, for every paddock and season, what grew there — and where
// canola flowered around the farm last season (blackleg spores spread from its stubble).
import { farmBox, searchScenes, thinScenes, fetchLayers, paddockPixels, sceneYellowBaseline, paddockReading, pool, trueColourUrl, sentinel2Twin, sentinel2Url, clearSentinel2Near, visibleYellow, HLS_SOURCE } from './hls.js';
import { classifySeason, detectCanolaPixels, seasonWindow } from '../logic/phenology.js';
import { offset } from '../logic/geometry.js';

export const SEASONS_BACK = 5;
const PIXEL_M = 30;
const DAY = 86400000;

/** Season years to analyse: the current (or latest) season and the ones before it. */
export function seasonYears(lat, today = new Date(), count = SEASONS_BACK) {
  const y = today.getFullYear();
  const startedThisYear = today >= new Date(seasonWindow(y, lat).start);
  const latest = startedThisYear ? y : y - 1;
  return Array.from({ length: count }, (_, i) => latest - (count - 1) + i);
}

/** Stable key for a set of paddock outlines (re-analyse when they change). */
export function spaceKey(paddocks) {
  const s = paddocks.map((p) => `${p.id}:${p.coords.map((c) => c.map((v) => v.toFixed(5)).join(',')).join(';')}`).join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `v7-${(h >>> 0).toString(36)}`; // v6: pure-pixel readings, 10 m pictures
}

// metres-per-degree helpers around a latitude
function metric(lat) {
  const north = 1 / (offset([lat, 0], 0, 1)[0] - lat);
  const east = 1 / (offset([lat, 0], 1, 0)[1]);
  return { north, east };
}

function distanceToPolygonM(pt, coords, m) {
  let best = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i], b = coords[(i + 1) % coords.length];
    const ax = (a[1] - pt[1]) * m.east, ay = (a[0] - pt[0]) * m.north;
    const bx = (b[1] - pt[1]) * m.east, by = (b[0] - pt[0]) * m.north;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + u * dx, ay + u * dy));
  }
  return best;
}

/** Yellow, semi-transparent PNG of the canola pixels (browser only). */
function maskToDataUrl(mask, width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    img.data.set([238, 196, 40, 210], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * @param paddocks [{ id, name, coords }]
 * @param opts { today, onProgress(done, total, phase), fetchOptions }
 */
export async function analyseFarm(paddocks, { today = new Date(), onProgress, fetchOptions = {} } = {}) {
  const lat = paddocks.flatMap((p) => p.coords).reduce((s, c, _, a) => s + c[0] / a.length, 0);
  const bbox = farmBox(paddocks, 1200);
  const m = metric(lat);
  const width = Math.min(420, Math.max(16, Math.round(((bbox[2] - bbox[0]) * m.east) / PIXEL_M)));
  const height = Math.min(420, Math.max(16, Math.round(((bbox[3] - bbox[1]) * m.north) / PIXEL_M)));
  const years = seasonYears(lat, today);
  const windows = years.map((y) => ({ year: y, ...seasonWindow(y, lat) }));

  onProgress?.(0, 1, 'search');
  const end = new Date(Math.min(Date.parse(windows.at(-1).end), today.getTime())).toISOString().slice(0, 10);
  const found = await searchScenes(bbox, windows[0].start, end, 40);
  const inSeason = (d) => windows.find((w) => d >= w.start && d <= w.end);
  const inFlowering = (d) => windows.some((w) => d >= w.flowering[0] && d <= w.flowering[1]);
  const scenes = thinScenes(found.filter((s) => inSeason(s.date)), (d) => (inFlowering(d) ? 8 : 16));

  const results = await pool(
    scenes,
    6,
    async (scene) => {
      const layers = await fetchLayers(scene, bbox, { ...fetchOptions, size: [width, height] });
      return { scene, layers, baseline: sceneYellowBaseline(layers) };
    },
    (done, total) => onProgress?.(done, total, 'images'),
  );
  const ok = results.filter((r) => r && !r.error && r.layers.width === width && r.layers.height === height);
  if (!ok.length) throw new Error('No usable satellite images for this farm');

  const pix = paddockPixels(paddocks, bbox, width, height);
  const out = {};
  for (const p of paddocks) {
    const obs = ok.map((r) => ({ date: r.scene.date, ...paddockReading(r.layers, pix[p.id].read, r.baseline) }));
    out[p.id] = {
      pixels: pix[p.id].read.length,
      purePixels: pix[p.id].read !== pix[p.id].all,
      seasons: windows.map((w) => ({ year: w.year, ...classifySeason(obs, w, { today }) })),
    };
  }

  // Canola around the farm in the latest season whose flowering has been observed.
  let canola = null;
  for (const w of [...windows].reverse()) {
    const fl = ok.filter((r) => r.scene.date >= w.flowering[0] && r.scene.date <= w.flowering[1]);
    if (fl.length < 2) continue;
    const det = detectCanolaPixels(fl, width, height);
    const pxLat = (j) => bbox[3] - ((j + 0.5) / height) * (bbox[3] - bbox[1]);
    const pxLng = (i) => bbox[0] + ((i + 0.5) / width) * (bbox[2] - bbox[0]);
    const nearest = {}, nearbyHa = {};
    for (const p of paddocks) {
      // a patch that mostly lies in this paddock is the paddock's own canola, not a neighbour's
      const own = new Set(pix[p.id].all); // the paddock's own canola isn't a neighbour's
      const skip = new Set();
      for (const patch of det.patches) {
        const inside = patch.cells.filter((c) => own.has(c)).length;
        if (inside / patch.cells.length > 0.3 || inside / own.size > 0.3) for (const c of patch.cells) skip.add(c);
      }
      let best = Infinity, area = 0;
      for (let k = 0; k < det.mask.length; k++) {
        if (!det.mask[k] || own.has(k) || skip.has(k)) continue;
        const d = distanceToPolygonM([pxLat((k / width) | 0), pxLng(k % width)], p.coords, m);
        if (d < best) best = d;
        if (d <= 1000) area += (PIXEL_M * PIXEL_M) / 10000;
      }
      nearest[p.id] = Number.isFinite(best) ? Math.round(best) : null;
      nearbyHa[p.id] = Math.round(area);
    }
    const totalHa = Math.round((det.mask.reduce((a, b) => a + b, 0) * PIXEL_M * PIXEL_M) / 10000);
    // The picture where the detected canola looks most in flower: shortlist by the flower index,
    // then measure how yellow the canola actually looks in each true-colour picture. A Sentinel
    // pass (shown at 10 m, 9× the detail) wins if it looks at least ~83% as yellow as a Landsat one.
    const shortlist = fl
      .filter((r) => r.scene.cloud < 15 && r.baseline != null)
      .map((r) => {
        let k = 0;
        for (let i = 0; i < det.mask.length; i++) if (det.mask[i] && r.layers.clear[i]) k += Math.max(0, r.layers.ndyi[i] - r.baseline - 0.05);
        return { r, k };
      })
      .sort((a, b) => b.k - a.k)
      .slice(0, 4);
    const looks = await Promise.all(
      shortlist.map(async ({ r }) => {
        const idx = [];
        for (let i = 0; i < det.mask.length; i++) if (det.mask[i] && r.layers.clear[i]) idx.push(i);
        const yellow = idx.length < 20 ? -Infinity : await visibleYellow(r.scene, bbox, [width, height], idx, fetchOptions).catch(() => -Infinity);
        return { r, score: yellow * (r.scene.collection === 'hls2-s30' ? 1.2 : 1) };
      }),
    );
    looks.sort((a, b) => b.score - a.score);
    const flowerPick = looks[0]?.r;
    canola = { year: w.year, looks: fl.length, patches: det.patches.length, totalHa, nearest, nearbyHa, overlay: maskToDataUrl(det.mask, width, height), flowerScene: flowerPick?.scene };
    break;
  }

  // Time-lapse: the clearest image near each season's peak, plus a flowering-time image.
  // Pictures use 10 m Sentinel-2: the same pass for Sentinel scenes, or for Landsat scenes the
  // nearest pass that is clear over the farm (pictures only; the analysis keeps NASA HLS).
  const ground = [(bbox[2] - bbox[0]) * m.east, (bbox[3] - bbox[1]) * m.north];
  const sizeAt = (metres) => ground.map((g) => Math.max(16, Math.min(1200, Math.round(g / metres))));
  const picture = async (scene, maxDays) => {
    const twin = (await sentinel2Twin(scene, bbox).catch(() => null)) || (await clearSentinel2Near(scene.date, bbox, { ...fetchOptions, maxDays }).catch(() => null));
    if (twin) return { url: sentinel2Url(twin, bbox, sizeAt(10)), sensor: 'Sentinel-2', metres: 10, date: twin.date };
    return { url: trueColourUrl(scene, bbox, sizeAt(30)), sensor: scene.collection === 'hls2-l30' ? 'Landsat' : 'Sentinel-2', metres: 30 };
  };
  const peakGap = (scene, target) => Math.abs(Date.parse(scene.date) - target) + (scene.collection === 'hls2-s30' ? 0 : 10 * DAY);
  const frames = [];
  for (const w of windows) {
    const peaks = Object.values(out).map((o) => o.seasons.find((s) => s.year === w.year)?.peakDate).filter(Boolean).sort();
    const target = peaks.length ? Date.parse(peaks[peaks.length >> 1]) : Date.parse(w.flowering[0]);
    const pick = ok
      .filter((r) => r.scene.date >= w.start && r.scene.date <= w.end && r.scene.cloud < 15)
      // nearest to the season's peak; Landsat counts as 10 days further away, since only
      // Sentinel passes can be shown at 10 m
      .sort((a, b) => peakGap(a.scene, target) - peakGap(b.scene, target))[0];
    if (pick) frames.push({ year: w.year, date: pick.scene.date, scene: pick.scene, kind: 'peak' });
  }
  if (canola?.flowerScene) {
    const s = canola.flowerScene;
    const same = frames.find((f) => f.date === s.date); // one picture can be both
    if (same) same.kind = 'flowering';
    else frames.push({ year: canola.year, date: s.date, scene: s, kind: 'flowering' });
    delete canola.flowerScene;
  }
  frames.sort((a, b) => a.date.localeCompare(b.date));
  await Promise.all(
    frames.map(async (f) => {
      // a flowering picture must stay close in time to still show the flowers
      Object.assign(f, await picture(f.scene, f.kind === 'flowering' ? 5 : 12));
      delete f.scene;
    }),
  );

  return {
    analysedAt: today.toISOString(),
    source: HLS_SOURCE,
    bbox,
    width,
    height,
    looks: ok.length,
    years,
    paddocks: out,
    canola,
    frames,
    lat,
  };
}

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
