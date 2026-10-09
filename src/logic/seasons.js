import { SOWING_DAY } from '../config.js';

/** Sowing date of the first season that hasn't been sown yet. */
export function firstPlannedSowing(today = new Date()) {
  const thisYear = new Date(today.getFullYear(), SOWING_DAY.month - 1, SOWING_DAY.day);
  return today < thisYear ? thisYear : new Date(today.getFullYear() + 1, SOWING_DAY.month - 1, SOWING_DAY.day);
}

/** Sowing dates of the planned seasons. */
export function sowingDates(count, today = new Date()) {
  const first = firstPlannedSowing(today);
  return Array.from({ length: count }, (_, i) => new Date(first.getFullYear() + i, first.getMonth(), first.getDate()));
}

/** "10 May 2027" */
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

/** Labels like "10 May 2027" for each planned season. */
export const sowingLabels = (count, today = new Date()) => sowingDates(count, today).map(fmtDate);

/** The harvest year of each planned season. */
export const seasonYears = (count, today = new Date()) => sowingDates(count, today).map((d) => d.getFullYear());

/** "3 min ago", "yesterday", "12 Oct" */
export function timeAgo(at, now = Date.now()) {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
