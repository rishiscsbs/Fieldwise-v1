// Scrolls through the landing page and captures the viewport at each section, so the scroll story can be
// checked the way a visitor sees it (full-page screenshots cannot show a fixed 3D backdrop).
//
// Usage: node scripts/landing-tour.mjs [--reduced] [--lite] [--phone] [--hi]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const flags = new Set(process.argv.slice(2));
const mode = flags.has('--reduced') ? 'reduced' : flags.has('--lite') ? 'lite' : 'full';
const [w, h] = flags.has('--phone') ? [390, 844] : [1440, 900];
const lang = flags.has('--hi') ? 'hi' : 'en';
const OUT = 'screenshots/tour';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
});
await ctx.addInitScript(
  ([l, lite]) =>
    localStorage.setItem('fw-ui', JSON.stringify({ state: { lang: l, theme: 'light', lite }, version: 0 })),
  [lang, mode === 'lite'],
);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Positions as fractions through each section (seasons and soil are tall, pinned sections).
const stops = [
  ['hero', '#hero', 0],
  ['kharif', '#seasons', 0.12],
  ['rabi', '#seasons', 0.45],
  ['zaid', '#seasons', 0.8],
  ['soil', '#soil', 0.7],
  ['water', '#water', 0.35],
  ['mandi', '#mandi', 0.35],
  ['numbers', '#numbers', 0.2],
  ['map', '#map', 0.3],
];
for (const [name, sel, frac] of stops) {
  await page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: top + (el.offsetHeight - window.innerHeight) * Math.max(0, f),
        behavior: 'instant',
      });
    },
    [sel, frac],
  );
  await page.waitForTimeout(1800);
  const file = `${OUT}/${mode}-${w}-${lang}-${name}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
  console.log('saved', file);
}
await browser.close();
if (errors.length) {
  console.error('\nProblems:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
