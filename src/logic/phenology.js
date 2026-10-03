// Reads a paddock's season from its satellite greenness curve (crop phenology):
// when it greened up, how green it got, when it dried off, and whether it flashed yellow
// (canola flowers). Rules are deliberately simple and tuned against the USDA Cropland Data
// Layer (see README → Accuracy); the thresholds live in PHENO so they're easy to adjust.

export const PHENO = {
  minObs: 5, // fewer clear looks than this → "not enough images"
  minClear: 0.6, // a reading counts if at least 60% of the paddock was cloud-free
  fallowPeak: 0.38, // never got greener than this → fallow / bare
  canolaYellow: 0.09, // NDYI this far above the same image's ordinary green crops = flowering
  canolaSingle: 0.14, // with a single flowering look, it must be at least this yellow
  // flowering canola is still near full greenness; crops turning yellow as they ripen are not
  floweringNdviFrac: 0.75,
  pastureMinNdvi: 0.3, // stayed at least this green all season
  pastureAmplitude: 0.3,
  cerealPeak: 0.72,
  cerealDurationDays: 115,
};

const DAY = 86400000;
const t = (d) => Date.parse(d);
const fmt = (ms) => new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

/**
 * The main growing season for a year at a latitude.
 * Southern hemisphere (e.g. Australia's winter crops): sown Apr–Jun, harvested by January.
 * Northern hemisphere spring crops: sown Apr–May, harvested by October.
 */
export function seasonWindow(year, lat) {
  return lat < 0
    ? // canola in southern Australia flowers from late July to September; later yellowing is ripening
      { start: `${year}-04-01`, end: `${year + 1}-01-15`, flowering: [`${year}-07-15`, `${year}-10-10`] }
    : { start: `${year}-03-20`, end: `${year}-10-31`, flowering: [`${year}-06-01`, `${year}-08-31`] };
}

function despike(obs) {
  // a reading much lower than both neighbours is usually leftover cloud or shadow
  return obs.filter((o, i) => {
    const a = obs[i - 1], b = obs[i + 1];
    return !(a && b && o.ndvi < a.ndvi - 0.15 && o.ndvi < b.ndvi - 0.15);
  });
}

/**
 * @param obs  [{ date: 'YYYY-MM-DD', ndvi, yellow, clear }] for one paddock, any order
 * @param win  seasonWindow(...)
 * @returns { family, cropId, label, confidence, evidence, peakNdvi, peakDate, greenUp, senescence,
 *            floweringDate, vigour, series, complete } or { family: null, reason }
 */
