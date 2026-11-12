// Weather and mandi services with injected HTTP, so no test touches the network.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE, forecastSim } from '@fieldwise/shared';
import { prisma } from '../src/db.js';
import { getMandi } from '../src/services/mandi/index.js';
import { agmarknet, parseAgmarknet } from '../src/services/mandi/agmarknet.js';
import { simulator } from '../src/services/mandi/simulator.js';
import {
  getForecast,
  parseOpenMeteo,
  resetWeatherFailures,
  type FetchLike,
} from '../src/services/weather.js';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const ok =
  (body: unknown): FetchLike =>
  async () => ({ ok: true, status: 200, json: async () => body });
const counting = (inner: FetchLike) => {
  const f = (async (url, init) => {
    f.calls++;
    return inner(url, init);
  }) as FetchLike & { calls: number };
  f.calls = 0;
  return f;
};

describe('weather', () => {
  beforeEach(async () => {
    resetWeatherFailures();
    await prisma.weatherCache.deleteMany({ where: { districtId: 'indore' } });
  });

  it('parses a recorded Open-Meteo response', () => {
    const days = parseOpenMeteo(fixture('open-meteo-nagpur.json'));
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-11-12', tmax: 30, tmin: 20, rp: 0, rain: 0, hum: 47, wind: 8 });
  });

  it('fetches once, then serves the cache for an hour', async () => {
    const f = counting(ok(fixture('open-meteo-nagpur.json')));
    const now = new Date('2026-11-12T06:00:00Z');
    const a = await getForecast('indore', 'rabi', REFERENCE, { now, fetchImpl: f });
    const b = await getForecast('indore', 'rabi', REFERENCE, {
      now: new Date(now.getTime() + 30 * 60_000),
      fetchImpl: f,
    });
    expect(a.source).toBe('open-meteo');
    expect(b.days).toEqual(a.days);
    expect(f.calls).toBe(1);
    await getForecast('indore', 'rabi', REFERENCE, {
      now: new Date(now.getTime() + 61 * 60_000),
      fetchImpl: f,
    });
    expect(f.calls).toBe(2);
  });

  it('falls back to the simulator and labels it, then waits before retrying', async () => {
    const f = counting(async () => {
      throw new Error('offline');
    });
    const now = new Date(2026, 10, 12, 12);
    const r = await getForecast('indore', 'rabi', REFERENCE, { now, fetchImpl: f });
    expect(r).toMatchObject({ source: 'simulated', simulated: true });
    expect(r.days).toEqual(forecastSim('indore', 'rabi', REFERENCE, now));
    await getForecast('indore', 'rabi', REFERENCE, { now: new Date(now.getTime() + 60_000), fetchImpl: f });
    expect(f.calls).toBe(1);
  });

  it('treats an HTTP error or a malformed body as a failure', async () => {
    const bad: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ daily: { time: [] } }),
    });
    expect((await getForecast('indore', 'zaid', REFERENCE, { fetchImpl: bad })).simulated).toBe(true);
  });
});

describe('mandi', () => {
  const cotton = REFERENCE.crops.find((c) => c.id === 'cotton')!;

  it('keeps the latest positive price per market from Agmarknet', () => {
    const prices = parseAgmarknet(fixture('agmarknet-sample.json'));
    expect(prices).toEqual([
      { market: 'Nagpur', today: 7420, change: null, series: [7420], date: '2026-11-12' },
      { market: 'Katol', today: 7280, change: null, series: [7280], date: '2026-11-12' },
    ]);
  });

  it('sends the key and filters to data.gov.in and labels the source as live', async () => {
    let seen = '';
    const provider = agmarknet('test-key', async (url) => {
      seen = url;
      return { ok: true, status: 200, json: async () => fixture('agmarknet-sample.json') };
    });
    const r = await getMandi(cotton, 'nagpur', REFERENCE, { provider });
    expect(seen).toContain('api-key=test-key');
    expect(decodeURIComponent(seen)).toContain('filters[commodity]=Cotton');
    expect(r.source).toEqual({ id: 'agmarknet', simulated: false, historyDays: 1 });
    expect(r.advice).toMatchObject({ key: 'belowMsp', bestMarket: 'Nagpur' });
  });

  it('falls back to the simulator when the live source has nothing', async () => {
    const provider = agmarknet('k', ok({ records: [] }));
    const r = await getMandi(cotton, 'nagpur', REFERENCE, { provider });
    expect(r.source.id).toBe('simulated');
    expect(r.markets).toHaveLength(4);
  });

  it('uses the simulator by default when no key is set', async () => {
    const r = await getMandi(cotton, 'nagpur', REFERENCE);
    expect(r.source.id).toBe(simulator.id);
  });
});
