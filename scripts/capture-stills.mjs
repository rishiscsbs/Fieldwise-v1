// Renders the landing page's 3D world at each season (and the soil cross-section) and saves JPEG stills
// for Lite mode and reduced motion. Needs the web dev server running.
//
// Usage: node scripts/capture-stills.mjs   (BASE_URL defaults to http://localhost:5173)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = 'apps/web/public/lite';
const STILLS = ['kharif', 'rabi', 'zaid', 'soil'];

mkdirSync(OUT, { recursive: true });
// Software WebGL is enough for a still frame.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
for (const s of STILLS) {
  await page.goto(`${BASE}/?still=${s}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__stillReady === true, null, { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/${s}.jpg`, type: 'jpeg', quality: 80 });
  console.log('saved', `${OUT}/${s}.jpg`);
}
await browser.close();
if (errors.length) {
  console.error('\nProblems:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
