// Long-term climate for a location from NASA POWER (Prediction Of Worldwide Energy Resources),
// agroclimatology community. https://power.larc.nasa.gov — free, no key.
import { getJSON, round } from './http.js';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * @returns {Promise<{rainfallMm, growingSeasonRainMm, meanTempC, rootZoneWetness, monthlyRainMm, source}>}
 */
export async function fetchClimate([lat, lng]) {
  const qs = new URLSearchParams({
    parameters: 'PRECTOTCORR,T2M,GWETROOT',
    community: 'AG',
    latitude: round(lat, 3),
    longitude: round(lng, 3),
    format: 'JSON',
  });
  const json = await getJSON(`https://power.larc.nasa.gov/api/temporal/climatology/point?${qs}`, {
    cacheKey: `climate:${round(lat, 2)},${round(lng, 2)}`,
  });
  const p = json.properties?.parameter;
  if (!p) return null;
  const monthlyRainMm = MONTHS.map((m, i) => Math.round(p.PRECTOTCORR[m] * DAYS[i]));
  // Growing season for winter crops: May–October in the southern hemisphere, Nov–Apr in the north.
  const season = lat < 0 ? [4, 5, 6, 7, 8, 9] : [10, 11, 0, 1, 2, 3];
  return {
    rainfallMm: monthlyRainMm.reduce((a, b) => a + b, 0),
    growingSeasonRainMm: season.reduce((a, i) => a + monthlyRainMm[i], 0),
    meanTempC: p.T2M.ANN,
    rootZoneWetness: p.GWETROOT.ANN, // 0 (dry) .. 1 (saturated)
    monthlyRainMm,
    source: 'NASA POWER',
  };
}
