import type { ReferenceData } from '../types.js';
import { CROPS, DISTRICTS, FERT, IRR, PESTS, RAIN_SHARE, SOIL_TAW, SOILS } from './reference.js';

export * from './reference.js';
export { DISTRICT_GEO } from './geo.js';

/** The built-in reference tables, in the shape the engine expects. Also the seed data for the database. */
export const REFERENCE: ReferenceData = {
  districts: DISTRICTS,
  soils: SOILS,
  soilTaw: SOIL_TAW,
  rainShare: RAIN_SHARE,
  irrigation: IRR,
  crops: CROPS,
  pests: PESTS,
  fertilisers: FERT,
};
