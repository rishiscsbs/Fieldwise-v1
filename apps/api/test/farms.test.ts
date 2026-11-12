import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REFERENCE, activeCrop, fertPlan, recommend } from '@fieldwise/shared';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { login, type Session } from './helpers.js';

let app: App;
let farmer: Session;
let other: Session;
let officer: Session;
let homeFarmId: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, authRateLimit: 1000, realtime: false });
  farmer = await login(app, DEMO_ACCOUNTS[0].phone);
  officer = await login(app, DEMO_ACCOUNTS[1].phone);
  const gurpreet = await prisma.user.findFirstOrThrow({ where: { name: 'Gurpreet Singh' } });
  other = await login(app, gurpreet.phone);
  homeFarmId = (
    await prisma.farm.findFirstOrThrow({ where: { ownerId: farmer.user.id, name: 'Home field' } })
  ).id;
  // Keep advisory tests offline: a fresh cached forecast means Open-Meteo is not called.
  await prisma.weatherCache.upsert({
    where: { districtId: 'nagpur' },
    create: {
      districtId: 'nagpur',
      source: 'open-meteo',
      fetchedAt: new Date(),
      payload: JSON.stringify(sampleDays()),
    },
    update: { fetchedAt: new Date(), payload: JSON.stringify(sampleDays()) },
  });
});
afterAll(async () => {
  await app.close();
});

function sampleDays() {
  return Array.from({ length: 7 }, (_, i) => ({
    date: `2026-11-${String(12 + i).padStart(2, '0')}`,
    tmax: 31,
    tmin: 18,
    rp: i === 3 ? 70 : 10,
    rain: i === 3 ? 12 : 0,
    hum: 55,
    wind: 9,
  }));
}

const get = (s: Session, url: string) => app.inject({ method: 'GET', url, headers: s.auth });

describe('reference', () => {
  it('serves every table with labels, no sign-in needed', async () => {
    const r = (await app.inject({ method: 'GET', url: '/api/reference' })).json();
    expect(r.crops).toHaveLength(REFERENCE.crops.length);
    expect(r.districts).toHaveLength(10);
    expect(r.districts.find((d: { id: string }) => d.id === 'nagpur').markets).toEqual(
      REFERENCE.districts.nagpur!.mk,
    );
    expect(r.symptoms[0].id).toBe('yellow');
    expect(r.seasons.map((s: { id: string }) => s.id)).toEqual(['kharif', 'rabi', 'zaid']);
  });
});

