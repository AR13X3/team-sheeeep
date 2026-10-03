// Keeps paddocks from overlapping: a new or edited outline has any area that falls
// inside a neighbouring paddock cut away, so neighbours share an edge instead.
import polygonClipping from 'polygon-clipping';
import { areaHa } from './geometry.js';

const toGeo = (coords) => [[...coords.map(([lat, lng]) => [lng, lat]), [coords[0][1], coords[0][0]]]];
const fromRing = (ring) => ring.slice(0, -1).map(([lng, lat]) => [lat, lng]);
// Paddocks that merely touch (e.g. snapped to a shared fence) produce slivers of
// floating-point dust; only treat more than this as a real overlap.
const MIN_OVERLAP_HA = 0.0005; // 5 m²

const overlapHa = (a, b) =>
  polygonClipping.intersection(a, b).reduce((sum, poly) => sum + areaHa(fromRing(poly[0])), 0);

/**
 * @param coords  outline being added or edited
 * @param others  [{ id, name, coords }] the other paddocks
 * @returns {{ coords: [[lat,lng]]|null, trimmedHa: number, overlapped: string[], pieces: number }}
 *          coords is null when nothing is left (the outline was entirely inside others).
 *          When nothing overlaps, `coords` is returned untouched (snapped corners stay exact).
 */
export function trimOverlaps(coords, others) {
  const subject = toGeo(coords);
  const hits = others.filter((o) => overlapHa(subject, toGeo(o.coords)) > MIN_OVERLAP_HA);
  if (!hits.length) return { coords, trimmedHa: 0, overlapped: [], pieces: 1 };
  const overlapped = hits.map((o) => o.name);
  const result = polygonClipping.difference(subject, ...hits.map((o) => toGeo(o.coords)));
  if (!result.length) return { coords: null, trimmedHa: areaHa(coords), overlapped, pieces: 0 };
  // keep the largest remaining piece (outer ring)
  const rings = result.map((poly) => fromRing(poly[0])).sort((a, b) => areaHa(b) - areaHa(a));
  const kept = rings[0];
  return { coords: kept, trimmedHa: Math.max(0, areaHa(coords) - areaHa(kept)), overlapped, pieces: rings.length };
}
