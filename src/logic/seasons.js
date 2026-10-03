import { SOWING_DAY } from '../config.js';

const pad = (n) => String(n).padStart(2, '0');

/** Sowing date of the first season that hasn't been sown yet. */
export function firstPlannedSowing(today = new Date()) {
  const thisYear = new Date(today.getFullYear(), SOWING_DAY.month - 1, SOWING_DAY.day);
  return today < thisYear ? thisYear : new Date(today.getFullYear() + 1, SOWING_DAY.month - 1, SOWING_DAY.day);
}

/** Labels like "10.05.27" (DD.MM.YY, as in the design) for each planned season. */
export function sowingLabels(count, today = new Date()) {
  const first = firstPlannedSowing(today);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first.getFullYear() + i, first.getMonth(), first.getDate());
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
  });
}
