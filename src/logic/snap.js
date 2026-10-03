// Snapping and border tracing for drawing paddocks next to each other.
//
// Snap distances are in SCREEN PIXELS, not metres: zoomed out, neighbouring borders
// lock together easily; zoomed in, the same 14 px is only a few metres on the ground,
// so a real gap between two fields can still be drawn. Holding Alt skips snapping.
import { offset } from './geometry.js';

export const SNAP_VERTEX_PX = 14;
export const SNAP_EDGE_PX = 10;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/**
 * Nearest corner (preferred) or edge of another paddock within the snap radius.
 * @param point   cursor position in container pixels {x, y}
 * @param targets [{ id, name, coords: [[lat, lng], ...] }]
 * @param toPx    ([lat, lng]) => {x, y}  (e.g. map.latLngToContainerPoint)
 * @returns {{ kind: 'vertex'|'edge', id, name, index, s, at: [lat, lng], a?, b? } | null}
 *          `s` is the position along that paddock's boundary (vertex i = i, mid-edge = i + 0.5).
 */
export function findSnap(point, targets, toPx, { vertexPx = SNAP_VERTEX_PX, edgePx = SNAP_EDGE_PX } = {}) {
  let best = null;
  const projected = targets.map((t) => ({ t, px: t.coords.map(toPx) }));
  for (const { t, px } of projected) {
    px.forEach((p, i) => {
      const d = dist(point, p);
      if (d <= vertexPx && (!best || d < best.d)) best = { kind: 'vertex', id: t.id, name: t.name, index: i, s: i, d, at: t.coords[i] };
    });
  }
  if (best) return best;
  for (const { t, px } of projected) {
    const n = px.length;
    for (let i = 0; i < n; i++) {
      const a = px[i], b = px[(i + 1) % n];
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (!len2) continue;
      const u = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / len2));
      const d = dist(point, { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) });
      if (d <= edgePx && (!best || d < best.d)) {
        const ca = t.coords[i], cb = t.coords[(i + 1) % n];
        best = { kind: 'edge', id: t.id, name: t.name, index: i, s: i + u, d, at: lerp(ca, cb, u), a: ca, b: cb };
      }
    }
  }
  return best;
}

// approximate metres between two nearby points
function metres(p, q) {
  const north = offset(p, 0, 1)[0] - p[0], east = offset(p, 1, 0)[1] - p[1];
  return Math.hypot((q[0] - p[0]) / north, (q[1] - p[1]) / east);
}

const pointAt = (coords, s) => {
  const n = coords.length, i = Math.floor(s) % n, u = s - Math.floor(s);
  return lerp(coords[i], coords[(i + 1) % n], u);
};

/**
 * Corners of a neighbouring paddock that lie between two snapped points on its border,
 * going the shorter way round — so a new paddock can follow a shared fence exactly.
 */
export function traceBetween(coords, s1, s2) {
  const n = coords.length;
  if (Math.abs(s1 - s2) < 1e-9) return [];
  const walk = (dir) => {
    const span = dir > 0 ? (s2 - s1 + n) % n : (s1 - s2 + n) % n;
    const verts = [];
    for (let j = 1; j <= n; j++) {
      const v = dir > 0 ? Math.floor(s1) + j : Math.ceil(s1) - j;
      const off = dir > 0 ? v - s1 : s1 - v;
      if (off >= span - 1e-9) break;
      if (off > 1e-9) verts.push(coords[((v % n) + n) % n]);
    }
    const path = [pointAt(coords, s1), ...verts, pointAt(coords, s2)];
    let len = 0;
    for (let k = 1; k < path.length; k++) len += metres(path[k - 1], path[k]);
    return { verts, len };
  };
  const fwd = walk(1), back = walk(-1);
  return (fwd.len <= back.len ? fwd : back).verts;
}
