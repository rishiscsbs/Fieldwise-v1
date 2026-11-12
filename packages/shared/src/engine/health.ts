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

/**
 * Colour proportions of a leaf photo from RGBA pixel data. This is a colour screen, not a trained
 * disease model: very dark and unsaturated background pixels are skipped, the rest are bucketed by hue.
 */
export function leafColours(rgba: ArrayLike<number>): LeafColours {
  let g = 0;
  let y = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]! / 255;
    const gg = rgba[i + 1]! / 255;
    const bb = rgba[i + 2]! / 255;
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
    if (v < 0.12) continue;
    if (s < 0.15 && v > 0.78) {
      w++;
      continue;
    }
    if (s < 0.18) continue;
    if (h >= 70 && h <= 170) g++;
    else if (h >= 42 && h < 70 && v > 0.4) y++;
    else b++;
  }
  const tot = g + y + b + w || 1;
  return { green: (g / tot) * 100, yellow: (y / tot) * 100, brown: (b / tot) * 100, white: (w / tot) * 100 };
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
