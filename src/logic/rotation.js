// Rule-based crop rotation planner.
// For each future season it scores every crop against the paddock's history, issues,
// rotation goals and the farmer's priority sliders, then picks the best one.
import { CROPS, CROP_BY_ID } from '../data/crops.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// How strongly each priority slider (0–100, 50 = neutral) pulls the choice.
// Tuned so every slider changes the plan across its range without overriding the
// agronomic rotation rules below (see README → "How the planner decides").
export const PRIORITY_STRENGTH = { soilHealth: 0.45, water: 0.9, profit: 1.4, risk: 0.8 };

// Blackleg (Leptosphaeria maculans) spores blow from last season's canola stubble; growers are
// advised to keep new canola at least ~500 m away from it (GRDC blackleg management guide).
export const BLACKLEG_DISTANCE_M = 500;
const BLACKLEG_PENALTY = 6;

/** Starting soil-health index (0-100) from measured soil + known issues. */
export function baseSoilHealth(paddock) {
  const soil = paddock.site?.soil;
  let h = 60;
  if (soil?.soc != null) h += clamp((soil.soc - 10) * 1.5, -15, 15);
  if (soil?.ph != null) h -= Math.min(20, Math.abs(soil.ph - 6.5) * 6);
  for (const k of ['erosion', 'salinity', 'waterlogging']) if (paddock.issues?.[k]) h -= 5;
  return Math.round(clamp(h, 5, 95));
}

function cropScore(crop, seq, ctx) {
  const { w, issues, reasons, soil, climate } = ctx;
  const prev = CROP_BY_ID[seq[seq.length - 1]];
  const prev2 = CROP_BY_ID[seq[seq.length - 2]];
  let cerealRun = 0;
  for (let i = seq.length - 1; i >= 0 && CROP_BY_ID[seq[i]]?.family === 'cereal'; i--) cerealRun++;
  const isBreak = (c) => c && c.family !== 'cereal' && c.family !== 'fallow';
  const diseaseFlag = reasons.diseaseBreak || issues.diseaseHistory;

  const why = [];
  let s = 0;
  const add = (v, label) => {
    s += v;
    if (label && v > 0.7) why.push([v, label]);
  };

  // Farmer's priorities (each weight is 0..2, 1 = neutral)
  const K = PRIORITY_STRENGTH;
  add(w.soilHealth * crop.soil * K.soilHealth, 'Builds soil health');
  add(w.water * (2 - crop.water) * K.water, 'Low water use');
  add(w.profit * (crop.profit - 2) * K.profit, 'Strong margin');
  add(w.risk * (2 - crop.risk) * K.risk, 'Low risk');

  // Rotation agronomy
  if (prev?.id === crop.id && crop.family !== 'pasture') s -= 5;
  if (prev && prev.family === crop.family && crop.family !== 'pasture') s -= 3;
  if (prev2 && prev2.family === crop.family && crop.family !== 'pasture') s -= 1;
  if (crop.family === 'pasture' && prev?.family === 'pasture' && prev2?.family === 'pasture') s -= 4; // 2-year pasture phase max
  const recentUses = seq.slice(-4).filter((id) => id === crop.id).length;
  s -= 1.2 * recentUses; // keep the rotation varied
  if (crop.family === 'fallow') s -= 2.5; // only when nothing else fits

  if (crop.family === 'cereal' && isBreak(prev)) add(2.2, prev.fixesN ? 'Uses nitrogen left by the legume' : 'Cashes in on the break crop');
  if (crop.family === 'cereal' && cerealRun >= 2) s -= 1.5 * (cerealRun - 1);
  if (isBreak(crop) && isBreak(prev) && !(crop.family === 'pasture' && prev.family === 'pasture')) s -= 1;
  if (isBreak(crop) && cerealRun > 0) add((0.3 + 0.8 * cerealRun) * (diseaseFlag ? 1.6 : 1), 'Breaks the cereal disease cycle');
  if (crop.fixesN) add((reasons.nitrogen ? 1.2 : 0.3) + 0.3 * cerealRun, 'Fixes nitrogen');

  // Paddock issues and goals
  if (issues.herbicideWeeds || reasons.weedControl) add(crop.weedControl * (issues.herbicideWeeds ? 1.1 : 0.7), 'Helps control weeds');
  if (issues.salinity) add((crop.salinity - 2) * 1.6, 'Tolerates salinity');
  if (issues.waterlogging) add((crop.waterlogging - 2) * 1.6, 'Copes with waterlogging');
  if (issues.erosion || reasons.erosion) add((crop.cover - 2) * 1.2, 'Keeps the ground covered');
  if (reasons.spreadRisk) {
    const recent = seq.slice(-3).filter((id) => CROP_BY_ID[id]?.family === crop.family).length;
    add(-0.9 * recent);
    if (recent === 0) add(0.9, 'Spreads risk across crop types');
  }
  if (reasons.profit) add((crop.profit - 2) * 0.9, 'Strong margin');

  // Site: soil pH and climate
  if (soil?.ph != null && soil.ph < 5.5) add((crop.acid - 2) * 1.6, 'Suits acidic soil');
  // SoilGrids pH is measured in water, ~0.7 above the CaCl2 values in Australian guides:
  // pH(H2O) 6.5 ≈ pH(CaCl2) 5.8, below which chickpeas, lentils and faba beans struggle.
  else if (soil?.ph != null && soil.ph < 6.5) add((crop.acid - 2) * 0.8, 'Suits slightly acidic soil');
  if (soil?.ph != null && soil.ph > 7.8) add((crop.alkaline - 2) * 1.6, 'Suits alkaline soil');
  if (climate?.rainfallMm != null && climate.rainfallMm < 400) add((2 - crop.water) * 1.4, 'Suits a dry climate');
  if (climate?.rainfallMm != null && climate.rainfallMm > 700) add((crop.waterlogging - 2) * 0.6);

  why.sort((a, b) => b[0] - a[0]);
  return { score: s, why: [...new Set(why.map((x) => x[1]))].slice(0, 2) };
}

