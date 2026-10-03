// Shared by the validation scripts: USDA Cropland Data Layer (ground truth) + NASA HLS layers for a
// region, fetched exactly as the app fetches them, and cached in tools/validation/.cache.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { searchScenes, thinScenes, sceneYellowBaseline, pool } from '../../src/services/hls.js';
import { seasonWindow } from '../../src/logic/phenology.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
export const DATA = 'https://planetarycomputer.microsoft.com/api/data/v1/item';
export const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';

// Canola country in Cavalier County, North Dakota
export const BBOX = [-98.62, 48.7, -98.4, 48.84];
export const LAT = 48.77;

export const FAMILY = { 31: 'oilseed', 23: 'cereal', 24: 'cereal', 21: 'cereal', 28: 'cereal', 22: 'cereal', 205: 'cereal', 53: 'pulse', 52: 'pulse', 42: 'pulse', 51: 'pulse', 176: 'pasture', 37: 'pasture', 36: 'pasture', 61: 'fallow', 1: 'summer', 5: 'summer', 6: 'summer', 41: 'summer' };
export const NAME = { 31: 'canola', 23: 'spring wheat', 24: 'winter wheat', 21: 'barley', 28: 'oats', 22: 'durum', 53: 'peas', 52: 'lentils', 42: 'dry beans', 51: 'chickpeas', 176: 'grass/pasture', 37: 'other hay', 36: 'alfalfa', 61: 'fallow', 1: 'corn', 5: 'soybeans', 6: 'sunflower', 41: 'sugarbeets' };

/** Grid size for a box at a pixel size in metres (ground-shaped). */
export function gridFor(bbox, metres) {
  const kx = Math.cos((((bbox[1] + bbox[3]) / 2) * Math.PI) / 180);
  return [Math.round(((bbox[2] - bbox[0]) * 111320 * kx) / metres), Math.round(((bbox[3] - bbox[1]) * 111320) / metres)];
}

/** Fetches a PNG (with retries) and caches it by URL. */
export async function png(url) {
  const file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex') + '.png');
  if (fs.existsSync(file)) return PNG.sync.read(fs.readFileSync(file));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(file, buf);
        return PNG.sync.read(buf);
      }
    } catch {
      /* network hiccup: retry */
    }
    await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
  }
  throw new Error(`fetch failed: ${url}`);
}

export async function stac(body) {
  const res = await fetch(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

/** USDA CDL crop codes for the box, one per pixel. */
export async function cdl(year, bbox, [W, H]) {
  const items = await stac({ collections: ['usda-cdl'], bbox, datetime: `${year}-01-01/${year}-12-31`, limit: 10 });
  const item = items.features.find((f) => f.assets.cropland);
  const img = await png(`${DATA}/bbox/${bbox.join(',')}/${W}x${H}.png?collection=usda-cdl&item=${item.id}&assets=cropland&rescale=0,255&resampling=nearest`);
  return Uint8Array.from({ length: W * H }, (_, i) => img.data[i * 4]);
}

/** NASA HLS layers for a season, exactly as the app requests them (NDVI, NDYI, Fmask → clear). */
export async function hlsSeason(year, bbox, [W, H]) {
  const win = seasonWindow(year, LAT);
  const scenes = thinScenes(await searchScenes(bbox, win.start, win.end, 40), (d) => (d >= win.flowering[0] && d <= win.flowering[1] ? 6 : 12));
  const layers = (
    await pool(scenes, 6, async (s) => {
      const nir = s.collection === 'hls2-s30' ? 'B8A' : 'B05';
      const expr = encodeURIComponent(`(${nir}-B04)/(${nir}+B04);(B03-B02)/(B03+B02);Fmask`);
      const img = await png(`${DATA}/bbox/${bbox.join(',')}/${W}x${H}.png?collection=${s.collection}&item=${s.id}&expression=${expr}&asset_as_band=true&rescale=-1,1&rescale=-1,1&rescale=0,255`);
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
  ).filter((l) => l && !l.error);
  return { win, layers };
}

/** Same-crop fields: 4-connected patches of one CDL code (adjacent same-crop paddocks merge). */
export function fields(codes, W, H, minPixels = 4) {
  const label = new Int32Array(W * H).fill(-1);
  const out = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || !FAMILY[codes[start]]) continue;
    const code = codes[start], idx = [], stack = [start];
    label[start] = out.length;
    while (stack.length) {
      const k = stack.pop();
      idx.push(k);
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || label[nk] !== -1 || codes[nk] !== code) continue;
        label[nk] = out.length;
        stack.push(nk);
      }
    }
    out.push({ code, family: FAMILY[code], idx });
  }
  // interior = pixels whose 8 neighbours are all in the same field (the pixel lies fully inside it)
  for (const f of out) {
    const me = label[f.idx[0]];
    f.interior = f.idx.filter((k) => {
      const x = k % W, y = (k / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || label[ny * W + nx] !== me) return false;
      }
      return true;
    });
  }
  return out.filter((f) => f.idx.length >= minPixels);
}
