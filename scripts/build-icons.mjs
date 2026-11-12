// Renders the PWA icons from apps/web/public/favicon.svg (any + maskable with a safe-zone margin).
// Usage: node scripts/build-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('apps/web/public/favicon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size, file, maskable) => {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.62) : size;
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${maskable ? '#2f7a43' : 'transparent'}">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  );
  await page.screenshot({ path: `apps/web/public/icons/${file}`, omitBackground: !maskable });
  console.log('saved', file);
};
await render(192, 'icon-192.png', false);
await render(512, 'icon-512.png', false);
await render(512, 'maskable-512.png', true);
await browser.close();
