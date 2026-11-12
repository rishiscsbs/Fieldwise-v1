import { marketAdvice, type Crop, type MandiDto, type ReferenceData } from '@fieldwise/shared';
import { env } from '../../env.js';
import { agmarknet } from './agmarknet.js';
import { simulator } from './simulator.js';
import type { MandiProvider } from './types.js';

/** Agmarknet when a key is configured, otherwise the simulator. */
export const defaultProvider: MandiProvider = env.AGMARKNET_API_KEY
  ? agmarknet(env.AGMARKNET_API_KEY)
  : simulator;

/**
 * Prices and sell/hold advice for a crop in a district. If the live provider fails or has no data
 * for this crop, falls back to the simulator so the screen still works, and says so in `source`.
 */
export async function getMandi(
  crop: Crop,
  districtId: string,
  ref: ReferenceData,
  opts: { now?: Date; provider?: MandiProvider } = {},
): Promise<MandiDto> {
  const now = opts.now ?? new Date();
  let provider = opts.provider ?? defaultProvider;
  let markets = await provider.prices(crop, districtId, ref, now).catch(() => []);
  if (!markets.length && provider !== simulator) {
    provider = simulator;
    markets = await simulator.prices(crop, districtId, ref, now);
  }
  const advice = markets.length
    ? marketAdvice(
        markets.map((m) => ({ market: m.market, today: m.today, change: m.change ?? 0 })),
        crop,
      )
    : null;
  return {
    districtId,
    cropId: crop.id,
    source: { id: provider.id, simulated: provider.simulated, historyDays: provider.historyDays },
    fetchedAt: now.toISOString(),
    msp: crop.msp,
    markets,
    advice: advice && {
      key: advice.key,
      bestMarket: advice.best.market,
      bestPrice: advice.best.today,
      avgChange: advice.avgChange,
    },
  };
}

export type { MandiProvider } from './types.js';