export function classifySeason(obs, win, { today = new Date() } = {}) {
  const start = t(win.start), end = t(win.end);
  let pts = obs
    .filter((o) => o.ndvi != null && o.clear >= PHENO.minClear && t(o.date) >= start && t(o.date) <= end)
    .sort((a, b) => t(a.date) - t(b.date));
  pts = despike(pts);
  const complete = today.getTime() > end;
  if (pts.length < PHENO.minObs) return { family: null, reason: `Only ${pts.length} clear satellite looks this season`, series: pts.map((p) => [p.date, p.ndvi]), complete };

  const ndvi = pts.map((p) => p.ndvi);
  const peakIdx = ndvi.indexOf(Math.max(...ndvi));
  const peak = ndvi[peakIdx];
  const sorted = [...ndvi].sort((a, b) => a - b);
  const base = sorted[Math.floor(sorted.length * 0.1)];
  const amplitude = peak - base;
  const half = base + amplitude / 2;
  const greenUpPt = pts.find((p, i) => i <= peakIdx && p.ndvi >= half);
  const senPt = pts.find((p, i) => i > peakIdx && p.ndvi <= half);
  const greenUp = greenUpPt ? t(greenUpPt.date) : null;
  const senescence = senPt ? t(senPt.date) : null;
  const duration = greenUp && senescence ? (senescence - greenUp) / DAY : null;

  // vigour: area under the greenness curve above the off-season baseline (NDVI-days)
  let vigour = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = (t(pts[i].date) - t(pts[i - 1].date)) / DAY;
    vigour += (Math.max(0, pts[i].ndvi - base) + Math.max(0, pts[i - 1].ndvi - base)) / 2 * dt;
  }

  // canola: clearly yellower than the other green crops in the same image, more than once
  const fStart = t(win.flowering[0]), fEnd = t(win.flowering[1]);
  const flowering = pts.filter((p) => p.yellow != null && t(p.date) >= fStart && t(p.date) <= fEnd && p.ndvi > 0.45);
  const candidates = flowering.filter((p) => p.ndvi >= PHENO.floweringNdviFrac * peak).sort((a, b) => b.yellow - a.yellow);
  const strongest = candidates[0];
  const yellowHits = candidates.filter((p) => p.yellow > PHENO.canolaYellow);
  // canola = flowered yellow in at least two looks, or one very yellow look
  const isCanola = yellowHits.length >= 2 || (yellowHits.length === 1 && strongest.yellow >= PHENO.canolaSingle);

  const r = (v) => Math.round(v * 100) / 100;
  const common = {
    peakNdvi: r(peak),
    peakDate: pts[peakIdx].date,
    greenUp: greenUp && new Date(greenUp).toISOString().slice(0, 10),
    senescence: senescence && new Date(senescence).toISOString().slice(0, 10),
    vigour: Math.round(vigour),
    series: pts.map((p) => [p.date, r(p.ndvi)]),
    looks: pts.length,
    complete,
  };
  const out = (family, cropId, label, confidence, evidence, extra = {}) => ({ family, cropId, label, confidence, evidence, ...common, ...extra });

  if (peak < PHENO.fallowPeak) {
    return out('fallow', 'fallow', 'Fallow / bare', pts.length >= 8 ? 'high' : 'medium', `Never greener than NDVI ${r(peak)} — no crop grew.`);
  }
  if (isCanola) {
    const conf = yellowHits.length >= 2 && strongest.yellow >= PHENO.canolaSingle ? 'high' : 'medium';
    return out('oilseed', 'canola', 'Canola', conf, `Flowered yellow around ${fmt(t(strongest.date))} (${yellowHits.length} image${yellowHits.length > 1 ? 's' : ''} brighter yellow than nearby crops).`, { floweringDate: strongest.date });
  }
  const minNdvi = Math.min(...ndvi);
  const lateGreen = pts.filter((p) => t(p.date) > end - 45 * DAY).map((p) => p.ndvi);
  const greenAtEnd = lateGreen.length && lateGreen.reduce((a, b) => a + b, 0) / lateGreen.length;
  // a season still in progress can't be judged "flat" yet, unless it was already green at sowing time
  const greenAtStart = pts.filter((p) => t(p.date) < start + 45 * DAY).every((p) => p.ndvi >= 0.5) && pts.some((p) => t(p.date) < start + 45 * DAY);
  const flat = amplitude < PHENO.pastureAmplitude && minNdvi >= PHENO.pastureMinNdvi && (complete || greenAtStart);
  if (flat || (complete && !senescence && greenAtEnd >= 0.45)) {
    return out('pasture', 'pasture', 'Pasture', amplitude < 0.2 ? 'high' : 'medium', `Stayed green most of the season (NDVI ${r(minNdvi)}–${r(peak)}) with no harvest dry-down.`);
  }
  if (!complete && !senescence) {
    return out('cereal', 'wheat', 'Crop growing (likely cereal)', 'low', `Greening up now: NDVI ${r(peak)} on ${fmt(t(pts[peakIdx].date))}. Not flowering yellow so far.`);
  }
  const cereal = peak >= PHENO.cerealPeak || (duration ?? 0) >= PHENO.cerealDurationDays;
  const shape = `Greened up ${greenUp ? fmt(greenUp) : '?'}, peaked at NDVI ${r(peak)} on ${fmt(t(pts[peakIdx].date))}, dried off ${senescence ? fmt(senescence) : '?'}.`;
  return cereal
    ? out('cereal', 'wheat', 'Cereal (wheat/barley)', peak >= 0.8 ? 'medium' : 'low', shape)
    : out('pulse', 'lupins', 'Pulse / legume', 'low', `${shape} A shorter, lower peak than a typical cereal.`);
}

/**
 * Canola stubble around the farm: pixels that flowered yellow (vs the scene's ordinary crops)
 * in the given flowering-period scenes, grouped into patches of at least `minPixels`.
 * @param scenes  [{ layers, baseline }] from the flowering window of one season
 * @returns {{ mask: Uint8Array, patches: [{ pixels, cells: number[] }], looks: number }}
 */
export function detectCanolaPixels(scenes, width, height, { minPixels = 15 } = {}) {
  const n = width * height;
  const hits = new Uint8Array(n), seen = new Uint8Array(n), peak = new Float32Array(n);
  for (const { layers } of scenes) for (let i = 0; i < n; i++) if (layers.clear[i] && layers.ndvi[i] > peak[i]) peak[i] = layers.ndvi[i];
  for (const { layers, baseline } of scenes) {
    if (baseline == null) continue;
    for (let i = 0; i < n; i++) {
      if (!layers.clear[i]) continue;
      seen[i]++;
      const v = layers.ndvi[i];
      if (v > 0.45 && v >= PHENO.floweringNdviFrac * peak[i] && layers.ndyi[i] - baseline > PHENO.canolaYellow) hits[i]++;
    }
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = hits[i] >= 2 || (hits[i] === 1 && seen[i] <= 2) ? 1 : 0;
  // group into 8-connected patches; drop specks
  const label = new Int32Array(n).fill(-1);
  const patches = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const cells = [], stack = [i];
    label[i] = patches.length;
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const x = c % width, y = (c / width) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const k = yy * width + xx;
        if (mask[k] && label[k] < 0) {
          label[k] = patches.length;
          stack.push(k);
        }
      }
    }
    patches.push({ pixels: cells.length, cells });
  }
  const kept = patches.filter((p) => p.pixels >= minPixels);
  const finalMask = new Uint8Array(n);
  for (const p of kept) for (const c of p.cells) finalMask[c] = 1;
  return { mask: finalMask, patches: kept, looks: scenes.length };
}
