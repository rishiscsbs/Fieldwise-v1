import type { Crop, FarmProfile, NutrientLevel, ReferenceData } from '../types.js';
import type { Reason } from './recommend.js';
import { lvlK, lvlN, lvlP } from './util.js';

type Product = 'urea' | 'dap' | 'mop';

export interface FertPlan {
  /** Soil test level for N, P, K */
  lv: NutrientLevel[];
  /** Adjusted dose, kg/ha of N, P2O5, K2O */
  ha: number[];
  /** Nutrient for the whole field, kg */
  perField: number[];
  /** Product needed, kg */
  kg: Record<Product, number>;
  bags: Record<Product, number>;
  /** ₹ */
  cost: number;
}

/** Urea / DAP / MOP for the field. Doses go up 25% where a nutrient is low and down 25% where it is high. */
export function fertPlan(
  c: Crop,
  p: Pick<FarmProfile, 'N' | 'P' | 'K' | 'area'>,
  ref: ReferenceData,
): FertPlan {
  const lv = [lvlN(+p.N), lvlP(+p.P), lvlK(+p.K)];
  const f = (l: NutrientLevel) => (l === 'low' ? 1.25 : l === 'high' ? 0.75 : 1);
  const ha = c.npk.map((v, i) => v * f(lv[i]!));
  const acres = +p.area || 1;
  const perField = ha.map((v) => (v * acres) / 2.471);
  const dap = perField[1]! / 0.46;
  const nFromDap = dap * 0.18;
  const urea = Math.max(0, perField[0]! - nFromDap) / 0.46;
  const mop = perField[2]! / 0.6;
  const kg: Record<Product, number> = { urea, dap, mop };
  const bags = {} as Record<Product, number>;
  let cost = 0;
  for (const k of ['urea', 'dap', 'mop'] as const) {
    // Math.max turns the legacy formula's -0 (tiny amounts) into 0, which Intl would print as "-0".
    bags[k] = Math.max(0, Math.ceil(kg[k] / ref.fertilisers[k].bag - 0.05));
    if (kg[k] < 1) bags[k] = 0;
    cost += bags[k] * ref.fertilisers[k].cost;
  }
  return { lv, ha, perField, kg, bags, cost };
}

/** When to apply each product. Pulses get everything at sowing; other crops split urea in three. */
export function fertSchedule(c: Crop, plan: FertPlan): Reason[] {
  const u = plan.kg.urea;
  const d = Math.round(plan.kg.dap);
  const m = Math.round(plan.kg.mop);
  if (c.leg) {
    const ur = Math.round(u);
    return [{ ok: true, key: ur > 0 ? 'basalLeg' : 'basalLeg_noUrea', args: { d, m, u: ur } }];
  }
  const third = Math.round(u / 3);
  return [
    { ok: true, key: 'basal', args: { u: third, d, m } },
    { ok: true, key: 'top1', args: { u: third } },
    { ok: true, key: 'top2', args: { u: third } },
  ];
}
