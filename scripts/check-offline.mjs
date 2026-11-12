// Checks the production build works offline: sign in, view advice, go offline, reload, advice still shows.
// Needs the API running and `vite preview` serving the build. Usage: BASE_URL=http://localhost:4173 node scripts/check-offline.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const code = (
  await (await ctx.request.post(`${BASE}/api/auth/otp/request`, { data: { phone: '+919000000001' } })).json()
).devCode;
await ctx.request.post(`${BASE}/api/auth/otp/verify`, { data: { phone: '+919000000001', code } });
const page = await ctx.newPage();
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page
  .waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 })
  .catch(() => {});
// Reload once online so the now-active service worker caches the shell and this page's API reads.
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Namaste/ }).waitFor();
const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).ok);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
const heading = await page
  .getByRole('heading', { name: /Namaste/ })
  .isVisible({ timeout: 15000 })
  .catch(() => false);
await page.waitForTimeout(1500);
const banner = await page
  .getByText(/You are offline/)
  .isVisible()
  .catch(() => false);
const kpi = await page
  .getByText('Recommended crop')
  .isVisible()
  .catch(() => false);
await page.screenshot({ path: 'screenshots/offline.png' });
console.log(
  JSON.stringify({
    manifest,
    sw: await page.evaluate(() => !!navigator.serviceWorker?.controller),
    offlineHeading: heading,
    offlineBanner: banner,
    offlineAdvice: kpi,
  }),
);
await browser.close();
