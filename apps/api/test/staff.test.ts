import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REFERENCE } from '@fieldwise/shared';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { getReference, invalidateReference } from '../src/services/reference.js';
import { login, type Session } from './helpers.js';

let app: App;
let farmer: Session;
let officer: Session;
let admin: Session;

beforeAll(async () => {
  app = await buildApp({ logger: false, authRateLimit: 1000, realtime: false });
  farmer = await login(app, DEMO_ACCOUNTS[0].phone);
  officer = await login(app, DEMO_ACCOUNTS[1].phone);
  admin = await login(app, DEMO_ACCOUNTS[2].phone);
});
afterAll(async () => {
  // Put back the reference data these tests edit; other test files share the database.
  const wheat = REFERENCE.crops.find((c) => c.id === 'wheat')!;
  await prisma.crop.update({ where: { id: 'wheat' }, data: { msp: wheat.msp, price: wheat.p } });
  await prisma.crop.deleteMany({ where: { id: 'sesame' } });
  const jodhpur = REFERENCE.districts.jodhpur!;
  await prisma.market.deleteMany({ where: { districtId: 'jodhpur' } });
  await prisma.market.createMany({
    data: jodhpur.mk.map((name, sortOrder) => ({ districtId: 'jodhpur', name, sortOrder })),
  });
  await prisma.district.update({ where: { id: 'jodhpur' }, data: { ph: jodhpur.ph } });
  invalidateReference();
  await app.close();
});

const get = (s: Session, url: string) => app.inject({ method: 'GET', url, headers: s.auth });

describe('officer dashboard', () => {
  it('summarises the officer’s own district', async () => {
    const r = await get(officer, '/api/officer/summary?days=60');
    expect(r.statusCode).toBe(200);
    const s = r.json();
    expect(s.districtId).toBe('nagpur');
    expect(s.farms).toBe(await prisma.farm.count({ where: { districtId: 'nagpur' } }));
    const open = await prisma.ticket.count({ where: { districtId: 'nagpur', status: 'open' } });
    expect(s.tickets.open).toBe(open);
    expect(s.weekly).toHaveLength(8);
    expect(s.categories.reduce((n: number, c: { count: number }) => n + c.count, 0)).toBeGreaterThan(0);
    expect(s.medianResponseHours).toBeGreaterThan(0);
    expect(s.topPests[0].count).toBeGreaterThanOrEqual(s.topPests.at(-1).count);
  });

  it('keeps officers to their own district and farmers out', async () => {
    expect((await get(officer, '/api/officer/summary?districtId=ludhiana')).statusCode).toBe(403);
    expect((await get(farmer, '/api/officer/summary')).statusCode).toBe(403);
  });

  it('lets admins view any district', async () => {
    const r = await get(admin, '/api/officer/map?districtId=ludhiana');
    expect(r.json().district.id).toBe('ludhiana');
    expect(r.json().farms.length).toBeGreaterThan(0);
  });

  it('maps farms and open questions with coordinates near the district', async () => {
    const m = (await get(officer, '/api/officer/map')).json();
    expect(
      m.farms.every(
        (f: { lat: number; lon: number }) =>
          Math.abs(f.lat - m.district.lat) < 1 && Math.abs(f.lon - m.district.lon) < 1,
      ),
    ).toBe(true);
    expect(m.tickets.length).toBe(
      await prisma.ticket.count({ where: { districtId: 'nagpur', status: 'open' } }),
    );
  });

  it('returns pest sightings for the heatmap, filterable by pest', async () => {
    const all = (await get(officer, '/api/officer/pests?days=90')).json();
    expect(all.reports.length).toBeGreaterThan(0);
    const one = all.reports[0].pestId;
    const filtered = (await get(officer, `/api/officer/pests?days=90&pestId=${one}`)).json();
    expect(filtered.reports.every((r: { pestId: string }) => r.pestId === one)).toBe(true);
  });
});

