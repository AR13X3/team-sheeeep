// "Did my rotation work?" — evidence from the farm's own satellite record.
//
// Vigour = area under a season's greenness curve (NDVI-days above the off-season baseline).
// Seasons differ hugely in rain, so each paddock is compared with the farm's other cropped
// paddocks in the same season (relative vigour 1.10 = 10% more vigorous than the farm that year).
// The question every rotation is meant to answer: do cereals do better after a break crop
// (canola, a legume or pasture) than after another cereal?
//
// Rain is shown as context with the French & Schultz water-limited yield benchmark for wheat:
// (growing-season rain − 110 mm) × 20 kg/ha/mm.
import { seasonalRain } from '../services/weather.js';

const BREAK = new Set(['oilseed', 'pulse', 'pasture']);
const CROPPED = new Set(['cereal', 'oilseed', 'pulse']);

export const waterLimitedWheat = (gsrMm) => Math.max(0, ((gsrMm - 110) * 20) / 1000); // t/ha

/**
 * @param space    result of services/space.js
 * @param weather  NASA POWER daily record (optional; adds rainfall context)
 * @param paddocks [{ id, name }]
 */
export function rotationReport(space, weather, paddocks) {
  if (!space) return null;
  const south = space.lat < 0;
  const rain = weather ? seasonalRain(weather, south ? '0401' : '0320', south ? '1031' : '0831') : {};
  const rows = [];
  for (const p of paddocks) {
    const seasons = space.paddocks[p.id]?.seasons || [];
    seasons.forEach((s, i) => {
      if (!s.complete || !s.family || s.vigour == null) return;
      rows.push({ paddock: p.name, id: p.id, year: s.year, family: s.family, prevFamily: seasons[i - 1]?.family ?? null, vigour: s.vigour });
    });
  }
  // farm average vigour of cropped paddocks, per season
  const yearMean = {};
  for (const r of rows.filter((x) => CROPPED.has(x.family))) (yearMean[r.year] ||= []).push(r.vigour);
  for (const y of Object.keys(yearMean)) yearMean[y] = yearMean[y].reduce((a, b) => a + b, 0) / yearMean[y].length;
  for (const r of rows) r.relative = yearMean[r.year] ? r.vigour / yearMean[r.year] : null;

  const cereals = rows.filter((r) => r.family === 'cereal' && r.prevFamily && r.relative != null);
  const afterBreak = cereals.filter((r) => BREAK.has(r.prevFamily));
  const afterCereal = cereals.filter((r) => r.prevFamily === 'cereal');
  const mean = (a) => (a.length ? a.reduce((s, r) => s + r.relative, 0) / a.length : null);
  const mb = mean(afterBreak), mc = mean(afterCereal);
  const years = [...new Set(rows.map((r) => r.year))].sort().map((year) => ({
    year,
    rainMm: rain[year] != null ? Math.round(rain[year]) : null,
    potential: rain[year] != null ? waterLimitedWheat(rain[year]) : null,
    farmVigour: yearMean[year] ?? null,
  }));
  return {
    rows,
    afterBreak: { n: afterBreak.length, mean: mb },
    afterCereal: { n: afterCereal.length, mean: mc },
    difference: mb != null && mc ? mb / mc - 1 : null, // +0.12 → cereals 12% more vigorous after a break
    years,
    enough: afterBreak.length >= 2 && afterCereal.length >= 2,
    rainLabel: south ? 'Rain Apr–Oct' : 'Rain Mar–Aug',
  };
}
