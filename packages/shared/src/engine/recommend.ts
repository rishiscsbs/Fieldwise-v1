import type { Crop, FarmProfile, Labels, ReferenceData } from '../types.js';
import { lvlN } from './util.js';

/** A translatable reason. `key` is in the `advice` namespace; Labels args are picked per language. */
export interface Reason {
  ok: boolean;
  key: string;
  args?: Record<string, string | number | Labels>;
}

export interface CropScore {
  crop: Crop;
  score: number;
  reasons: Reason[];
}

export interface Recommendation {
  /** Crops that fit the season, best first */
  list: CropScore[];
  /** Crops not grown in this season */
  out: Crop[];
  /** Seasonal water available, mm (rain share + irrigation) */
  water: number;
  /** Mean season temperature, °C */
  temp: number;
}

export function seasonWater(p: FarmProfile, ref: ReferenceData): number {
  const D = ref.districts[p.district]!;
  return Math.round(D.rain * ref.rainShare[p.season]! + ref.irrigation[p.irrigation]!.mm);
}

/** Scores every in-season crop out of 100 on soil (25), pH (20), water (30), temperature (15) and nitrogen (10). */
export function recommend(p: FarmProfile, ref: ReferenceData): Recommendation {
  const D = ref.districts[p.district];
  if (!D) throw new Error(`Unknown district: ${p.district}`);
  const temp = D.temp[p.season];
  const water = seasonWater(p, ref);
  const soilLabel = ref.soils[p.soil] ?? { en: p.soil };
  const list: CropScore[] = [];
  const out: Crop[] = [];
  for (const c of ref.crops) {
    if (!c.s.includes(p.season)) {
      out.push(c);
      continue;
    }
    let sc = 0;
    const R: Reason[] = [];
    if (c.soil.includes(p.soil)) {
      sc += 25;
      R.push({ ok: true, key: 'r_soil', args: { s: soilLabel } });
    } else {
      sc += 8;
      R.push({ ok: false, key: 'r_soilx', args: { s: soilLabel } });
    }
    const ph = +p.ph;
    const [phLo, phHi] = c.ph as [number, number];
    if (ph >= phLo && ph <= phHi) {
      sc += 20;
      R.push({ ok: true, key: 'r_ph' });
    } else {
      const dd = ph < phLo ? phLo - ph : ph - phHi;
      sc += Math.max(0, 20 - dd * 14);
      R.push({ ok: false, key: 'r_phx', args: { lo: phLo, hi: phHi } });
    }
    const [wLo, wHi] = c.w as [number, number];
    let wf: number;
    if (water < wLo) {
      wf = Math.max(0, water / wLo);
      wf = wf * wf;
      R.push({ ok: false, key: 'r_wlow', args: { mm: water, need: wLo } });
    } else if (water > wHi * 1.6) {
      wf = 0.7;
      R.push({ ok: false, key: 'r_whigh' });
    } else {
      wf = 1;
      R.push({ ok: true, key: 'r_w', args: { mm: water } });
    }
    sc += 30 * wf;
    const [tLo, tHi] = c.t as [number, number];
    if (temp >= tLo && temp <= tHi) {
      sc += 15;
      R.push({ ok: true, key: 'r_t' });
    } else {
      const dd = temp < tLo ? tLo - temp : temp - tHi;
      sc += Math.max(0, 15 - dd * 3);
      R.push({ ok: false, key: 'r_tx', args: { tt: temp } });
    }
    if (c.leg) {
      sc += 10;
      R.push({ ok: true, key: 'r_leg' });
    } else if (lvlN(+p.N) === 'low' && c.npk[0]! >= 100) {
      sc += 6;
      R.push({ ok: false, key: 'r_nlow' });
    } else sc += 10;
    list.push({ crop: c, score: Math.round(Math.min(100, sc)), reasons: R });
  }
  list.sort((a, b) => b.score - a.score);
  return { list, out, water, temp };
}

/** The crop to plan for: the farmer's choice if it fits the season, otherwise the best match. */
export function activeCrop(p: FarmProfile, chosen: string | null | undefined, ref: ReferenceData): Crop {
  const c = chosen ? ref.crops.find((x) => x.id === chosen) : undefined;
  if (c && c.s.includes(p.season)) return c;
  const best = recommend(p, ref).list[0];
  if (!best) throw new Error(`No crop fits season ${p.season}`);
  return best.crop;
}