describe('admin', () => {
  it('is admin-only', async () => {
    expect((await get(officer, '/api/admin/overview')).statusCode).toBe(403);
    expect((await get(farmer, '/api/admin/users')).statusCode).toBe(403);
  });

  it('gives an overview of every district', async () => {
    const o = (await get(admin, '/api/admin/overview')).json();
    expect(o.districts).toHaveLength(10);
    expect(o.users.officer).toBeGreaterThanOrEqual(10);
    expect(o.districts.every((d: { officers: number }) => d.officers >= 1)).toBe(true);
  });

  it('adds an officer, then moving them signs them out', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: admin.auth,
      payload: { phone: '98765 22222', name: 'Test Officer', role: 'officer', districtId: 'indore' },
    });
    expect(r.statusCode).toBe(201);
    const id = r.json().id;
    const dup = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: admin.auth,
      payload: { phone: '9876522222', name: 'X', role: 'farmer', districtId: null },
    });
    expect(dup.statusCode).toBe(409);

    const s = await login(app, '+919876522222');
    expect(s.user.role).toBe('officer');
    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${id}`,
      headers: admin.auth,
      payload: { districtId: 'rajkot' },
    });
    expect(moved.json().districtId).toBe('rajkot');
    expect(await prisma.refreshToken.count({ where: { userId: id, revokedAt: null } })).toBe(0);

    const search = (await get(admin, '/api/admin/users?q=Test%20Officer')).json();
    expect(search.map((u: { id: string }) => u.id)).toContain(id);
  });

  it('will not let an admin lock themselves out, or leave an officer without a district', async () => {
    const self = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${admin.user.id}`,
      headers: admin.auth,
      payload: { active: false },
    });
    expect(self.statusCode).toBe(403);
    const off = await prisma.user.findFirstOrThrow({ where: { role: 'officer', districtId: 'cuttack' } });
    const r = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${off.id}`,
      headers: admin.auth,
      payload: { districtId: null },
    });
    expect(r.statusCode).toBe(400);
  });

  it('edits crop reference data and the engine sees it', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/admin/crops/wheat',
      headers: admin.auth,
      payload: { msp: 2500, p: 2550 },
    });
    expect(r.json()).toMatchObject({ id: 'wheat', msp: 2500, p: 2550 });
    invalidateReference();
    expect((await getReference()).crops.find((c) => c.id === 'wheat')!.msp).toBe(2500);
    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/admin/crops/wheat',
      headers: admin.auth,
      payload: { ph: [8, 6] },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('adds a crop and can turn it off', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/admin/crops',
      headers: admin.auth,
      payload: {
        id: 'sesame',
        e: '🌱',
        n: { en: 'Sesame (til)', hi: 'तिल' },
        s: ['kharif'],
        soil: ['alluvial', 'red'],
        ph: [5.5, 8],
        w: [300, 500],
        t: [25, 35],
        npk: [40, 20, 20],
        kc: 0.85,
        d: '80–95',
        y: 3,
        msp: 9267,
        p: 9000,
        leg: 0,
      },
    });
    expect(r.statusCode).toBe(201);
    const off = await app.inject({
      method: 'PATCH',
      url: '/api/admin/crops/sesame',
      headers: admin.auth,
      payload: { active: false },
    });
    expect(off.json().active).toBe(false);
    invalidateReference();
    expect((await getReference()).crops.some((c) => c.id === 'sesame')).toBe(false);
    const all = (await get(admin, '/api/admin/crops')).json();
    expect(all.find((c: { id: string }) => c.id === 'sesame').active).toBe(false);
  });

  it('edits a district’s markets', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/admin/districts/jodhpur',
      headers: admin.auth,
      payload: { markets: ['Jodhpur', 'Pipar', 'Bilara', 'Phalodi', 'Osian'], ph: 8.1 },
    });
    expect(r.json()).toMatchObject({ ph: 8.1, markets: ['Jodhpur', 'Pipar', 'Bilara', 'Phalodi', 'Osian'] });
  });
});

describe('public metrics', () => {
  it('serves aggregate counts without signing in', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/public/metrics' });
    expect(r.statusCode).toBe(200);
    const m = r.json();
    expect(m.districts).toBe(10);
    expect(m.farmers).toBeGreaterThan(40);
    expect(m.questionsAnswered).toBeGreaterThan(0);
    expect(m.medianResponseHours).toBeGreaterThan(0);
    expect(JSON.stringify(m)).not.toMatch(/\+91|phone|name/i);
  });
});
