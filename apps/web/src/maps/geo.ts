// Tiny equirectangular projection, corrected for latitude so shapes are not stretched. Good enough at
// country and district scale; no map library or tile server needed.
export type LonLat = [number, number];
export type Bounds = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

export interface Projection {
  (p: LonLat): [number, number];
  width: number;
  height: number;
  /** Pixels per degree of longitude, useful to size things in km */
  kx: number;
}

/** Fits `bounds` into a box of `width`, returning a projection and the height that keeps the aspect. */
export function fit(bounds: Bounds, width: number, pad = 12, maxHeight = Infinity): Projection {
  const [x0, y0, x1, y1] = bounds;
  const cos = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const spanX = (x1 - x0) * cos;
  const spanY = y1 - y0;
  let k = (width - pad * 2) / spanX;
  let height = spanY * k + pad * 2;
  if (height > maxHeight) {
    k = (maxHeight - pad * 2) / spanY;
    height = maxHeight;
  }
  const offX = (width - spanX * k) / 2;
  const proj = (([lon, lat]: LonLat) => [offX + (lon - x0) * cos * k, pad + (y1 - lat) * k]) as Projection;
  proj.width = width;
  proj.height = height;
  proj.kx = cos * k;
  return proj;
}

/** SVG path for a set of rings. */
export const ringsPath = (rings: LonLat[][], p: (q: LonLat) => [number, number]) =>
  rings
    .map((r) => r.map((q, i) => `${i ? 'L' : 'M'}${p(q)[0].toFixed(1)},${p(q)[1].toFixed(1)}`).join('') + 'Z')
    .join('');

/** Bounds around points, padded by a fraction of their spread (and at least `minPad` degrees). */
export function boundsOf(points: LonLat[], padFrac = 0.15, minPad = 0.05): Bounds {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const px = Math.max(minPad, (x1 - x0) * padFrac);
  const py = Math.max(minPad, (y1 - y0) * padFrac);
  return [x0 - px, y0 - py, x1 + px, y1 + py];
}

/** Approximate distance in km for a span of longitude at a latitude. */
export const lonKm = (deg: number, lat: number) => deg * 111.32 * Math.cos((lat * Math.PI) / 180);
