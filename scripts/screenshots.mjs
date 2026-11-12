// Screenshots every route at desktop (1440) and phone (390) widths, in English and Hindi, light and dark,
// and fails if any page logs a console error. Needs `npm run dev` running.
//
// Usage: node scripts/screenshots.mjs [route ...]   e.g. design planner (default: every route below)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
// Routes can be given without the leading slash (Git Bash rewrites /design into a Windows path).
const args = process.argv
  .slice(2)
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

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const [device, width, height] of WIDTHS) {
  for (const [lang, theme] of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    await ctx.addInitScript(
      ([l, t]) => localStorage.setItem('fw-ui', JSON.stringify({ state: { lang: l, theme: t }, version: 0 })),
      [lang, theme],
    );
    const page = await ctx.newPage();
    page.on(
      'console',
      (m) => m.type() === 'error' && errors.push(`${device} ${lang} ${page.url()}: ${m.text()}`),
    );
    page.on('pageerror', (e) => errors.push(`${device} ${lang} ${page.url()}: ${e.message}`));
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) errors.push(`${device} ${lang} ${route}: page scrolls sideways by ${overflow}px`);
      const name = `${OUT}/${(route.replace(/\//g, '_') || '_').replace(/^_$/, 'home')}-${device}-${lang}-${theme}.png`;
      await page.screenshot({ path: name, fullPage: true });
      console.log('saved', name);
    }
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.error('\nProblems:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nNo console errors or horizontal overflow.');
