/** Text in several languages. English is required and is the fallback for every other language. */
export interface Labels {
  en: string;
  [lang: string]: string | undefined;
}

export type Season = 'kharif' | 'rabi' | 'zaid';
export type NutrientLevel = 'low' | 'med' | 'high';

export interface District {
  name: Labels;
  /** Annual rainfall, mm */
  rain: number;
  /** Mean temperature per season, °C */
  temp: Record<Season, number>;
  soil: string;
  ph: number;
  /** Nearby mandis */
  mk: string[];
}

export interface IrrigationLevel {
  en: string;
  hi: string;
  [lang: string]: string | number | undefined;
  /** Seasonal irrigation water, mm */
  mm: number;
}

export interface Crop {
  id: string;
  e: string;
  n: Labels;
  s: string[];
  soil: string[];
  ph: number[];
  w: number[];
  t: number[];
  npk: number[];
  kc: number;
  d: string;
  y: number;
  msp: number | null;
  p: number;
  leg: number;
}

export interface Pest {
  id: string;
  n: Labels;
  /** Crop ids; '*' means any crop */
  c: string[];
  /** Symptom ids */
  s: string[];
  o: Labels;
  ch: Labels;
  pv: Labels;
}

export interface Fertiliser {
  n: Labels;
  bag: number;
  cost: number;
  col: string;
}

/** Everything the engine needs to know about one field. */
export interface FarmProfile {
  district: string;
  season: Season;
  soil: string;
  irrigation: string;
  ph: number;
  N: number;
  P: number;
  K: number;
  area: number;
}

/** Reference tables the engine reads. The API passes data loaded from the database; tests pass the seed data. */
export interface ReferenceData {
  districts: Record<string, District>;
  soils: Record<string, Labels>;
  soilTaw: Record<string, number>;
  rainShare: Record<string, number>;
  irrigation: Record<string, IrrigationLevel>;
  crops: Crop[];
  pests: Pest[];
  fertilisers: Record<'urea' | 'dap' | 'mop', Fertiliser>;
}
