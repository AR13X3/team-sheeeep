// Safest sowing window from 30 years of NASA POWER daily temperatures.
//
// For each candidate sowing date and each past year we:
//   1. add up daily thermal time (mean temperature above 0 °C) from sowing until the crop's
//      flowering requirement is met → that year's flowering date;
//   2. check the flowering period for frost (minimum ≤ FROST_C) and the grain/pod-fill period
//      for heat stress (maximum ≥ the crop's limit on at least 2 days).
// Risk = share of years with such an event. The recommended window is the run of dates whose
// combined risk is within WINDOW_TOLERANCE of the lowest; earlier dates give the longest season.
//
// Thermal times are typical mid-maturity values for south-eastern Australia (base 0 °C) and are
// meant as a guide — varieties differ (see README). POWER's grid-cell minimum is milder than a
// cold paddock floor, so frost counts from ≤ 1 °C rather than 0 °C.
export const FROST_C = 1;
export const WINDOW_TOLERANCE = 0.08;
export const CROP_PHENOLOGY = {
  wheat: { ttFlower: 1350, ttFill: 700, heatC: 32, frostWin: [-5, 15] },
  barley: { ttFlower: 1200, ttFill: 650, heatC: 32, frostWin: [-5, 15] },
  oats: { ttFlower: 1250, ttFill: 650, heatC: 32, frostWin: [-5, 15] },
  canola: { ttFlower: 1100, ttFill: 650, heatC: 30, frostWin: [0, 25] },
  lupins: { ttFlower: 1150, ttFill: 600, heatC: 30, frostWin: [0, 20] },
  'field-peas': { ttFlower: 1100, ttFill: 550, heatC: 30, frostWin: [0, 20] },
  chickpeas: { ttFlower: 1300, ttFill: 600, heatC: 30, frostWin: [0, 20] }, // flowers late; pods are frost-sensitive
  'faba-beans': { ttFlower: 1200, ttFill: 650, heatC: 30, frostWin: [0, 20] },
  lentils: { ttFlower: 1150, ttFill: 550, heatC: 30, frostWin: [0, 20] },
  vetch: { ttFlower: 1100, ttFill: 550, heatC: 30, frostWin: [0, 20] },
};

const pad = (n) => String(n).padStart(2, '0');
const mmdd = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Candidate sowing dates (MM-DD), weekly. Autumn sowing in the south, spring sowing in the north. */
export function candidateDates(lat) {
  const out = [];
  // 1 Apr – 30 Jun (autumn sowing in the south) or 1 Apr – 15 Jun (spring sowing in the north)
  const last = lat < 0 ? new Date(2001, 5, 30) : new Date(2001, 5, 15);
  for (let d = new Date(2001, 3, 1); d <= last; d.setDate(d.getDate() + 7)) out.push(mmdd(d));
  return out;
}

/**
 * @param weather from services/weather.js
 * @param cropId  key of CROP_PHENOLOGY
 * @returns {{ cropId, dates: [{ sow, frost, heat, risk, flower }], best, window: [from, to], years } | null}
 */
export function sowingRisk(weather, cropId, lat) {
  const ph = CROP_PHENOLOGY[cropId];
  if (!ph) return null;
  const index = new Map(weather.days.map((d, i) => [d, i]));
  const years = [...new Set(weather.days.map((d) => +d.slice(0, 4)))];
  const dates = candidateDates(lat).map((sow) => {
    let frostYears = 0, heatYears = 0, either = 0, n = 0;
    const flowerDoys = [];
    for (const y of years) {
      let i = index.get(`${y}${sow.replace('-', '')}`);
      if (i == null) continue;
      let tt = 0, start = i;
      while (i < weather.days.length && tt < ph.ttFlower) {
        const mean = (weather.tmin[i] + weather.tmax[i]) / 2;
        if (!Number.isNaN(mean)) tt += Math.max(0, mean);
        i++;
      }
      if (tt < ph.ttFlower) continue; // ran off the end of the record
      const flowerIdx = i;
      // grain/pod fill: thermal time after flowering
      let fill = 0, j = flowerIdx;
      while (j < weather.days.length && fill < ph.ttFill) {
        const mean = (weather.tmin[j] + weather.tmax[j]) / 2;
        if (!Number.isNaN(mean)) fill += Math.max(0, mean);
        j++;
      }
      if (fill < ph.ttFill) continue;
      n++;
      let frost = false;
      for (let k = flowerIdx + ph.frostWin[0]; k <= flowerIdx + ph.frostWin[1]; k++) if (weather.tmin[k] <= FROST_C) frost = true;
      let hot = 0;
      for (let k = flowerIdx; k < j; k++) if (weather.tmax[k] >= ph.heatC) hot++;
      const heat = hot >= 2;
      frostYears += frost;
      heatYears += heat;
      either += frost || heat;
      flowerDoys.push(flowerIdx - start);
    }
    if (!n) return { sow, frost: null, heat: null, risk: null, flower: null };
    flowerDoys.sort((a, b) => a - b);
    const median = flowerDoys[flowerDoys.length >> 1];
    const fd = new Date(2001, +sow.slice(0, 2) - 1, +sow.slice(3) + median);
    return { sow, frost: frostYears / n, heat: heatYears / n, risk: either / n, flower: mmdd(fd), years: n };
  });
  const valid = dates.filter((d) => d.risk != null);
  if (!valid.length) return null;
  const min = Math.min(...valid.map((d) => d.risk));
  const okIdx = dates.map((d, i) => (d.risk != null && d.risk <= min + WINDOW_TOLERANCE ? i : -1)).filter((i) => i >= 0);
  // the longest run of acceptable dates; earliest date in it is "best" (longest growing season)
  let runs = [], cur = [];
  for (const i of okIdx) {
    if (cur.length && i !== cur[cur.length - 1] + 1) (runs.push(cur), (cur = []));
    cur.push(i);
  }
  if (cur.length) runs.push(cur);
  const run = runs.sort((a, b) => b.length - a.length || a[0] - b[0])[0];
  const best = dates[run[0]];
  return { cropId, dates, best, window: [dates[run[0]].sow, dates[run[run.length - 1]].sow], years: years.length, minRisk: min };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtMMDD = (s) => `${+s.slice(3)} ${MONTHS[+s.slice(0, 2) - 1]}`;
