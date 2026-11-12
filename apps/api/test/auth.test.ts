import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REFERENCE } from '@fieldwise/shared';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { loadReference } from '../src/lib/reference.js';
import { requestOtp } from '../src/services/auth.js';

let app: App;
beforeAll(async () => {
  app = await buildApp({ logger: false, authRateLimit: 1000 });
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const cookieFrom = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return String(list.find((c) => String(c).startsWith('fw_rt=')) ?? '').split(';')[0]!;
};

/** The API only returns the code in development, so tests get a known code from the service. */
async function login(phone: string) {
  await prisma.otpCode.deleteMany({ where: { phone } });
  const { code } = await requestOtp(phone);
  return app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
}

describe('auth', () => {
  it('rejects a malformed phone number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/otp/request',
      payload: { phone: '12345' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_input');
  });

  it('sends a code without returning it outside development', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/otp/request',
      payload: { phone: '98765 00001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toBe(true);
    expect(res.json().devCode).toBeUndefined();
    const row = await prisma.otpCode.findFirstOrThrow({ where: { phone: '+919876500001' } });
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('asks the user to wait before resending', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/otp/request',
      payload: { phone: '9876500001' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('otp_too_soon');
  });

  it('logs in each demo role and returns its profile', async () => {
    for (const a of DEMO_ACCOUNTS) {
      const res = await login(a.phone);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toMatchObject({ phone: a.phone, role: a.role, name: a.name });
      expect(cookieFrom(res)).toMatch(/^fw_rt=.+/);
      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      expect(me.json().role).toBe(a.role);
    }
  });

  it('locks a code after five wrong attempts', async () => {
    const phone = '+919876500002';
    const { code } = await requestOtp(phone);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { phone, code: wrong },
      });
      expect(r.statusCode).toBe(401);
    }
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code } });
    expect(r.statusCode).toBe(429);
  });

  it('creates a farmer account for a new number', async () => {
    const res = await login('+919876500003');
    expect(res.json().user.role).toBe('farmer');
  });

  it('rotates refresh tokens and revokes everything on reuse', async () => {
    const first = await login(DEMO_ACCOUNTS[0].phone);
    const c1 = cookieFrom(first);
    const r1 = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: c1 } });
    expect(r1.statusCode).toBe(200);
    const c2 = cookieFrom(r1);
    expect(c2).not.toBe(c1);
    // Replaying the old token is treated as theft: it fails and the new one is revoked too.
    const replay = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: c1 } });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error).toBe('refresh_reused');
    const after = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: c2 } });
    expect(after.statusCode).toBe(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const res = await login(DEMO_ACCOUNTS[1].phone);
    const c = cookieFrom(res);
    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: c } });
    expect(out.statusCode).toBe(204);
    const r = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: c } });
    expect(r.statusCode).toBe(401);
  });

  it('rejects requests without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('rate limiting', () => {
  it('limits OTP attempts per IP', async () => {
    const strict = await buildApp({ logger: false, authRateLimit: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await strict.inject({
        method: 'POST',
        url: '/api/auth/otp/verify',
        payload: { phone: '+919876500009', code: '123456' },
      });
      codes.push(r.statusCode);
    }
    await strict.close();
    expect(codes.slice(0, 3).every((c) => c === 401)).toBe(true);
    expect(codes[3]).toBe(429);
  });
});

describe('seed and system', () => {
  it('seeds every district with farms, tickets and pest reports', async () => {
    const districts = await prisma.district.findMany({
      include: { _count: { select: { farms: true, tickets: true, pestReports: true } } },
    });
    expect(districts).toHaveLength(10);
    for (const d of districts) {
      expect(d._count.farms).toBeGreaterThan(0);
      expect(d._count.tickets).toBeGreaterThan(0);
      expect(d._count.pestReports).toBeGreaterThan(0);
    }
  });

  it('gives every farm a Soil Health Card history', async () => {
    const farms = await prisma.farm.findMany({ include: { _count: { select: { soilTests: true } } } });
    expect(farms.every((f) => f._count.soilTests >= 3)).toBe(true);
  });

  it('loads reference data back into the engine shape unchanged', async () => {
    const ref = await loadReference(prisma);
    expect(ref.crops).toEqual(REFERENCE.crops);
    expect(ref.pests).toEqual(REFERENCE.pests);
    expect(ref.districts).toEqual(REFERENCE.districts);
    expect(ref.fertilisers).toEqual(REFERENCE.fertilisers);
    expect(ref.soilTaw).toEqual(REFERENCE.soilTaw);
  });

  it('serves health and OpenAPI docs', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json()).toMatchObject({
      ok: true,
      db: true,
    });
    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json();
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/otp/request',
        '/api/auth/otp/verify',
        '/api/auth/refresh',
        '/api/auth/me',
      ]),
    );
  });

  it('hides demo accounts outside development', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dev/demo-accounts' });
    expect(res.json()).toEqual({ enabled: false, accounts: [] });
  });
});
