// The farm's crop list: which crops the planner may choose from.
// Farmers tick the crops they can grow and sell, and say whether they keep livestock
// (pasture phases only pay when something grazes them).
import { CROPS, CROP_BY_ID } from '../data/crops.js';

/** `crops: null` means every crop. */
export const DEFAULT_FARM = { livestock: true, crops: null };

/** Display groups for the crop picker, in rotation-family order. */
export const CROP_GROUPS = [
  { family: 'cereal', label: 'Cereals' },
  { family: 'oilseed', label: 'Oilseeds' },
  { family: 'pulse', label: 'Legumes & hay' },
  { family: 'pasture', label: 'Pasture', livestock: true },
  { family: 'fallow', label: 'Rest' },
];

const BREAK_FAMILIES = new Set(['oilseed', 'pulse', 'pasture']);

/** Crops the planner may use for this farm, in CROPS order. Never empty: falls back to fallow. */
export function allowedCrops(farm = DEFAULT_FARM) {
  const ticked = farm?.crops ? new Set(farm.crops) : null;
  const list = CROPS.filter((c) => (!ticked || ticked.has(c.id)) && !(c.needsLivestock && farm?.livestock === false));
  return list.length ? list : [CROP_BY_ID.fallow];
}

/** Is this crop ticked on the farm's list? (Pasture can be ticked but still blocked by "no livestock".) */
export const isTicked = (farm, id) => !farm?.crops || farm.crops.includes(id);

/** Plain-language problems with a crop list, worst first. */
export function cropSetWarnings(farm) {
  const growing = allowedCrops(farm).filter((c) => c.family !== 'fallow');
  if (!growing.length) return ['Tick at least one crop to plan with. With nothing ticked, every paddock is left fallow.'];
  const out = [];
  if (!growing.some((c) => BREAK_FAMILIES.has(c.family))) {
    out.push('No break crop on your list (a legume, canola or pasture). Cereal after cereal builds up root diseases and weeds and runs down nitrogen, so expect soil health to fall.');
  }
  if (!growing.some((c) => c.fixesN)) {
    if (growing.some((c) => BREAK_FAMILIES.has(c.family))) out.push('No legume on your list, so nothing adds nitrogen back. Plan on more fertiliser.');
  }
  if (growing.length === 1) out.push(`Only ${growing[0].name} is ticked, so every paddock grows it every year.`);
  return out;
}

/** Short summary for buttons and chips, e.g. "9 crops · no livestock". */
export function describeCropSet(farm) {
  const n = allowedCrops(farm).filter((c) => c.family !== 'fallow').length;
  return `${n} crop${n === 1 ? '' : 's'}${farm?.livestock === false ? ' · no livestock' : ''}`;
}