function healthDelta(crop, seq, health) {
  const prev = CROP_BY_ID[seq[seq.length - 1]];
  let d = crop.soil * 1.3;
  if (prev && prev.family === crop.family && crop.family !== 'pasture') d -= 2;
  if (prev?.family === 'cereal' && crop.family !== 'cereal') d += 1;
  if (d > 0) d *= Math.max(0.2, 1 - health / 110); // gains get harder near the top
  return d;
}

/**
 * paddock.blackleg = { distanceM, year } (canola seen from space near the paddock) is optional.
 * `crops` = the farm's crop list (logic/cropSet.js → allowedCrops); the plan only uses these.
 * @returns {{ base: number, seasons: Array<{ crop, why: string[], health: number, note?: string }> }}
 */
export function planPaddock(paddock, seasons, crops = CROPS) {
  const pr = paddock.priorities || {};
  const w = Object.fromEntries(['soilHealth', 'water', 'profit', 'risk'].map((k) => [k, (pr[k] ?? 50) / 50]));
  const ctx = {
    w,
    issues: paddock.issues || {},
    reasons: paddock.reasons || {},
    soil: paddock.site?.soil,
    climate: paddock.site?.climate,
  };
  const h = paddock.history || {};
  const seq = [h.prev2?.[0], h.prev?.[0], h.last?.[0]].filter(Boolean);

  const base = baseSoilHealth(paddock);
  let health = base;
  const out = [];
  const bl = paddock.blackleg;
  const blacklegRisk = bl?.distanceM != null && bl.distanceM < BLACKLEG_DISTANCE_M;
  for (let i = 0; i < seasons; i++) {
    let best = null, bestIgnoringBlackleg = null;
    for (const crop of crops) {
      const r = cropScore(crop, seq, ctx);
      if (!bestIgnoringBlackleg || r.score > bestIgnoringBlackleg.score) bestIgnoringBlackleg = { ...r, crop };
      // only next season is affected: stubble seen from space is last season's
      if (i === 0 && blacklegRisk && crop.id === 'canola') r.score -= BLACKLEG_PENALTY;
      if (!best || r.score > best.score) best = { ...r, crop };
    }
    let note;
    if (i === 0 && blacklegRisk) {
      const where = bl.distanceM < 30 ? 'right next to this paddock' : `${bl.distanceM} m away`;
      if (bestIgnoringBlackleg.crop.id === 'canola' && best.crop.id !== 'canola') note = `Canola would suit, but canola flowered ${where} in ${bl.year} (seen from space). Its stubble spreads blackleg, so ${best.crop.name} is safer this year.`;
      else if (best.crop.id === 'canola') note = `Blackleg risk: canola flowered ${where} in ${bl.year}. Choose a resistant variety and treat seed if you sow canola here.`;
    }
    health = clamp(health + healthDelta(best.crop, seq, health), 5, 100);
    seq.push(best.crop.id);
    out.push({ crop: best.crop, why: best.why, health: Math.round(health), ...(note && { note }) });
  }
  return { base, seasons: out };
}

/** Every crop's score for the coming season, best first (used to explain choices). */
export function rankNextSeason(paddock, crops = CROPS) {
  const pr = paddock.priorities || {};
  const w = Object.fromEntries(['soilHealth', 'water', 'profit', 'risk'].map((k) => [k, (pr[k] ?? 50) / 50]));
  const ctx = { w, issues: paddock.issues || {}, reasons: paddock.reasons || {}, soil: paddock.site?.soil, climate: paddock.site?.climate };
  const h = paddock.history || {};
  const seq = [h.prev2?.[0], h.prev?.[0], h.last?.[0]].filter(Boolean);
  return crops.map((crop) => ({ crop, ...cropScore(crop, seq, ctx) })).sort((a, b) => b.score - a.score);
}

/** Plans every paddock and the farm-wide soil health per season. */
export function planFarm(paddocks, seasons, crops = CROPS) {
  const plans = Object.fromEntries(paddocks.map((p) => [p.id, planPaddock(p, seasons, crops)]));
  const farmHealth = Array.from({ length: seasons }, (_, i) => {
    if (!paddocks.length) return 0;
    return Math.round(paddocks.reduce((sum, p) => sum + plans[p.id].seasons[i].health, 0) / paddocks.length);
  });
  const baseHealth = paddocks.length ? Math.round(paddocks.reduce((s, p) => s + plans[p.id].base, 0) / paddocks.length) : 0;
  return { plans, farmHealth, baseHealth };
}