describe('farms', () => {
  it('lists only your own farms', async () => {
    const farms = (await get(farmer, '/api/farms')).json();
    expect(farms.length).toBeGreaterThan(0);
    expect(farms.every((f: { latestSoilTest: unknown }) => f.latestSoilTest)).toBe(true);
    const owners = await prisma.farm.findMany({
      where: { id: { in: farms.map((f: { id: string }) => f.id) } },
    });
    expect(owners.every((f) => f.ownerId === farmer.user.id)).toBe(true);
  });

  it('hides other farmers’ farms but lets the district officer read them', async () => {
    expect((await get(other, `/api/farms/${homeFarmId}`)).statusCode).toBe(404);
    const r = await get(officer, `/api/farms/${homeFarmId}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().soilTests.length).toBeGreaterThanOrEqual(3);
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/farms/${homeFarmId}`,
      headers: officer.auth,
      payload: { name: 'x' },
    });
    expect(patch.statusCode).toBe(403);
  });

  it('creates, updates and deletes a farm with a first soil test', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/farms',
      headers: farmer.auth,
      payload: {
        name: 'Test plot',
        districtId: 'nagpur',
        soil: 'black',
        irrigation: 'full',
        areaAcres: 1.5,
        season: 'rabi',
        soilTest: { testedAt: '2026-05-01', ph: 7.2, n: 250, p: 9, k: 300 },
      },
    });
    expect(created.statusCode).toBe(201);
    const farm = created.json();
    expect(farm.latestSoilTest.levels).toEqual({ n: 'low', p: 'low', k: 'high' });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/farms/${farm.id}`,
      headers: farmer.auth,
      payload: { crop: 'wheat' },
    });
    expect(patched.json().crop).toBe('wheat');

    const bad = await app.inject({
      method: 'PATCH',
      url: `/api/farms/${farm.id}`,
      headers: farmer.auth,
      payload: { soil: 'moon' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('unknown_soil');

    const st = await app.inject({
      method: 'POST',
      url: `/api/farms/${farm.id}/soil-tests`,
      headers: farmer.auth,
      payload: { testedAt: '2026-10-01', ph: 7.0, n: 300, p: 12, k: 280 },
    });
    expect(st.statusCode).toBe(201);
    const history = (await get(farmer, `/api/farms/${farm.id}/soil-tests`)).json();
    expect(history.map((h: { n: number }) => h.n)).toEqual([250, 300]);

    const del = await app.inject({ method: 'DELETE', url: `/api/farms/${farm.id}`, headers: farmer.auth });
    expect(del.statusCode).toBe(204);
    expect((await get(farmer, `/api/farms/${farm.id}`)).statusCode).toBe(404);
  });

  it('rejects a soil test dated in the future', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/farms/${homeFarmId}/soil-tests`,
      headers: farmer.auth,
      payload: { testedAt: '2099-01-01', ph: 7, n: 300, p: 12, k: 200 },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('advisory', () => {
  const profile = async () => {
    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: homeFarmId } });
    const t = await prisma.soilTest.findFirstOrThrow({
      where: { farmId: homeFarmId },
      orderBy: { testedAt: 'desc' },
    });
    return {
      farm,
      p: {
        district: farm.districtId,
        season: farm.season as 'rabi',
        soil: farm.soil,
        irrigation: farm.irrigation,
        area: farm.areaAcres,
        ph: t.ph,
        N: t.n,
        P: t.p,
        K: t.k,
      },
    };
  };

  it('returns the engine’s recommendations for the farm', async () => {
    const { p } = await profile();
    const r = (await get(farmer, `/api/farms/${homeFarmId}/recommendations`)).json();
    const e = recommend(p, REFERENCE);
    expect(r.list.map((x: { cropId: string; score: number }) => [x.cropId, x.score])).toEqual(
      e.list.map((x) => [x.crop.id, x.score]),
    );
    expect(r.usingDefaults).toBe(false);
    expect(r.list[0].reasons[0]).toMatchObject({
      ok: expect.any(Boolean),
      key: expect.stringMatching(/^r_/),
    });
  });

  it('plans fertiliser for any crop and validates the crop', async () => {
    const { p } = await profile();
    const r = (await get(farmer, `/api/farms/${homeFarmId}/fertiliser?crop=moong`)).json();
    expect(r.bags).toEqual(
      fertPlan(
        REFERENCE.crops.find((c) => c.id === 'moong')!,
        p,
        REFERENCE,
      ).bags,
    );
    expect(r.schedule).toHaveLength(1);
    const bad = await get(farmer, `/api/farms/${homeFarmId}/fertiliser?crop=banana`);
    expect(bad.statusCode).toBe(400);
  });

  it('plans water from the cached live forecast', async () => {
    const r = (await get(farmer, `/api/farms/${homeFarmId}/water`)).json();
    expect(r.forecast).toMatchObject({ source: 'open-meteo', simulated: false });
    expect(r.days).toHaveLength(7);
    expect(r.sprayDays).not.toContain('2026-11-15');
    const { farm, p } = await profile();
    expect(r.cropId).toBe(activeCrop(p, farm.crop, REFERENCE).id);
  });

  it('labels simulated mandi prices', async () => {
    const r = (await get(farmer, `/api/farms/${homeFarmId}/mandi?crop=cotton`)).json();
    expect(r.source).toEqual({ id: 'simulated', simulated: true, historyDays: 30 });
    expect(r.markets).toHaveLength(4);
    expect(r.markets[0].series).toHaveLength(30);
    expect(['rising', 'falling', 'stable', 'belowMsp']).toContain(r.advice.key);
  });

  it('diagnoses symptoms and logs confident matches for the heatmap', async () => {
    const before = await prisma.pestReport.count({ where: { farmId: homeFarmId } });
    const r = await app.inject({
      method: 'POST',
      url: '/api/diagnose',
      headers: farmer.auth,
      payload: { crop: 'chickpea', symptoms: ['holes', 'fruitrot'], farmId: homeFarmId },
    });
    expect(r.json().matches[0]).toEqual({ pestId: 'pod-borer', score: 100 });
    expect(await prisma.pestReport.count({ where: { farmId: homeFarmId } })).toBe(before + 1);
    const none = await app.inject({
      method: 'POST',
      url: '/api/diagnose',
      headers: farmer.auth,
      payload: { crop: 'chickpea', symptoms: [] },
    });
    expect(none.statusCode).toBe(400);
  });

  it('requires sign-in', async () => {
    expect((await app.inject({ method: 'GET', url: `/api/farms/${homeFarmId}/water` })).statusCode).toBe(401);
  });
});
