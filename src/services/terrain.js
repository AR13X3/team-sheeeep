// Average slope & aspect of a paddock from the Copernicus 90 m DEM, served by
// Open-Meteo's elevation API (https://open-meteo.com/en/docs/elevation-api — free, no key).
//
// We sample elevations across the paddock (a central point plus each corner pulled 25%
// towards it) and fit a plane by least squares; the plane's gradient is the paddock's
// overall slope. Small paddocks also get points 100 m around the centre, because the DEM's
// 90 m cells can't resolve slope over shorter distances.
import { getJSON, round } from './http.js';
import { interiorPoint, offset } from '../logic/geometry.js';

const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const ASPECTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const MAX_CORNERS = 12;
const toMetres = (origin) => {
  const north = offset(origin, 0, 1)[0] - origin[0]; // degrees per metre
  const east = offset(origin, 1, 0)[1] - origin[1];
  return ([lat, lng]) => [(lng - origin[1]) / east, (lat - origin[0]) / north];
};

function samplePoints(coords) {
  const center = interiorPoint(coords);
  const step = Math.max(1, Math.ceil(coords.length / MAX_CORNERS));
  const inset = ([la, lo]) => [la + (center[0] - la) * 0.25, lo + (center[1] - lo) * 0.25];
  let corners = coords.filter((_, i) => i % step === 0);
  // simple shapes (e.g. rectangles): add edge midpoints so the fit sees more of the paddock
  if (coords.length <= 6) corners = coords.flatMap((c, i) => { const n = coords[(i + 1) % coords.length]; return [c, [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2]]; });
  corners = corners.map(inset);
  const pts = [center, ...corners];
  const xy = pts.map(toMetres(center));
  const span = Math.max(...xy.map(([x, y]) => Math.hypot(x, y)));
  if (span < 125) pts.push(offset(center, 0, 100), offset(center, 100, 0), offset(center, 0, -100), offset(center, -100, 0));
  return { center, pts };
}

/** Least-squares plane z = a + b·x + c·y; returns [b, c] (rise per metre east / north). */
function fitPlane(xyz) {
  let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (const [x, y, z] of xyz) {
    n++; sx += x; sy += y; sz += z; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z;
  }
  // centred normal equations for b and c
  const cxx = sxx - (sx * sx) / n, cyy = syy - (sy * sy) / n, cxy = sxy - (sx * sy) / n;
  const cxz = sxz - (sx * sz) / n, cyz = syz - (sy * sz) / n;
  const det = cxx * cyy - cxy * cxy;
  if (Math.abs(det) < 1e-9) return [0, 0];
  return [(cxz * cyy - cyz * cxy) / det, (cyz * cxx - cxz * cxy) / det];
}

/** @returns {Promise<{elevationM, reliefM, slopePct, aspect, samples, source}>} */
export async function fetchTerrain(coords) {
  const { center, pts } = samplePoints(coords);
  const qs = new URLSearchParams({
    latitude: pts.map((p) => round(p[0], 5)).join(','),
    longitude: pts.map((p) => round(p[1], 5)).join(','),
  });
  const json = await getJSON(`https://api.open-meteo.com/v1/elevation?${qs}`, {
    cacheKey: `terrain2:${hash(qs.toString())}`,
  });
  const z = json.elevation;
  const proj = toMetres(center);
  const [dzdx, dzdy] = fitPlane(pts.map((p, i) => [...proj(p), z[i]]));
  const slopePct = Math.hypot(dzdx, dzdy) * 100;
  // Aspect = direction the slope faces (downhill), as a compass bearing.
  const bearing = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI;
  const aspect = slopePct < 0.5 ? 'flat' : ASPECTS[Math.round(((bearing + 360) % 360) / 45) % 8];
  return {
    elevationM: z[0],
    reliefM: Math.max(...z) - Math.min(...z),
    slopePct,
    aspect,
    samples: pts.length,
    source: 'Copernicus DEM via Open-Meteo',
  };
}

export function describeSlope(pct) {
  if (pct == null) return '';
  if (pct < 1) return 'level';
  if (pct < 3) return 'gentle';
  if (pct < 8) return 'moderate';
  if (pct < 15) return 'steep';
  return 'very steep';
}
