// Checks the "Paddock Memory from Space" classifier against independent ground truth:
// the USDA Cropland Data Layer (CDL), which maps what was grown in every 30 m pixel of the US.
//
//   npm run validate:phenology
//
// Region: canola country in Cavalier County, North Dakota. Seasons 2021 and 2020.
// Each homogeneous 5×5-pixel block of the CDL (150 m) is treated as a small paddock; the app's
// own code (src/services/hls.js + src/logic/phenology.js) classifies it from NASA HLS images,
// and we compare with what the CDL says was grown. Images are cached in tools/validation/.cache.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { searchScenes, thinScenes, sceneYellowBaseline, paddockReading, pool } from '../../src/services/hls.js';
import { classifySeason, seasonWindow, detectCanolaPixels } from '../../src/logic/phenology.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
const DATA = 'https://planetarycomputer.microsoft.com/api/data/v1/item';
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const BBOX = [-98.62, 48.7, -98.4, 48.84];
const LAT = 48.77;
const W = 520;
const H = Math.round(W * ((BBOX[3] - BBOX[1]) / ((BBOX[2] - BBOX[0]) * Math.cos((LAT * Math.PI) / 180))));
const YEARS = [2021, 2020];

const FAMILY = { 31: 'oilseed', 23: 'cereal', 24: 'cereal', 21: 'cereal', 28: 'cereal', 22: 'cereal', 205: 'cereal', 53: 'pulse', 52: 'pulse', 42: 'pulse', 51: 'pulse', 176: 'pasture', 37: 'pasture', 36: 'pasture', 61: 'fallow', 1: 'summer', 5: 'summer', 6: 'summer', 41: 'summer' };
const NAME = { 31: 'canola', 23: 'spring wheat', 24: 'winter wheat', 21: 'barley', 28: 'oats', 22: 'durum', 53: 'peas', 52: 'lentils', 42: 'dry beans', 51: 'chickpeas', 176: 'grass/pasture', 37: 'other hay', 36: 'alfalfa', 61: 'fallow', 1: 'corn', 5: 'soybeans', 6: 'sunflower', 41: 'sugarbeets' };

async function png(url) {
  const file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex') + '.png');
  if (fs.existsSync(file)) return PNG.sync.read(fs.readFileSync(file));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return PNG.sync.read(buf);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`fetch failed: ${url}`);
}

async function season(year) {
  // ground truth
  const stac = await (await fetch(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['usda-cdl'], bbox: BBOX, datetime: `${year}-01-01/${year}-12-31`, limit: 10 }) })).json();
  const item = stac.features.find((f) => f.assets.cropland);
  const truth = await png(`${DATA}/bbox/${BBOX.join(',')}/${W}x${H}.png?collection=usda-cdl&item=${item.id}&assets=cropland&rescale=0,255&resampling=nearest`);
  const cdl = Uint8Array.from({ length: W * H }, (_, i) => truth.data[i * 4]);
  const blocks = [];
  for (let y = 0; y + 5 <= H; y += 5)
    for (let x = 0; x + 5 <= W; x += 5) {
      const counts = {}, idx = [];
      for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) { const k = (y + dy) * W + x + dx; idx.push(k); counts[cdl[k]] = (counts[cdl[k]] || 0) + 1; }
      const [cls, c] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (c >= 23 && FAMILY[cls]) blocks.push({ cls: +cls, family: FAMILY[cls], idx });
    }
  // NASA HLS images, exactly as the app requests them
  const win = seasonWindow(year, LAT);
  const scenes = thinScenes(await searchScenes(BBOX, win.start, win.end, 40), (d) => (d >= win.flowering[0] && d <= win.flowering[1] ? 6 : 12));
  const layers = (
    await pool(scenes, 6, async (s) => {
      const nir = s.collection === 'hls2-s30' ? 'B8A' : 'B05';
      const expr = encodeURIComponent(`(${nir}-B04)/(${nir}+B04);(B03-B02)/(B03+B02);Fmask`);
      const img = await png(`${DATA}/bbox/${BBOX.join(',')}/${W}x${H}.png?collection=${s.collection}&item=${s.id}&expression=${expr}&asset_as_band=true&rescale=-1,1&rescale=-1,1&rescale=0,255`);
      const n = W * H, ndvi = new Float32Array(n), ndyi = new Float32Array(n), clear = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const f = img.data[i * 4 + 2];
        ndvi[i] = (img.data[i * 4] / 255) * 2 - 1;
        ndyi[i] = (img.data[i * 4 + 1] / 255) * 2 - 1;
        clear[i] = img.data[i * 4 + 3] > 0 && (f & 0b00111110) === 0 && ((f >> 6) & 3) !== 3 ? 1 : 0;
      }
      const L = { width: W, height: H, ndvi, ndyi, clear };
      return { scene: s, layers: L, baseline: sceneYellowBaseline(L) };
    })
  ).filter((l) => !l.error);
  return { year, win, cdl, blocks, layers };
}

for (const year of YEARS) {
  process.stdout.write(`\n${year}: loading CDL + NASA HLS… `);
  const d = await season(year);
  console.log(`${d.blocks.length} field blocks, ${d.layers.length} HLS images`);
  let tp = 0, fp = 0, fn = 0, right = 0, total = 0;
  const per = {};
  for (const b of d.blocks) {
    const obs = d.layers.map((l) => ({ date: l.scene.date, ...paddockReading(l.layers, b.idx, l.baseline) }));
    const got = classifySeason(obs, d.win, { today: new Date('2030-01-01') }).family || 'unknown';
    if (b.cls === 31) got === 'oilseed' ? tp++ : fn++;
    else if (got === 'oilseed') fp++;
    if (b.family !== 'summer') (total++, got === b.family && right++);
    (per[b.cls] ||= {})[got] = (per[b.cls][got] || 0) + 1;
  }
  console.log(`  canola: found ${(100 * tp / (tp + fn)).toFixed(1)}% (recall), right when called ${(100 * tp / (tp + fp)).toFixed(1)}% (precision)`);
  console.log(`  crop family accuracy (cereal/canola/pulse/pasture/fallow): ${(100 * right / total).toFixed(1)}%`);
  for (const [c, m] of Object.entries(per)) {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    if (tot >= 10) console.log(`    ${(NAME[c] || c).padEnd(14)} n=${String(tot).padEnd(5)} → ${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`).join(', ')}`);
  }
  const fl = d.layers.filter((l) => l.scene.date >= d.win.flowering[0] && l.scene.date <= d.win.flowering[1]);
  const det = detectCanolaPixels(fl, W, H);
  let ptp = 0, pfp = 0, pfn = 0;
  for (let i = 0; i < W * H; i++) { const t = d.cdl[i] === 31; if (det.mask[i] && t) ptp++; else if (det.mask[i]) pfp++; else if (t) pfn++; }
  console.log(`  canola map around the farm (pixels): precision ${(100 * ptp / (ptp + pfp)).toFixed(1)}%, recall ${(100 * ptp / (ptp + pfn)).toFixed(1)}%`);
}
