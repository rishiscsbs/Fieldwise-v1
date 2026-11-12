import type { Crop, ReferenceData } from '../types.js';
import { hash, rng } from './util.js';

export interface MandiSeries {
  market: string;
  /** Daily price, ₹/quintal, oldest first (30 days) */
  series: number[];
  /** Latest price, ₹/quintal */
  today: number;
  /** Change over the last 7 days, % */
  change: number;
}

/** Simulated 30-day prices in the district's nearby mandis, deterministic per crop, district and day. */
export function mandiSim(c: Crop, district: string, ref: ReferenceData, today: Date): MandiSeries[] {
  const D = ref.districts[district];
  if (!D) throw new Error(`Unknown district: ${district}`);
  const r = rng(hash(c.id + district + today.toDateString().slice(4, 10)));
  const drift = (r() - 0.45) * 0.006;
  return D.mk.map((m) => {
    const f = 1 + (r() - 0.5) * 0.08;
    let p = c.p * f * (1 - drift * 30);
    const s: number[] = [];
    for (let k = 0; k < 30; k++) {
      p = p * (1 + drift + (r() - 0.5) * 0.018);
      s.push(p);
    }
    return { market: m, series: s, today: s[29]!, change: ((s[29]! - s[22]!) / s[22]!) * 100 };
  });
}

export type MarketAdviceKey = 'rising' | 'falling' | 'stable' | 'belowMsp';

type MarketPoint = Pick<MandiSeries, 'market' | 'today' | 'change'>;

/** Sell or hold advice from the average 7-day change, overridden when the best price is below MSP. */
export function marketAdvice(
  md: MarketPoint[],
  c: Pick<Crop, 'msp'>,
): { key: MarketAdviceKey; best: MarketPoint; avgChange: number } {
  const best = md.reduce((a, b) => (b.today > a.today ? b : a));
  const avgChange = md.reduce((s, x) => s + x.change, 0) / md.length;
  let key: MarketAdviceKey = avgChange > 2 ? 'rising' : avgChange < -2 ? 'falling' : 'stable';
  if (c.msp && best.today < c.msp) key = 'belowMsp';
  return { key, best, avgChange };
}
