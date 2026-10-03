// Does reading a paddock from only the pixels fully inside it ("pure pixels") beat using every
// pixel whose centre falls inside? Edge pixels mix in fences, tracks and the neighbour's crop.
//
//   node tools/validation/validate-paddock-pixels.mjs
//
// Fields are whole same-crop patches of the USDA Cropland Data Layer (North Dakota), so they have
// real edges like a farmer's paddock. Each field is classified by the app's own code twice:
// from all its pixels, and from its interior pixels only (falling back to all when < MIN_PURE).
import { classifySeason } from '../../src/logic/phenology.js';
import { paddockReading } from '../../src/services/hls.js';
import { BBOX, LAT, gridFor, cdl, hlsSeason, fields } from './common.mjs';

const MIN_PURE = 6;
// same grid as validate-phenology.mjs (so cached images are reused): 520 px across ≈ 31 m pixels
const W = 520;
const H = Math.round(W * ((BBOX[3] - BBOX[1]) / ((BBOX[2] - BBOX[0]) * Math.cos((LAT * Math.PI) / 180))));
const PX_HA = (gridFor(BBOX, 1)[0] / W) ** 2 / 10000;
const BINS = [['< 5 ha', 0, 5], ['5–20 ha', 5, 20], ['20–60 ha', 20, 60], ['> 60 ha', 60, Infinity]];

for (const year of [2021, 2020]) {
  const codes = await cdl(year, BBOX, [W, H]);
  const { win, layers } = await hlsSeason(year, BBOX, [W, H]);
  const all = fields(codes, W, H).filter((f) => f.family !== 'summer');
  console.log(`\n${year}: ${all.length} fields (winter crops, pasture, fallow), ${layers.length} HLS images, pixel ≈ ${(PX_HA * 10000) ** 0.5 | 0} m`);
  const classify = (idx) => classifySeason(layers.map((l) => ({ date: l.scene.date, ...paddockReading(l.layers, idx, l.baseline) })), win, { today: new Date('2030-01-01') }).family;
  const rows = BINS.map(([label]) => ({ label, n: 0, allOk: 0, pureOk: 0, fallback: 0 }));
  const canola = { all: { tp: 0, fp: 0, fn: 0 }, pure: { tp: 0, fp: 0, fn: 0 } };
  for (const f of all) {
    const ha = f.idx.length * PX_HA;
    const bin = rows[BINS.findIndex(([, lo, hi]) => ha >= lo && ha < hi)];
    const usePure = f.interior.length >= MIN_PURE;
    const a = classify(f.idx);
    const p = usePure ? classify(f.interior) : a;
    bin.n++;
    if (!usePure) bin.fallback++;
    if (a === f.family) bin.allOk++;
    if (p === f.family) bin.pureOk++;
    for (const [k, got] of [['all', a], ['pure', p]]) {
      if (f.code === 31) got === 'oilseed' ? canola[k].tp++ : canola[k].fn++;
      else if (got === 'oilseed') canola[k].fp++;
    }
  }
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1).padStart(5) + '%' : '    –');
  console.log('  field size   fields   all pixels   pure pixels   (pure fell back to all)');
  for (const r of rows) console.log(`  ${r.label.padEnd(10)} ${String(r.n).padStart(6)}   ${pct(r.allOk, r.n)}       ${pct(r.pureOk, r.n)}        ${r.fallback}`);
  const tot = rows.reduce((t, r) => ({ n: t.n + r.n, a: t.a + r.allOk, p: t.p + r.pureOk }), { n: 0, a: 0, p: 0 });
  console.log(`  ${'all fields'.padEnd(10)} ${String(tot.n).padStart(6)}   ${pct(tot.a, tot.n)}       ${pct(tot.p, tot.n)}`);
  for (const k of ['all', 'pure']) {
    const c = canola[k];
    console.log(`  canola (${k.padEnd(4)}): found ${pct(c.tp, c.tp + c.fn)}, right when called ${pct(c.tp, c.tp + c.fp)}`);
  }
}
