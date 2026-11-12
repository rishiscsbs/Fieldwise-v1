import type { Pest } from '../types.js';

export interface PestMatch {
  pest: Pest;
  /** Match, % (Dice coefficient of symptoms; generic causes weighted 0.8) */
  score: number;
}

/** Top three likely pests or diseases for a crop and the symptoms seen. */
export function matchPests(crop: string, symptoms: string[], pests: Pest[]): PestMatch[] {
  return pests
    .filter((p) => p.c.includes(crop) || p.c.includes('*'))
    .map((p) => {
      const m = p.s.filter((s) => symptoms.includes(s)).length;
      let sc = (2 * m) / (p.s.length + symptoms.length);
      if (p.c.includes('*')) sc *= 0.8;
      return { pest: p, score: Math.round(sc * 100) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export interface LeafColours {
  /** Share of leaf pixels, % */
  green: number;
  yellow: number;
  brown: number;
  white: number;
}

export type LeafPixel = 'green' | 'yellow' | 'brown' | 'white';

/** Classifies one pixel (0–255 channels) by hue; null for background (very dark or grey). */
export function classifyLeafPixel(red: number, green: number, blue: number): LeafPixel | null {
  const r = red / 255;
  const gg = green / 255;
  const bb = blue / 255;
  const mx = Math.max(r, gg, bb);
  const mn = Math.min(r, gg, bb);
  const v = mx;
  const s = mx ? (mx - mn) / mx : 0;
  let h = 0;
  if (mx !== mn) {
    h =
      mx === r
        ? ((gg - bb) / (mx - mn)) % 6
        : mx === gg
          ? (bb - r) / (mx - mn) + 2
          : (r - gg) / (mx - mn) + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (v < 0.12) return null;
  if (s < 0.15 && v > 0.78) return 'white';
  if (s < 0.18) return null;
  if (h >= 70 && h <= 170) return 'green';
  if (h >= 42 && h < 70 && v > 0.4) return 'yellow';
  return 'brown';
}

/**
 * Colour proportions of a leaf photo from RGBA pixel data. This is a colour screen, not a trained
 * disease model: very dark and unsaturated background pixels are skipped, the rest are bucketed by hue.
 */
export function leafColours(rgba: ArrayLike<number>): LeafColours {
  const n = { green: 0, yellow: 0, brown: 0, white: 0 };
  for (let i = 0; i < rgba.length; i += 4) {
    const k = classifyLeafPixel(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    if (k) n[k]++;
  }
  const tot = n.green + n.yellow + n.brown + n.white || 1;
  return {
    green: (n.green / tot) * 100,
    yellow: (n.yellow / tot) * 100,
    brown: (n.brown / tot) * 100,
    white: (n.white / tot) * 100,
  };
}

export interface LeafRegion {
  /** Normalised 0–1 box */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: Exclude<LeafPixel, 'green'>;
}

/**
 * Grid cells where off-colour pixels dominate the leaf, for highlighting on the photo.
 * A cell counts when at least 20% of it is leaf and 40% of that leaf is one problem colour.
 */
export function leafRegions(rgba: ArrayLike<number>, width: number, height: number, grid = 8): LeafRegion[] {
  const cells = Array.from({ length: grid * grid }, () => ({
    leaf: 0,
    yellow: 0,
    brown: 0,
    white: 0,
    all: 0,
  }));
  for (let y = 0; y < height; y++) {
    const cy = Math.min(grid - 1, Math.floor((y / height) * grid));
    for (let x = 0; x < width; x++) {
      const cell = cells[cy * grid + Math.min(grid - 1, Math.floor((x / width) * grid))]!;
      const i = (y * width + x) * 4;
      cell.all++;
      const k = classifyLeafPixel(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      if (!k) continue;
      cell.leaf++;
      if (k !== 'green') cell[k]++;
    }
  }
  const out: LeafRegion[] = [];
  cells.forEach((c, idx) => {
    if (!c.all || c.leaf / c.all < 0.2) return;
    const kinds = (['brown', 'yellow', 'white'] as const).filter((k) => c[k] / c.leaf >= 0.4);
    const kind = kinds.sort((a, b) => c[b] - c[a])[0];
    if (kind)
      out.push({ x: (idx % grid) / grid, y: Math.floor(idx / grid) / grid, w: 1 / grid, h: 1 / grid, kind });
  });
  return out;
}

/** What the colours suggest, as advice keys, and which symptoms to tick. */
export function leafFindings(c: LeafColours): { keys: string[]; symptoms: string[] } {
  const keys: string[] = [];
  const symptoms: string[] = [];
  if (c.yellow > 20) {
    keys.push('ph_y');
    symptoms.push('yellow');
  }
  if (c.brown > 12) {
    keys.push('ph_b');
    symptoms.push('spots');
  }
  if (c.white > 10 && c.green > 20) {
    keys.push('ph_w');
    symptoms.push('powder');
  }
  if (!keys.length) keys.push('ph_ok');
  return { keys, symptoms };
}
