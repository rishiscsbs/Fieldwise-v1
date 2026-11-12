import { mandiSim } from '@fieldwise/shared';
import type { MandiProvider } from './types.js';

/** Deterministic 30-day prices around each crop's indicative price. The default source. */
export const simulator: MandiProvider = {
  id: 'simulated',
  simulated: true,
  historyDays: 30,
  async prices(crop, districtId, ref, now) {
    return mandiSim(crop, districtId, ref, now).map((m) => ({
      market: m.market,
      today: m.today,
      change: m.change,
      series: m.series,
      date: null,
    }));
  },
};
