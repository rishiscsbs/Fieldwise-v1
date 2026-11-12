import type { Labels, NutrientLevel } from '../types.js';

/** Soil Health Card thresholds (kg/ha). */
export const lvlN = (v: number): NutrientLevel => (v < 280 ? 'low' : v > 560 ? 'high' : 'med');
export const lvlP = (v: number): NutrientLevel => (v < 10 ? 'low' : v > 25 ? 'high' : 'med');
export const lvlK = (v: number): NutrientLevel => (v < 110 ? 'low' : v > 280 ? 'high' : 'med');

/** FNV-1a string hash. Deterministic seed for simulated data. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 RNG, so simulated data is stable for a given day + district. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one language from a labels object, falling back to English. */
export const pick = (labels: Labels | null | undefined, lang: string): string =>
  labels == null ? '' : (labels[lang] ?? labels.en);

/** Local calendar date as YYYY-MM-DD. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Season for a date: Jun–Sep kharif, Oct–Feb rabi, Mar–May zaid. */
export function seasonFor(d: Date): 'kharif' | 'rabi' | 'zaid' {
  const mo = d.getMonth();
  return mo >= 5 && mo <= 8 ? 'kharif' : mo >= 9 || mo <= 1 ? 'rabi' : 'zaid';
}
