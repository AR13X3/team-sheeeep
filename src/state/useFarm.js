import { useMemo } from 'react';
import { useStore } from './store.jsx';
import { useSpace } from './useSpace.js';
import { PLAN_SEASONS } from '../config.js';
import { planFarm, BLACKLEG_DISTANCE_M } from '../logic/rotation.js';
import { withSpaceAll } from '../logic/spacePlanning.js';
import { allowedCrops, cropSetWarnings, DEFAULT_FARM } from '../logic/cropSet.js';
import { sowingLabels, seasonYears } from '../logic/seasons.js';
import { areaHa, interiorPoint } from '../logic/geometry.js';

// The onboarding steps, in order. `to` is where each one happens.
export const SETUP_STEPS = [
  { key: 'about', label: 'About you', to: () => '/experience' },
  { key: 'crops', label: 'Crops', to: () => '/farm' },
  { key: 'paddocks', label: 'Paddocks', to: () => '/paddocks' },
  { key: 'soil', label: 'Soil check', to: () => '/paddocks/review' },
  { key: 'details', label: 'Paddock details', to: (s) => (s.paddocks[0] ? `/paddocks/${s.paddocks[0].id}/history` : '/paddocks') },
  { key: 'plan', label: 'Your plan', to: () => '/planner' },
];

/** Which setup steps are done (older saved farms without step flags count what they have). */
export function setupProgress(state) {
  const flags = state.setupSteps || {};
  const has = state.paddocks.length > 0;
  const done = {
    about: flags.about || !!state.experience,
    crops: flags.crops || (has && !!state.experience),
    paddocks: flags.paddocks || has,
    soil: flags.soil || (has && !!state.setupDone),
    details: flags.details || (has && !!state.setupDone),
    plan: flags.plan || !!state.setupDone,
  };
  const count = SETUP_STEPS.filter((s) => done[s.key]).length;
  const next = SETUP_STEPS.find((s) => !done[s.key]);
  return { done, count, total: SETUP_STEPS.length, next, complete: count === SETUP_STEPS.length };
}

/**
 * Everything the farm-level pages show, worked out once: the plan for every paddock with what
 * the satellites saw folded in, soil health per season, crop mix and alerts.
 */
export function useFarm() {
  const { state } = useStore();
  const { paddocks } = state;
  const farm = state.farm ?? DEFAULT_FARM;
  const space = useSpace();
  const crops = useMemo(() => allowedCrops(farm), [farm]);
  const planned = useMemo(() => withSpaceAll(paddocks, space.result), [paddocks, space.result]);
  const { plans, farmHealth, baseHealth } = useMemo(() => planFarm(planned, PLAN_SEASONS, crops), [planned, crops]);
  const labels = useMemo(() => sowingLabels(PLAN_SEASONS), []);
  const years = useMemo(() => seasonYears(PLAN_SEASONS), []);
  const areas = useMemo(() => Object.fromEntries(paddocks.map((p) => [p.id, areaHa(p.coords)])), [paddocks]);
  const totalHa = useMemo(() => Object.values(areas).reduce((a, b) => a + b, 0), [areas]);
  const farmPoint = useMemo(() => (paddocks.length ? interiorPoint(paddocks[0].coords) : null), [paddocks]);

  /** Hectares per crop in season i, biggest first. */
  const cropMix = useMemo(
    () =>
      Array.from({ length: PLAN_SEASONS }, (_, i) => {
        const by = new Map();
        for (const p of paddocks) {
          const crop = plans[p.id]?.seasons[i]?.crop;
          if (!crop) continue;
          const e = by.get(crop.id) || { crop, ha: 0, paddocks: [] };
          e.ha += areas[p.id];
          e.paddocks.push(p);
          by.set(crop.id, e);
        }
        return [...by.values()].sort((a, b) => b.ha - a.ha);
      }),
    [paddocks, plans, areas],
  );

  /** Share of paddock-seasons in a break crop (legume, oilseed, pasture) across the plan. */
  const breakShare = useMemo(() => {
    let n = 0, br = 0;
    for (const p of paddocks) for (const s of plans[p.id]?.seasons || []) {
      n++;
      if (['oilseed', 'pulse', 'pasture'].includes(s.crop.family)) br++;
    }
    return n ? br / n : 0;
  }, [paddocks, plans]);

  const alerts = useMemo(() => {
    const out = [];
    for (const p of planned) {
      const bl = p.blackleg;
      if (bl?.distanceM != null && bl.distanceM < BLACKLEG_DISTANCE_M) {
        out.push({
          id: `blackleg:${p.id}`,
          tone: 'bad',
          icon: 'alert',
          title: `Blackleg risk on ${p.name}`,
          text: `Canola flowered ${bl.distanceM < 30 ? 'right next to it' : `${bl.distanceM} m away`} in ${bl.year}. The plan avoids canola here next season.`,
          to: `/paddocks/${p.id}/history`,
        });
      }
      const typed = ['last', 'prev', 'prev2'].some((k) => p.history?.[k]?.some(Boolean));
      if (!typed && !p.historyFromSpace?.length && space.result) {
        out.push({ id: `history:${p.id}`, tone: 'warn', icon: 'history', title: `No crop history for ${p.name}`, text: 'Add the last three seasons so the plan can follow on from them.', to: `/paddocks/${p.id}/history` });
      }
      if (p.site?.soil === null) out.push({ id: `soil:${p.id}`, tone: 'info', icon: 'info', title: `No soil data for ${p.name}`, text: 'The soil map has no reading here (water or built-up area).', to: `/paddocks/${p.id}/conditions` });
    }
    if (paddocks.length > 1) {
      const next = cropMix[0];
      if (next?.length === 1) out.push({ id: 'mono', tone: 'warn', icon: 'flag', title: `Every paddock grows ${next[0].crop.name} in ${years[0]}`, text: 'A one-crop season concentrates price and weather risk. Adjust priorities on a paddock to spread it.', to: '/planner' });
    }
    for (const w of cropSetWarnings(farm)) out.push({ id: `crops:${w.slice(0, 20)}`, tone: 'warn', icon: 'sprout', title: 'Check your crop list', text: w, to: '/settings' });
    return out;
  }, [planned, paddocks.length, cropMix, years, farm, space.result]);

  return { state, paddocks, farm, crops, space, planned, plans, farmHealth, baseHealth, labels, years, areas, totalHa, farmPoint, cropMix, breakShare, alerts };
}
