import type { Crop, ReferenceData, Season } from '../types.js';
import { hash, rng, ymd } from './util.js';

export interface ForecastDay {
  /** YYYY-MM-DD, local */
  date: string;
  tmax: number;
  tmin: number;
  /** Rain probability, % */
  rp: number;
  /** Rain, mm */
  rain: number;
  /** Relative humidity, % */
  hum: number;
  /** Wind, km/h */
  wind: number;
}

/** Simulated 7-day forecast, deterministic per district and day. Used when the live forecast is unavailable. */
export function forecastSim(
  district: string,
  season: Season,
  ref: ReferenceData,
  today: Date,
): ForecastDay[] {
  const D = ref.districts[district];
  if (!D) throw new Error(`Unknown district: ${district}`);
  const base = D.temp[season];
  const r = rng(hash(district + today.toDateString()));
  const rainBase = { kharif: 0.55, rabi: 0.12, zaid: 0.15 }[season];
  const out: ForecastDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const tmax = Math.round(base + 5 + (r() * 4 - 2));
    const tmin = Math.round(base - 6 + (r() * 4 - 2));
    const rp = Math.round(Math.min(95, Math.max(3, (rainBase + (r() - 0.5) * 0.5) * 100)));
    const rain =
      r() * 100 < rp ? Math.round((season === 'kharif' ? 6 : 2) + r() * (season === 'kharif' ? 30 : 10)) : 0;
    const hum = Math.round(Math.min(98, (season === 'kharif' ? 72 : 48) + r() * 20 + (rain ? 10 : 0)));
    const wind = Math.round(5 + r() * 16);
    out.push({ date: ymd(d), tmax, tmin, rp, rain, hum, wind });
  }
  return out;
}

export interface WaterDay {
  /** Reference evapotranspiration (Hargreaves), mm */
  et0: number;
  /** Crop water use, mm */
  etc: number;
  /** Soil water deficit at end of day, mm */
  def: number;
  /** Irrigation to apply, mm (0 = none) */
  irr: number;
  /** Safe to spray: low rain chance, low wind, no rain */
  spray: boolean;
}

/** Daily soil-water balance. Suggests irrigation once the deficit reaches the soil's safe limit. */
export function waterPlan(
  fc: Pick<ForecastDay, 'tmax' | 'tmin' | 'rain' | 'rp' | 'wind'>[],
  c: Crop,
  soil: string,
  ref: ReferenceData,
): { days: WaterDay[]; thr: number } {
  const thr = ref.soilTaw[soil]!;
  let def = thr * 0.55;
  const days: WaterDay[] = [];
  for (const f of fc) {
    const tm = (f.tmax + f.tmin) / 2;
    const et0 = 0.0023 * (tm + 17.8) * Math.sqrt(Math.max(1, f.tmax - f.tmin)) * 14;
    const etc = c.kc * et0;
    def = Math.max(0, def + etc - 0.8 * f.rain);
    let irr = 0;
    if (def >= thr) {
      irr = Math.round(def / 5) * 5;
      def = 0;
    }
    days.push({ et0, etc, def, irr, spray: f.rp < 40 && f.wind < 15 && f.rain === 0 });
  }
  return { days, thr };
}

/** Three or more humid, mild days in a row means high fungal disease risk. */
export function fungalRisk(fc: Pick<ForecastDay, 'hum' | 'tmax' | 'tmin'>[]): boolean {
  let run = 0;
  let maxRun = 0;
  for (const f of fc) {
    if (f.hum >= 80 && f.tmax <= 33 && f.tmin >= 15) {
      run++;
      maxRun = Math.max(maxRun, run);
    } else run = 0;
  }
  return maxRun >= 3;
}
