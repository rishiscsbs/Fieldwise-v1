// Main farmer and officer flows through the real UI and API.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

/** Signs in through the login screen using a dev demo account button. */
async function signIn(page: Page, role: 'Farmer' | 'Extension officer' | 'Admin') {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`Use ${role} account`) }).click();
  await expect(page.getByLabel('6-digit code')).toHaveValue(/^\d{6}$/);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app/);
}

async function newUser(browser: Browser, role: 'Farmer' | 'Extension officer' | 'Admin') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() =>
    localStorage.setItem('fw-ui', JSON.stringify({ state: { lang: 'en', theme: 'light' }, version: 0 })),
  );
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await signIn(page, role);
  return { page, errors, close: () => ctx.close() };
}

/** A 64×64 leaf: green with a brown patch on the left. */
function leafPng(): Buffer {
  const img = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const [r, g, b] = x < 16 ? [120, 60, 30] : [40, 160, 50];
      img.data.set([r, g, b, 255], i);
    }
  return PNG.sync.write(img);
}

// One sign-in per role for the whole file: the real API limits how often a number can request a code.
test.describe.configure({ mode: 'serial' });
let farmer: Awaited<ReturnType<typeof newUser>>;
let officer: Awaited<ReturnType<typeof newUser>>;
test.beforeAll(async ({ browser }) => {
  farmer = await newUser(browser, 'Farmer');
  officer = await newUser(browser, 'Extension officer');
});
test.afterAll(async () => {
  await farmer?.close();
  await officer?.close();
});
test.afterEach(() => {
  expect(farmer.errors).toEqual([]);
  expect(officer.errors).toEqual([]);
});

test('farmer picks a crop, diagnoses symptoms and checks a leaf photo', async () => {
  const { page } = farmer;
  await page.goto('/app');

  await expect(page.getByRole('heading', { name: /Namaste/ })).toBeVisible();

  // Planner: choosing a crop updates the card immediately (optimistic) and confirms with a toast.
  await page.getByRole('link', { name: 'Crop planner' }).click();
  const grow = page.getByRole('button', { name: 'Grow this' }).first();
  await grow.click();
  await expect(page.getByText(/is now your crop/)).toBeVisible();

  // Crop detail opens from the card.
  await page.getByRole('link', { name: 'See details' }).first().click();
  await expect(page.getByRole('heading', { name: 'Why this score' })).toBeVisible();

  // Health: symptoms → likely causes.
  await page.getByRole('link', { name: 'Crop health' }).click();
  await page.getByLabel('Crop', { exact: true }).selectOption('chickpea');
  await page.getByRole('button', { name: 'Holes, chewed leaves' }).click();
  await page.getByRole('button', { name: 'Damaged fruit / pods / bolls' }).click();
  await page.getByRole('button', { name: 'Check my crop' }).click();
  await expect(page.getByRole('heading', { name: 'Pod borer (Helicoverpa)' })).toBeVisible();

  // Leaf photo: colour check finds the brown patch and offers to add the sign.
  await page
    .locator('input[type=file][accept="image/jpeg,image/png"]')
    .first()
    .setInputFiles({ name: 'leaf.png', mimeType: 'image/png', buffer: leafPng() });
  await expect(page.getByText(/Brown or dark lesions/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add these signs' })).toBeVisible();
});

test('a farmer question reaches the officer live and the answer comes back live', async () => {
  await officer.page.goto('/app/desk');
  const fp = farmer.page;

  const stamp = String(Date.now());
  const question = `Leaves curling on my chickpea, what to do? ${stamp}`;
  await fp.goto('/app/desk?ask=1');
  await fp.getByLabel('Your question').fill(question);
  await fp.getByLabel('Topic').selectOption('pest');
  await fp.getByRole('button', { name: 'Send question' }).click();
  await fp.waitForURL(/\/app\/desk\/.+/);
  const ticketUrl = fp.url();

  // The officer's queue updates without a reload.
  const link = officer.page.getByRole('link', { name: new RegExp(stamp) });
  await expect(link).toBeVisible();
  await link.click();
  await officer.page
    .getByLabel('Write a reply')
    .fill('Spray neem oil at 5 ml per litre and check the undersides.');
  await officer.page.getByRole('button', { name: 'Send reply' }).click();

  // The farmer sees the reply and a notification without reloading.
  await expect(fp.getByText('Spray neem oil at 5 ml per litre')).toBeVisible();
  await expect(fp.locator('span.badge').filter({ hasText: 'Answered' }).first()).toBeVisible();
  expect(fp.url()).toBe(ticketUrl);
});

test('command palette and notification centre work by keyboard', async () => {
  const { page } = farmer;
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /Namaste/ })).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Go to a page or crop…').fill('weather');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/weather/);
  await expect(page.getByText(/Live forecast from Open-Meteo|Simulated forecast/)).toBeVisible();

  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeHidden();
});

test('the officer dashboard shows the district map, queue and charts', async () => {
  const { page } = officer;
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/officer/);
  await expect(page.getByRole('heading', { name: 'District dashboard' })).toBeVisible();
  await expect(page.getByRole('img', { name: /District map: Nagpur/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Question queue' })).toBeVisible();
  // Every chart has a table view.
  await page
    .getByRole('group', { name: /Show as: Common issues/ })
    .getByRole('button', { name: 'Table' })
    .click();
  await expect(page.getByRole('columnheader', { name: 'Topic' })).toBeVisible();
  // Officers cannot open admin; they are sent back to their dashboard.
  await page.goto('/app/admin');
  await expect(page).toHaveURL(/\/app\/officer/);
});

test('an admin edits a crop price and sees other districts', async ({ browser }) => {
  const admin = await newUser(browser, 'Admin');
  const { page } = admin;
  await expect(page).toHaveURL(/\/app\/admin/);
  await page.getByRole('tab', { name: 'Crops' }).click();
  const price = page.getByLabel('Price ₹/q: Wheat');
  const before = await price.inputValue();
  await price.fill(String(Number(before) + 10));
  await page.getByRole('row', { name: /Wheat/ }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved').first()).toBeVisible();
  // Put it back so the demo data stays as seeded.
  await price.fill(before);
  await page.getByRole('row', { name: /Wheat/ }).getByRole('button', { name: 'Save' }).click();

  await page.getByRole('tab', { name: 'Overview' }).click();
  await page.getByRole('button', { name: /^Ludhiana/ }).click();
  await expect(page).toHaveURL(/district=ludhiana/);
  await expect(page.getByRole('img', { name: /District map: Ludhiana/ })).toBeVisible();
  expect(admin.errors).toEqual([]);
  await admin.close();
});
