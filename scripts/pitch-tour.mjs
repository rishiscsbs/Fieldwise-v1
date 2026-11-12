// Captures every pitch slide (and the architecture slide on a phone) for a visual check. Needs the dev stack.
// Usage: node scripts/pitch-tour.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = 'screenshots/pitch';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/pitch`, { waitUntil: 'networkidle' });
  for (let i = 1; i <= 7; i++) {
    if (w < 500 && i !== 5) {
      await page.keyboard.press('ArrowRight');
      continue;
    }
    await page.waitForTimeout(2600); // camera glide and slide entry
    await page.screenshot({ path: `${OUT}/${w}-slide${i}.jpg`, type: 'jpeg', quality: 70 });
    console.log('saved', `${OUT}/${w}-slide${i}.jpg`);
    await page.keyboard.press('ArrowRight');
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? 'Problems:\n' + [...new Set(errors)].join('\n') : 'No console errors.');
