// Checks that the production build shows the last-viewed advice offline.
// Playwright's offline switch does not cover requests made by the service worker, so the check runs in
// two phases in one persistent browser profile, and you stop the API in between:
//
//   1. vite preview + API running:  node scripts/check-offline.mjs warm      (signs in, views advice)
//   2. stop the API, then:          node scripts/check-offline.mjs offline   (page offline + server down)
//
// BASE_URL defaults to http://localhost:4173 (vite preview).
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const phase = process.argv[2];
const profile = join(tmpdir(), 'fieldwise-offline-check');
const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());

if (phase === 'warm') {
  const code = (
    await (
      await ctx.request.post(`${BASE}/api/auth/otp/request`, { data: { phone: '+919000000001' } })
    ).json()
  ).devCode;
  await ctx.request.post(`${BASE}/api/auth/otp/verify`, { data: { phone: '+919000000001', code } });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 });
  // Visit once under the service worker so the shell and this farm's advice are cached.
  for (const path of ['/app', '/app/weather', '/app/nutrients'])
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
  console.log(
    JSON.stringify({ warmed: true, manifest: (await ctx.request.get(`${BASE}/manifest.webmanifest`)).ok() }),
  );
} else if (phase === 'offline') {
  await ctx.setOffline(true);
  const results = {};
  if (process.env.DEBUG) {
    page.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 160)));
    page.on('requestfailed', (r) => console.log('failed', r.url().replace(BASE, ''), r.failure()?.errorText));
  }
  for (const [name, path, text] of [
    ['overview', '/app', /Namaste/],
    ['weather', '/app/weather', /Weather & irrigation/],
    ['nutrients', '/app/nutrients', /Fertiliser for/],
  ]) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // isVisible() does not wait, so wait for the heading explicitly.
    results[name] = await page
      .getByRole('heading', { level: 1, name: text })
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
  }
  results.banner = await page
    .getByText(/You are offline/)
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  await page.screenshot({ path: 'screenshots/offline.png' });
  console.log(JSON.stringify(results));
} else {
  console.error('Usage: node scripts/check-offline.mjs warm|offline');
  process.exitCode = 2;
}
await ctx.close();
