import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { MAX_UPLOAD_BYTES } from '../src/services/uploads.js';
import { login, multipart, png, type Session } from './helpers.js';

let app: App;
let farmer: Session;

beforeAll(async () => {
  app = await buildApp({ logger: false, authRateLimit: 1000, realtime: false });
  farmer = await login(app, DEMO_ACCOUNTS[0].phone);
});
afterAll(async () => {
  await app.close();
});

const GREEN: [number, number, number] = [40, 160, 50];
const BROWN: [number, number, number] = [120, 60, 30];

describe('uploads', () => {
  it('stores a photo and serves it through a signed URL only', async () => {
    const img = png(40, 40, () => GREEN);
    const r = await app.inject({ method: 'POST', url: '/api/uploads', ...multipart(img, farmer.auth) });
    expect(r.statusCode).toBe(201);
    const { url, mime, size } = r.json();
    expect(mime).toBe('image/png');
    expect(size).toBe(img.length);

    const got = await app.inject({ method: 'GET', url });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.rawPayload.equals(img)).toBe(true);

    const tampered = await app.inject({ method: 'GET', url: url.replace(/sig=[0-9a-f]{4}/, 'sig=0000') });
    expect(tampered.statusCode).toBe(403);
  });

  it('checks the file bytes, not the declared type', async () => {
    const fake = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const r = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      ...multipart(fake, farmer.auth, 'x.png', 'image/png'),
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('upload_type');
  });

  it('rejects photos over 5 MB', async () => {
    const big = Buffer.concat([png(4, 4, () => GREEN), Buffer.alloc(MAX_UPLOAD_BYTES + 10)]);
    const r = await app.inject({ method: 'POST', url: '/api/uploads', ...multipart(big, farmer.auth) });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('upload_too_large');
  });

  it('requires sign-in to upload', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/uploads', ...multipart(png(4, 4, () => GREEN)) });
    expect(r.statusCode).toBe(401);
  });
});

describe('leaf photo check', () => {
  it('finds brown patches, where they are, and likely causes', async () => {
    // Left quarter brown, rest green.
    const img = png(64, 64, (x) => (x < 16 ? BROWN : GREEN));
    const r = await app.inject({
      method: 'POST',
      url: '/api/health/analyse?crop=tomato',
      ...multipart(img, farmer.auth),
    });
    expect(r.statusCode).toBe(201);
    const h = r.json();
    expect(h.analyser).toEqual({ id: 'colour-heuristic', version: '1', isModel: false });
    expect(Math.round(h.colours.brown)).toBe(25);
    expect(h.findings).toEqual(['ph_b']);
    expect(h.symptoms).toEqual(['spots']);
    expect(h.regions.length).toBeGreaterThan(0);
    expect(h.regions.every((g: { x: number; kind: string }) => g.x < 0.25 && g.kind === 'brown')).toBe(true);
    expect(h.matches.map((m: { pestId: string }) => m.pestId)).toContain('early-blight');
    expect(await prisma.healthCheck.count({ where: { id: h.id } })).toBe(1);

    const list = await app.inject({ method: 'GET', url: '/api/health/checks', headers: farmer.auth });
    expect(list.json()[0].id).toBe(h.id);
  });

  it('says a healthy leaf looks healthy', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/health/analyse?crop=wheat',
      ...multipart(
        png(32, 32, () => GREEN),
        farmer.auth,
      ),
    });
    expect(r.json()).toMatchObject({ findings: ['ph_ok'], symptoms: [], matches: [], regions: [] });
  });

  it('validates the crop', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/health/analyse?crop=banana',
      ...multipart(
        png(8, 8, () => GREEN),
        farmer.auth,
      ),
    });
    expect(r.statusCode).toBe(400);
  });
});
