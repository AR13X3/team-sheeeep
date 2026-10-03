// Topsoil properties from ISRIC SoilGrids 2.0 (250 m global soil maps).
// https://rest.isric.org — free, no key; fair use is about 5 requests per minute.
import { getJSON, round } from './http.js';

const PROPS = ['phh2o', 'clay', 'sand', 'silt', 'soc', 'nitrogen'];
const DEPTHS = [
  ['0-5cm', 5],
  ['5-15cm', 10],
  ['15-30cm', 15],
];

/** USDA soil texture class from sand / silt / clay percentages. */
export function textureClass(sand, silt, clay) {
  if ([sand, silt, clay].some((v) => v == null)) return null;
  // SoilGrids fractions are predicted separately and may not sum to exactly 100.
  const total = sand + silt + clay;
  if (total > 0) [sand, silt, clay] = [sand, silt, clay].map((v) => (v * 100) / total);
  if (silt + 1.5 * clay < 15) return 'Sand';
  if (silt + 2 * clay < 30) return 'Loamy sand';
  if (clay >= 40 && sand <= 45 && silt < 40) return 'Clay';
  if (clay >= 40 && silt >= 40) return 'Silty clay';
  if (clay >= 35 && sand > 45) return 'Sandy clay';
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return 'Clay loam';
  if (clay >= 27 && clay < 40 && sand <= 20) return 'Silty clay loam';
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return 'Sandy clay loam';
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return 'Loam';
  if (silt >= 80 && clay < 12) return 'Silt';
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return 'Silt loam';
  return 'Sandy loam';
}

/**
 * Depth-weighted 0–30 cm averages.
 * @returns {Promise<{ph, clay, sand, silt, soc, nitrogen, texture, source} | null>} null where SoilGrids has no data (water, urban)
 */
export async function fetchSoil([lat, lng]) {
  const qs = new URLSearchParams({ lat: round(lat), lon: round(lng), value: 'mean' });
  PROPS.forEach((p) => qs.append('property', p));
  DEPTHS.forEach(([d]) => qs.append('depth', d));
  const json = await getJSON(`https://rest.isric.org/soilgrids/v2.0/properties/query?${qs}`, {
    cacheKey: `soil:${round(lat)},${round(lng)}`,
    spacingMs: 1500,
  });

  const out = {};
  for (const layer of json.properties?.layers || []) {
    const factor = layer.unit_measure?.d_factor || 1;
    let sum = 0, weight = 0;
    for (const d of layer.depths) {
      const w = DEPTHS.find(([label]) => label === d.label)?.[1];
      const v = d.values?.mean;
      if (w && v != null) {
        sum += (v / factor) * w;
        weight += w;
      }
    }
    out[layer.name] = weight ? sum / weight : null;
  }
  if (out.phh2o == null && out.clay == null) return null;
  const soil = {
    ph: out.phh2o,
    clay: out.clay,
    sand: out.sand,
    silt: out.silt,
    soc: out.soc, // g/kg
    nitrogen: out.nitrogen, // g/kg
    source: 'ISRIC SoilGrids 2.0',
  };
  soil.texture = textureClass(soil.sand, soil.silt, soil.clay);
  return soil;
}

/** Average of several soil samples (null samples are ignored). */
export function averageSoil(samples) {
  const ok = samples.filter(Boolean);
  if (!ok.length) return null;
  const avg = (k) => {
    const vals = ok.map((s) => s[k]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const soil = { ph: avg('ph'), clay: avg('clay'), sand: avg('sand'), silt: avg('silt'), soc: avg('soc'), nitrogen: avg('nitrogen'), source: ok[0].source };
  soil.texture = textureClass(soil.sand, soil.silt, soil.clay);
  return soil;
}

/**
 * True when two samples differ enough to manage them as separate paddocks.
 * A texture-class change alone isn't enough: two samples either side of a class boundary
 * (e.g. 26.9% vs 27.1% clay) are practically the same soil, so we also need a real shift
 * in clay or sand. A large pH or clay difference counts on its own.
 */
export function soilsDiffer(a, b) {
  if (!a || !b) return false;
  const d = (k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  const textureShift = a.texture !== b.texture && (d('clay') >= 4 || d('sand') >= 6);
  return textureShift || d('ph') >= 0.5 || d('clay') >= 8;
}

export function describePh(ph) {
  if (ph == null) return '';
  if (ph < 5.5) return 'acidic';
  if (ph < 6.5) return 'slightly acidic';
  if (ph <= 7.5) return 'neutral';
  if (ph <= 8.4) return 'alkaline';
  return 'strongly alkaline';
}
