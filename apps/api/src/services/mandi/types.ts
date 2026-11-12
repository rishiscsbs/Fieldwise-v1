import type { Crop, ReferenceData } from '@fieldwise/shared';

export interface MarketPrice {
  market: string;
  /** Latest modal price, ₹/quintal */
  today: number;
  /** 7-day change, %; null when the provider has no history */
  change: number | null;
  /** Daily prices, oldest first */
  series: number[];
  /** Date of the latest price (YYYY-MM-DD), when the provider reports one */
  date: string | null;
}

/** A source of mandi prices. Add a provider by implementing this and registering it in index.ts. */
export interface MandiProvider {
  id: 'simulated' | 'agmarknet';
  simulated: boolean;
  /** Days of history returned per market */
  historyDays: number;
  prices(crop: Crop, districtId: string, ref: ReferenceData, now: Date): Promise<MarketPrice[]>;
}
