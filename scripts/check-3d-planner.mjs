// Opens the planner's optional 3D view as the demo farmer and saves a screenshot. Needs the dev stack.
// Usage: node scripts/check-3d-planner.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() =>
  localStorage.setItem('fw-ui', JSON.stringify({ state: { lang: 'en', theme: 'light' }, version: 0 })),
);
const code = (
  await (await ctx.request.post(`${BASE}/api/auth/otp/request`, { data: { phone: '+919000000001' } })).json()
).devCode;
await ctx.request.post(`${BASE}/api/auth/otp/verify`, { data: { phone: '+919000000001', code } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${BASE}/app/planner`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Show 3D view' }).click();
await page.waitForTimeout(2500);
const view = page.getByLabel(/Drag or use the left and right arrow keys/);
await view.focus();
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(800);
await page.screenshot({
  path: 'screenshots/planner-3d.png',
  clip: { x: 260, y: 60, width: 1180, height: 520 },
});
await browser.close();
console.log(errors.length ? 'Problems:\n' + errors.join('\n') : 'No console errors.');
