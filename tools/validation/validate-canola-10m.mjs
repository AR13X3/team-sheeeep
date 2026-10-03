// Neighbour-canola map: NASA HLS at 30 m (current) vs Sentinel-2 L2A at 10 m.
//
//   node tools/validation/validate-canola-10m.mjs
//
// Both maps come from the app's own detector (logic/phenology.js → detectCanolaPixels) using the
// flowering-window images of each source, and are scored against USDA Cropland Data Layer canola
// on a common 10 m grid. The CDL is itself 30 m, so pixels within 30 m of a crop boundary are
// left out ("interiors"); scores on every pixel are shown too, for reference.
import { searchScenes, thinScenes, sceneYellowBaseline, pool } from '../../src/services/hls.js';
import { detectCanolaPixels, seasonWindow } from '../../src/logic/phenology.js';
import { DATA, LAT, gridFor, png, stac, cdl, hlsSeason } from './common.mjs';

// central 8 × 8 km of the North Dakota validation area (keeps the 10 m downloads reasonable)
const SUB = [-98.565, 48.734, -98.455, 48.806];
const G30 = gridFor(SUB, 30), G10 = gridFor(SUB, 10);
const MIN_HA = 1.35; // smallest canola patch kept (15 pixels at 30 m)

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const covers = (geom, b) => {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].every(([x, y]) => polys.some((p) => inRing(x, y, p[0])));
};

/** Sentinel-2 L2A flowering-window layers at 10 m (NDVI, NDYI, scene classification → clear). */
async function s2Flowering(year, bbox, [W, H]) {
  const win = seasonWindow(year, LAT);
  const found = [];
  let body = { collections: ['sentinel-2-l2a'], bbox, datetime: `${win.flowering[0]}/${win.flowering[1]}`, limit: 200, query: { 'eo:cloud_cover': { lt: 40 } } };
  for (let page = 0; page < 5 && body; page++) {
    const json = await stac(body);
    for (const f of json.features) found.push({ id: f.id, date: f.properties.datetime.slice(0, 10), cloud: f.properties['eo:cloud_cover'], covers: covers(f.geometry, bbox), baseline: parseFloat(f.properties['s2:processing_baseline']) });
    const next = json.links?.find((l) => l.rel === 'next');
    body = next?.body ? { ...body, ...next.body } : null;
  }
  const scenes = thinScenes(found.filter((s) => s.covers), () => 6);
  const layers = (
    await pool(scenes, 4, async (s) => {
      const off = s.baseline >= 4 ? 1000 : 0; // L2A offset from processing baseline 04.00
      const expr = encodeURIComponent(`(B08-B04)/(B08+B04-${2 * off});(B03-B02)/(B03+B02-${2 * off});SCL`);
      const img = await png(`${DATA}/bbox/${bbox.join(',')}/${W}x${H}.png?collection=sentinel-2-l2a&item=${s.id}&expression=${expr}&asset_as_band=true&rescale=-1,1&rescale=-1,1&rescale=0,255`);
      const n = W * H, ndvi = new Float32Array(n), ndyi = new Float32Array(n), clear = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const scl = img.data[i * 4 + 2];
        ndvi[i] = (img.data[i * 4] / 255) * 2 - 1;
        ndyi[i] = (img.data[i * 4 + 1] / 255) * 2 - 1;
        clear[i] = img.data[i * 4 + 3] > 0 && (scl === 4 || scl === 5) ? 1 : 0; // vegetation or bare soil
      }
      const L = { width: W, height: H, ndvi, ndyi, clear };
      return { scene: { ...s, collection: 'sentinel-2-l2a' }, layers: L, baseline: sceneYellowBaseline(L) };
    })
  ).filter((l) => l && !l.error);
  return { win, layers };
}

function score(mask, at, truth, interior) {
  const r = { all: [0, 0, 0], inner: [0, 0, 0] }; // tp, fp, fn
  for (let i = 0; i < truth.length; i++) {
    const t = truth[i] === 31, p = mask[at(i)] === 1;
    for (const k of interior[i] ? ['all', 'inner'] : ['all']) {
      if (p && t) r[k][0]++;
      else if (p) r[k][1]++;
      else if (t) r[k][2]++;
    }
  }
  const f = ([tp, fp, fn]) => `precision ${((100 * tp) / (tp + fp)).toFixed(1)}%  recall ${((100 * tp) / (tp + fn)).toFixed(1)}%`;
  return { inner: f(r.inner), all: f(r.all) };
}

console.log(`area ${SUB.join(', ')} · grids 30 m ${G30.join('×')}, 10 m ${G10.join('×')}`);
for (const year of [2021, 2020]) {
  const truth = await cdl(year, SUB, G10);
  const [W, H] = G10;
  // interior: no other crop code within 3 pixels (30 m)
  const interior = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ok = true;
      for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3 && ok; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || truth[yy * W + xx] !== truth[y * W + x]) ok = false;
      }
      interior[y * W + x] = ok ? 1 : 0;
    }

  const hls = await hlsSeason(year, SUB, G30);
  const hlsFl = hls.layers.filter((l) => l.scene.date >= hls.win.flowering[0] && l.scene.date <= hls.win.flowering[1]);
  const m30 = detectCanolaPixels(hlsFl, G30[0], G30[1], { minPixels: Math.round((MIN_HA * 10000) / 900) }).mask;
  const at30 = (i) => Math.min(G30[1] - 1, Math.floor((((i / W) | 0) * G30[1]) / H)) * G30[0] + Math.min(G30[0] - 1, Math.floor(((i % W) * G30[0]) / W));

  const s2 = await s2Flowering(year, SUB, G10);
  const m10 = detectCanolaPixels(s2.layers, W, H, { minPixels: Math.round((MIN_HA * 10000) / 100) }).mask;

  const a = score(m30, at30, truth, interior), b = score(m10, (i) => i, truth, interior);
  console.log(`\n${year}: HLS flowering looks ${hlsFl.length} (Landsat + Sentinel) · Sentinel-2 flowering looks ${s2.layers.length}`);
  console.log(`  HLS 30 m        interiors: ${a.inner}   | every pixel: ${a.all}`);
  console.log(`  Sentinel-2 10 m interiors: ${b.inner}   | every pixel: ${b.all}`);
}
