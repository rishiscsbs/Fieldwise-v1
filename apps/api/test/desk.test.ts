// Tickets, alerts and notifications over HTTP, plus the live Socket.IO events they trigger.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { login, multipart, png, type Session } from './helpers.js';

let app: App;
let base: string;
let farmer: Session;
let officer: Session;
let admin: Session;
let outsider: Session;
const sockets: Socket[] = [];

beforeAll(async () => {
  app = await buildApp({ logger: false, authRateLimit: 1000 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  farmer = await login(app, DEMO_ACCOUNTS[0].phone);
  officer = await login(app, DEMO_ACCOUNTS[1].phone);
  admin = await login(app, DEMO_ACCOUNTS[2].phone);
  outsider = await login(
    app,
    (await prisma.user.findFirstOrThrow({ where: { name: 'Gurpreet Singh' } })).phone,
  );
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await app.close();
});

/** A connected socket that records every event it receives. */
async function live(s: Session) {
  const socket = connect(base, {
    path: '/socket.io',
    auth: { token: s.token },
    transports: ['websocket'],
    forceNew: true,
  });
  sockets.push(socket);
  const events: [string, unknown][] = [];
  socket.onAny((event, payload) => events.push([event, payload]));
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  const waitFor = (event: string, n = 1) =>
    new Promise<unknown[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 3000);
      const check = () => {
        const hits = events.filter(([e]) => e === event).map(([, p]) => p);
        if (hits.length >= n) {
          clearTimeout(timer);
          resolve(hits);
        } else setTimeout(check, 20);
      };
      check();
    });
  return { socket, events, waitFor };
}

const post = (s: Session, url: string, payload: object) =>
  app.inject({ method: 'POST', url, headers: s.auth, payload });

