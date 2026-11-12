// Screenshots routes at desktop (1440) and phone (390) widths, in English/light and Hindi/dark,
// and fails if any page logs a console error or scrolls sideways. Needs the dev servers running.
//
// Usage:
//   node scripts/screenshots.mjs [route ...]                 public pages (default: home, design)
//   node scripts/screenshots.mjs --as=farmer app app/planner signed in as a demo account
// Routes may omit the leading slash (Git Bash rewrites /design into a Windows path).
// BASE_URL defaults to http://localhost:5173.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const DEMO = { farmer: '+919000000001', officer: '+919000000002', admin: '+919000000003' };
const argv = process.argv.slice(2);
const as = argv.find((a) => a.startsWith('--as='))?.slice(5);
const args = argv
  .filter((a) => !a.startsWith('--'))
  .map((r) => '/' + r.replace(/^[A-Za-z]:.*\/(?=[^/]*$)/, '').replace(/^\//, ''));
const ROUTES = args.length ? args : ['/', '/design'];
const WIDTHS = [
  ['desktop', 1440, 900],
  ['phone', 390, 844],
];
const VARIANTS = [
  ['en', 'light'],
  ['hi', 'dark'],
];
const OUT = 'screenshots';

/** Signs the browser context in through the real OTP flow; the dev API returns the code. */
async function signIn(ctx, role) {
  const phone = DEMO[role];
  const req = await ctx.request.post(`${BASE}/api/auth/otp/request`, { data: { phone } });
  const body = await req.json();
  if (!body.devCode) throw new Error(`No dev code for ${role}: ${JSON.stringify(body)}`);
  const v = await ctx.request.post(`${BASE}/api/auth/otp/verify`, { data: { phone, code: body.devCode } });
  if (!v.ok()) throw new Error(`Sign-in failed for ${role}: ${v.status()}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
// Sign in once, then hand the latest (rotated) refresh cookie from each context to the next.
let state;
for (const [device, width, height] of WIDTHS) {
  for (const [lang, theme] of VARIANTS) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      storageState: state,
    });
    await ctx.addInitScript(
      ([l, t]) => localStorage.setItem('fw-ui', JSON.stringify({ state: { lang: l, theme: t }, version: 0 })),
      [lang, theme],
    );
    if (as && !state) await signIn(ctx, as);
    const page = await ctx.newPage();
    page.on(
      'console',
      (m) => m.type() === 'error' && errors.push(`${device} ${lang} ${page.url()}: ${m.text()}`),
    );
    page.on('pageerror', (e) => errors.push(`${device} ${lang} ${page.url()}: ${e.message}`));
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      // Let skeletons resolve and entry animations finish.
      await page
        .waitForFunction(() => !document.querySelector('[role=status][aria-live]'), null, { timeout: 15_000 })
        .catch(() => {});
      await page.waitForTimeout(1400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) errors.push(`${device} ${lang} ${route}: page scrolls sideways by ${overflow}px`);
      // Windows file names cannot contain ? or =, so anything unusual becomes an underscore.
      const slug = route.replace(/^\//, '').replace(/[^A-Za-z0-9_-]+/g, '_') || 'home';
      const name = `${OUT}/${as ? as + '-' : ''}${slug}-${device}-${lang}-${theme}.png`;
      await page.screenshot({ path: name, fullPage: true });
      console.log('saved', name);
    }
    if (as) state = await ctx.storageState();
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.error('\nProblems:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log('\nNo console errors or horizontal overflow.');
