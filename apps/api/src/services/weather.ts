// 7-day district forecast from Open-Meteo (free, no key), cached for an hour in the database.
// If Open-Meteo cannot be reached, the deterministic simulator is used and the response says so.
import {
  forecastSim,
  type ForecastDay,
  type ForecastDto,
  type ReferenceData,
  type Season,
} from '@fieldwise/shared';
import { z } from 'zod';
import { prisma } from '../db.js';

export const CACHE_MS = 60 * 60_000;
/** After a failed fetch, wait this long before trying Open-Meteo again. */
const RETRY_MS = 5 * 60_000;
const TIMEOUT_MS = 6_000;
const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

const OpenMeteoDaily = z.object({
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()),
    relative_humidity_2m_mean: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number().nullable()),
  }),
});

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const lastFailure = new Map<string, number>();

export function openMeteoUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'relative_humidity_2m_mean',
      'wind_speed_10m_max',
    ].join(','),
    timezone: 'Asia/Kolkata',
    forecast_days: '7',
  });
  return `${URL_BASE}?${q}`;
}

/** Maps Open-Meteo's daily arrays onto the engine's ForecastDay, rounding like the simulator does. */
export function parseOpenMeteo(body: unknown): ForecastDay[] {
  const d = OpenMeteoDaily.parse(body).daily;
  const n = (v: number | null | undefined, fallback = 0) => Math.round(v ?? fallback);
  return d.time.map((date, i) => ({
    date,
    tmax: n(d.temperature_2m_max[i]),
    tmin: n(d.temperature_2m_min[i]),
    rp: n(d.precipitation_probability_max[i]),
    rain: n(d.precipitation_sum[i]),
    hum: n(d.relative_humidity_2m_mean[i]),
    wind: n(d.wind_speed_10m_max[i]),
  }));
}

export async function getForecast(
  districtId: string,
  season: Season,
  ref: ReferenceData,
  opts: { now?: Date; fetchImpl?: FetchLike } = {},
): Promise<ForecastDto> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
  const district = await prisma.district.findUnique({ where: { id: districtId } });
  if (!district) throw new Error(`Unknown district ${districtId}`);

  const cached = await prisma.weatherCache.findUnique({ where: { districtId } });
  if (cached && now.getTime() - cached.fetchedAt.getTime() < CACHE_MS) {
    return live(districtId, cached.fetchedAt, JSON.parse(cached.payload) as ForecastDay[]);
  }

  const failedAt = lastFailure.get(districtId);
  if (!failedAt || now.getTime() - failedAt > RETRY_MS) {
    try {
      const res = await fetchImpl(openMeteoUrl(district.lat, district.lon), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const days = parseOpenMeteo(await res.json());
      if (days.length < 7) throw new Error('Open-Meteo returned fewer than 7 days');
      await prisma.weatherCache.upsert({
        where: { districtId },
        create: { districtId, source: 'open-meteo', fetchedAt: now, payload: JSON.stringify(days) },
        update: { source: 'open-meteo', fetchedAt: now, payload: JSON.stringify(days) },
      });
      lastFailure.delete(districtId);
      return live(districtId, now, days);
    } catch {
      lastFailure.set(districtId, now.getTime());
    }
  }

  return {
    districtId,
    source: 'simulated',
    simulated: true,
    fetchedAt: now.toISOString(),
    days: forecastSim(districtId, season, ref, now),
  };
}

const live = (districtId: string, fetchedAt: Date, days: ForecastDay[]): ForecastDto => ({
  districtId,
  source: 'open-meteo',
  simulated: false,
  fetchedAt: fetchedAt.toISOString(),
  days,
});

/** Test helper: forget remembered failures. */
export function resetWeatherFailures(): void {
  lastFailure.clear();
}