describe('realtime connection', () => {
  it('rejects a socket without a valid token', async () => {
    const s = connect(base, {
      path: '/socket.io',
      auth: { token: 'nope' },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(s);
    const err = await new Promise<Error>((resolve) => s.on('connect_error', resolve));
    expect(err.message).toBe('unauthorized');
  });
});

describe('advisory desk', () => {
  let ticketId: string;

  it('a farmer asks with a photo; district officers see it live and get notified', async () => {
    const off = await live(officer);
    const up = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      ...multipart(
        png(8, 8, () => [40, 160, 50]),
        farmer.auth,
      ),
    });
    const farm = await prisma.farm.findFirstOrThrow({
      where: { ownerId: farmer.user.id, name: 'Home field' },
    });
    const r = await post(farmer, '/api/tickets', {
      body: 'Holes in my chickpea pods.\nStarted two days ago.',
      farmId: farm.id,
      category: 'pest',
      uploadIds: [up.json().id],
    });
    expect(r.statusCode).toBe(201);
    const t = r.json();
    ticketId = t.id;
    expect(t).toMatchObject({
      subject: 'Holes in my chickpea pods.',
      status: 'open',
      districtId: 'nagpur',
      messageCount: 1,
    });
    expect(t.messages[0].attachments).toHaveLength(1);

    const [ev] = (await off.waitFor('ticket:new')) as { id: string }[];
    expect(ev!.id).toBe(ticketId);
    await off.waitFor('notification:new');
    const notes = (
      await app.inject({ method: 'GET', url: '/api/notifications', headers: officer.auth })
    ).json();
    expect(notes.items[0]).toMatchObject({ type: 'ticket_new', refId: ticketId });
  });

  it('keeps tickets private to the farmer and their district', async () => {
    expect(
      (await app.inject({ method: 'GET', url: `/api/tickets/${ticketId}`, headers: outsider.auth }))
        .statusCode,
    ).toBe(404);
    const list = (
      await app.inject({ method: 'GET', url: '/api/tickets?status=open', headers: officer.auth })
    ).json();
    expect(list.some((x: { id: string }) => x.id === ticketId)).toBe(true);
    expect(list.every((x: { districtId: string }) => x.districtId === 'nagpur')).toBe(true);
    const all = (await app.inject({ method: 'GET', url: '/api/tickets', headers: admin.auth })).json();
    expect(new Set(all.map((x: { districtId: string }) => x.districtId)).size).toBeGreaterThan(1);
  });

  it('an officer reply marks it answered and reaches the farmer instantly', async () => {
    const fm = await live(farmer);
    const r = await post(officer, `/api/tickets/${ticketId}/messages`, {
      body: 'Set up 20 bird perches per acre and HaNPV.',
    });
    expect(r.statusCode).toBe(201);
    const [msg] = (await fm.waitFor('ticket:message')) as { body: string }[];
    expect(msg!.body).toContain('bird perches');
    const updates = (await fm.waitFor('ticket:updated')) as { status: string; officer: { name: string } }[];
    expect(updates.at(-1)).toMatchObject({ status: 'answered', officer: { name: 'Anita Deshmukh' } });
    const [n] = (await fm.waitFor('notification:new')) as { type: string }[];
    expect(n!.type).toBe('ticket_reply');
  });

  it('a farmer follow-up reopens it; the farmer can close but not mark answered', async () => {
    await post(farmer, `/api/tickets/${ticketId}/messages`, { body: 'Thanks, how many traps?' });
    const detail = (
      await app.inject({ method: 'GET', url: `/api/tickets/${ticketId}`, headers: farmer.auth })
    ).json();
    expect(detail.status).toBe('open');
    expect(detail.messages.map((m: { author: { role: string } }) => m.author.role)).toEqual([
      'farmer',
      'officer',
      'farmer',
    ]);

    const patch = (status: string, s = farmer) =>
      app.inject({ method: 'PATCH', url: `/api/tickets/${ticketId}`, headers: s.auth, payload: { status } });
    expect((await patch('answered')).statusCode).toBe(403);
    expect((await patch('closed')).json().status).toBe('closed');
    expect((await patch('open', officer)).json().status).toBe('open');
  });

  it('only farmers ask questions, and only with their own photos', async () => {
    expect((await post(officer, '/api/tickets', { body: 'Officer question here' })).statusCode).toBe(403);
    const theirs = await app.inject({
      method: 'POST',
      url: '/api/uploads',
      ...multipart(
        png(4, 4, () => [1, 2, 3]),
        outsider.auth,
      ),
    });
    const r = await post(farmer, '/api/tickets', {
      body: 'Look at this photo please',
      uploadIds: [theirs.json().id],
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('upload_not_yours');
  });
});

describe('alerts', () => {
  it('an officer alert reaches district farmers live and in their notification centre', async () => {
    const fm = await live(farmer);
    const out = await live(outsider);
    const r = await post(officer, '/api/alerts', {
      labels: {
        en: 'Whitefly rising in cotton near Katol. Put up yellow sticky traps.',
        hi: 'काटोल के पास कपास में सफेद मक्खी बढ़ रही है।',
      },
      level: 'warn',
    });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({
      districtId: 'nagpur',
      level: 'warn',
      author: { name: 'Anita Deshmukh' },
    });
    const [a] = (await fm.waitFor('alert:new')) as { id: string }[];
    expect(a!.id).toBe(r.json().id);
    await fm.waitFor('notification:new');
    await new Promise((res) => setTimeout(res, 150));
    expect(out.events.some(([e]) => e === 'alert:new')).toBe(false);

    const list = (await app.inject({ method: 'GET', url: '/api/alerts', headers: farmer.auth })).json();
    expect(list[0].id).toBe(r.json().id);
    expect(list.some((x: { districtId: string | null }) => x.districtId === null)).toBe(true);
  });

  it('crop alerts only go to farmers growing that crop', async () => {
    const crops = await prisma.farm.findMany({ where: { ownerId: farmer.user.id }, select: { crop: true } });
    const notGrown = ['potato', 'mustard', 'bajra', 'rice'].find((c) => !crops.some((f) => f.crop === c))!;
    const r = await post(officer, '/api/alerts', {
      labels: { en: `Advice for ${notGrown} growers only.` },
      cropId: notGrown,
    });
    const list = (await app.inject({ method: 'GET', url: '/api/alerts', headers: farmer.auth })).json();
    expect(list.some((x: { id: string }) => x.id === r.json().id)).toBe(false);
  });

  it('officers cannot alert other districts and farmers cannot alert at all', async () => {
    expect(
      (await post(officer, '/api/alerts', { labels: { en: 'Somewhere else' }, districtId: 'ludhiana' }))
        .statusCode,
    ).toBe(403);
    expect((await post(farmer, '/api/alerts', { labels: { en: 'Farmer alert' } })).statusCode).toBe(403);
  });

  it('marks notifications read', async () => {
    const before = (
      await app.inject({ method: 'GET', url: '/api/notifications', headers: farmer.auth })
    ).json();
    expect(before.unread).toBeGreaterThan(0);
    const r = await post(farmer, '/api/notifications/read', { ids: [before.items[0].id] });
    expect(r.json().unread).toBe(before.unread - 1);
    expect((await post(farmer, '/api/notifications/read', {})).json().unread).toBe(0);
  });
});

describe('profile', () => {
  it('lets a new farmer set name, language and district, with a refreshed token', async () => {
    const s = await login(app, '+919876511111');
    const r = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: s.auth,
      payload: { name: 'Kiran Pawar', lang: 'hi', districtId: 'indore' },
    });
    expect(r.json().user).toMatchObject({ name: 'Kiran Pawar', lang: 'hi', districtId: 'indore' });
    const claims = app.jwt.decode<{ districtId: string }>(r.json().accessToken);
    expect(claims?.districtId).toBe('indore');
    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      headers: s.auth,
      payload: { districtId: 'atlantis' },
    });
    expect(bad.statusCode).toBe(400);
  });
});
