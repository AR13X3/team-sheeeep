// Geodesy helpers for paddock polygons given as [[lat, lng], ...].
// Paddocks are small, so a local projection using the WGS84 ellipsoid's radii of
// curvature at the paddock's latitude is accurate to ~0.01% (checked against geographiclib).
const A = 6378137; // WGS84 semi-major axis (m)
const E2 = 0.00669437999014; // WGS84 first eccentricity squared
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Metres per radian north (meridian) and east (prime vertical × cos φ) at a latitude. */
function radii(lat) {
  const s = Math.sin(rad(lat));
  const w = 1 - E2 * s * s;
  return { north: (A * (1 - E2)) / Math.pow(w, 1.5), east: (A / Math.sqrt(w)) * Math.cos(rad(lat)) };
}

function project(coords) {
  const lat0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const { north, east } = radii(lat0);
  const fwd = ([lat, lng]) => [rad(lng - lng0) * east, rad(lat - lat0) * north];
  const inv = ([x, y]) => [lat0 + deg(y / north), lng0 + deg(x / east)];
  return { pts: coords.map(fwd), fwd, inv };
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a / 2;
}

/** Area in hectares. */
export function areaHa(coords) {
  if (!coords || coords.length < 3) return 0;
  return Math.abs(signedArea(project(coords).pts)) / 10000;
}

/** Area-weighted centroid as [lat, lng]. */
export function centroid(coords) {
  const { pts, inv } = project(coords);
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) return inv(pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]));
  let cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    cx += (pts[j][0] + pts[i][0]) * f;
    cy += (pts[j][1] + pts[i][1]) * f;
  }
  return inv([cx / (6 * a), cy / (6 * a)]);
}

/** Offset a point by metres east (dx) and north (dy). */
export function offset([lat, lng], dx, dy) {
  const { north, east } = radii(lat);
  return [lat + deg(dy / north), lng + deg(dx / east)];
}

/** Ray-casting point-in-polygon test (pt and polygon in [lat, lng]). */
export function pointInPolygon([lat, lng], coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [yi, xi] = coords[i], [yj, xj] = coords[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A point guaranteed to be inside the paddock, as central as practical.
 * The centroid of a U- or crescent-shaped paddock can fall outside it, which would
 * sample soil, slope and climate from the neighbour's land.
 */
export function interiorPoint(coords) {
  const c = centroid(coords);
  if (pointInPolygon(c, coords)) return c;
  const { pts, fwd, inv } = project(coords);
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  let best = null;
  // Try horizontal scanlines, starting at the centroid's latitude, and keep the widest
  // stretch of the paddock found; its midpoint is well inside.
  const c0 = fwd(c)[1];
  const lines = [c0, ...Array.from({ length: 15 }, (_, i) => lo + ((i + 1) / 16) * (hi - lo))];
  for (const y of lines) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const w = xs[k + 1] - xs[k];
      // prefer wide stretches near the centroid's latitude
      const score = w - Math.abs(y - c0) * 0.25;
      if (!best || score > best.score) best = { score, pt: [(xs[k] + xs[k + 1]) / 2, y] };
    }
  }
  return best ? inv(best.pt) : c;
}

/** True when the outline crosses itself (e.g. corners clicked out of order). */
export function selfIntersects(coords) {
  const n = coords.length;
  if (n < 4) return false;
  const { pts } = project(coords);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hit = (p1, p2, p3, p4) => {
    const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbouring edges share a corner
      if (hit(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

// Sutherland–Hodgman clip of a polygon against the half-plane n·p >= d.
function clipHalfPlane(pts, n, d) {
  const out = [];
  const inside = (p) => n[0] * p[0] + n[1] * p[1] >= d;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (d - (n[0] * a[0] + n[1] * a[1])) / (n[0] * (b[0] - a[0]) + n[1] * (b[1] - a[1]));
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/**
 * Splits a paddock in two across its long axis (through the centroid).
 * Used to compare soil at either end of a paddock.
 */
export function splitAcrossLongAxis(coords) {
  const { pts, inv, fwd } = project(coords);
  const c = fwd(centroid(coords));
  // Principal axis from the covariance of the vertices.
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    const x = p[0] - c[0], y = p[1] - c[1];
    sxx += x * x; syy += y * y; sxy += x * y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const n = [Math.cos(theta), Math.sin(theta)]; // normal of the cut = long axis direction
  const d = n[0] * c[0] + n[1] * c[1];
  const a = clipHalfPlane(pts, n, d);
  const b = clipHalfPlane(pts, [-n[0], -n[1]], -d);
  return [a, b].filter((h) => h.length >= 3).map((h) => h.map(inv));
}

export const formatHa = (ha) => (ha >= 100 ? ha.toFixed(0) : ha >= 10 ? ha.toFixed(1) : ha.toFixed(2));
