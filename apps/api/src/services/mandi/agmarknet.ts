// Agmarknet daily mandi prices via the data.gov.in API. Enabled only when AGMARKNET_API_KEY is set.
// The resource reports the latest day per market, so there is no history: change is null and series has one point.
// Docs: https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
import { z } from 'zod';
import type { FetchLike } from '../weather.js';
import type { MandiProvider, MarketPrice } from './types.js';

const RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_MS = 60 * 60_000;
const TIMEOUT_MS = 8_000;

/** Agmarknet commodity names for our crop ids. */
export const COMMODITY: Record<string, string> = {
  rice: 'Paddy(Dhan)(Common)',
  wheat: 'Wheat',
  maize: 'Maize',
  cotton: 'Cotton',
  sugarcane: 'Sugarcane',
  soybean: 'Soyabean',
  groundnut: 'Groundnut',
  chickpea: 'Bengal Gram(Gram)(Whole)',
  mustard: 'Mustard',
  tur: 'Arhar (Tur/Red Gram)(Whole)',
  moong: 'Green Gram (Moong)(Whole)',
  bajra: 'Bajra(Pearl Millet/Cumbu)',
  tomato: 'Tomato',
  potato: 'Potato',
};

/** Agmarknet state and district names for our district ids. */
export const PLACE: Record<string, { state: string; district: string }> = {
  ludhiana: { state: 'Punjab', district: 'Ludhiana' },
  nagpur: { state: 'Maharashtra', district: 'Nagpur' },
  cuttack: { state: 'Odisha', district: 'Cuttack' },
  jodhpur: { state: 'Rajasthan', district: 'Jodhpur' },
  dharwad: { state: 'Karnataka', district: 'Dharwad' },
  varanasi: { state: 'Uttar Pradesh', district: 'Varanasi' },
  indore: { state: 'Madhya Pradesh', district: 'Indore' },
  coimbatore: { state: 'Tamil Nadu', district: 'Coimbatore' },
  bardhaman: { state: 'West Bengal', district: 'Purba Bardhaman' },
  rajkot: { state: 'Gujarat', district: 'Rajkot' },
};

const Record_ = z.object({
  market: z.string(),
  arrival_date: z.string(),
  modal_price: z.union([z.string(), z.number()]),
});
const Body = z.object({ records: z.array(Record_.passthrough()) });

/** dd/mm/yyyy → yyyy-mm-dd */
const isoDate = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

/** Latest modal price per market. Exported for tests. */
export function parseAgmarknet(body: unknown): MarketPrice[] {
  const latest = new Map<string, MarketPrice>();
  for (const r of Body.parse(body).records) {
    const price = Number(r.modal_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const date = isoDate(r.arrival_date);
    const prev = latest.get(r.market);
    if (!prev || (prev.date ?? '') < date) {
      latest.set(r.market, { market: r.market, today: price, change: null, series: [price], date });
    }
  }
  return [...latest.values()].sort((a, b) => b.today - a.today);
}

export function agmarknet(
  apiKey: string,
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
): MandiProvider {
  const cache = new Map<string, { at: number; prices: MarketPrice[] }>();
  return {
    id: 'agmarknet',
    simulated: false,
    historyDays: 1,
    async prices(crop, districtId, _ref, now) {
      const commodity = COMMODITY[crop.id];
      const place = PLACE[districtId];
      if (!commodity || !place) return [];
      const key = `${crop.id}:${districtId}`;
      const hit = cache.get(key);
      if (hit && now.getTime() - hit.at < CACHE_MS) return hit.prices;
      const q = new URLSearchParams({
        'api-key': apiKey,
        format: 'json',
        limit: '100',
        'filters[state.keyword]': place.state,
        'filters[district]': place.district,
        'filters[commodity]': commodity,
      });
      const res = await fetchImpl(`https://api.data.gov.in/resource/${RESOURCE}?${q}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Agmarknet HTTP ${res.status}`);
      const prices = parseAgmarknet(await res.json());
      cache.set(key, { at: now.getTime(), prices });
      return prices;
    },
  };
}
