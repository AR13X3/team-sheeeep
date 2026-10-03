// Place search via OpenStreetMap Nominatim (https://nominatim.org). Keep usage light:
// one request per explicit search, as the public instance's usage policy requires.
import { getJSON } from './http.js';

/** @returns {Promise<{name: string, center: [number, number], bounds: [[number, number], [number, number]] } | null>} */
export async function searchPlace(query) {
  const q = query.trim();
  if (!q) return null;
  const qs = new URLSearchParams({ format: 'json', limit: '1', q });
  const [hit] = await getJSON(`https://nominatim.openstreetmap.org/search?${qs}`, {
    cacheKey: `geo:${q.toLowerCase()}`,
  });
  if (!hit) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  return { name: hit.display_name, center: [Number(hit.lat), Number(hit.lon)], bounds: [[s, w], [n, e]] };
}
