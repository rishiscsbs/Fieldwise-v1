// The "Living field" redesign: seasonal theming, the Lite and reduced-motion fallbacks for the React Bits
// pieces, accessibility (axe, WCAG 2 A/AA) on every main screen, and the delight moments. Nothing here writes
// to the database: screens that need special data get it from faked API responses.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** Serious and critical WCAG 2 A/AA problems on the page as it stands. */
async function axeProblems(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
}

const ui = (state: Record<string, unknown>) =>
  JSON.stringify({ state: { lang: 'en', theme: 'light', ...state }, version: 0 });

test.describe('public pages', () => {
  test('the season wheel is a real select: arrow keys change the season and the palette follows', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.addInitScript((s) => localStorage.setItem('fw-ui', s), ui({ season: 'rabi' }));
    await page.goto('/design');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'rabi');
    // The select is the control; the wheel drawn over it is hidden from assistive tech.
    const select = page.getByRole('combobox', { name: 'Season' });
    await select.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'zaid');
    await select.selectOption('kharif');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'kharif');
    expect(errors).toEqual([]);
  });

  test('Lite mode swaps every signature piece for its plain version and loads no WebGL', async ({ page }) => {
    const errors = trackErrors(page);
    const chunks: string[] = [];
    page.on('request', (r) => /reactbits|ogl/.test(r.url()) && chunks.push(r.url()));
    await page.addInitScript((s) => localStorage.setItem('fw-ui', s), ui({ lite: true }));
    await page.goto('/design');
    await expect(page.locator('html')).toHaveAttribute('data-lite', '');
    // The wheel is a visible select, the carousel a scrolling list, the hero a still photo.
    await expect(page.getByRole('combobox', { name: 'Season' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Crops we advise on' })).toBeVisible();
    await expect(page.locator('main canvas')).toHaveCount(0);
    await page.goto('/login');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Use Farmer account/ })).toBeVisible();
    expect(chunks).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('reduced motion: the login photo stays still and the wordmark is plain text', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByText('Fieldwise', { exact: true }).first()).toBeVisible();
  });

  for (const path of ['/', '/login', '/design']) {
    test(`no serious accessibility problems on ${path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axeProblems(page)).toEqual([]);
    });
  }
});

test.describe('signed in', () => {
  // One sign-in for the whole block: the API limits how often a number can ask for a code.
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let errors: string[];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await ctx.addInitScript((s) => localStorage.setItem('fw-ui', s), ui({}));
    page = await ctx.newPage();
    errors = trackErrors(page);
    await page.goto('/login');
    await page.getByRole('button', { name: /Use Farmer account/ }).click();
    await expect(page.getByLabel('6-digit code')).toHaveValue(/^\d{6}$/);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/app/);
  });
  test.afterAll(async () => page?.context().close());

  for (const path of [
    '/app',
    '/app/planner',
    '/app/nutrients',
    '/app/health',
    '/app/weather',
    '/app/market',
    '/app/desk',
    '/app/farm',
  ]) {
    test(`no serious accessibility problems on ${path}`, async () => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[role=status][aria-live]')).toHaveCount(0);
      expect(await axeProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('Lite mode in the app: wheels are plain selects and nothing draws on a canvas', async () => {
    // Motion allowed, so the plain versions are down to Lite mode alone. Switched on with the real menu toggle
    // and explored with in-app links (a reload would re-run this context's settings script).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/app');
    const lite = page.getByRole('switch', { name: 'Lite mode' });
    await lite.click();
    await expect(page.locator('html')).toHaveAttribute('data-lite', '');
    await page.getByRole('link', { name: 'Crop planner' }).click();
    await expect(page.getByRole('combobox', { name: 'Plan for season' })).toBeVisible();
    await page.getByRole('link', { name: 'Nutrient plan' }).click();
    await expect(page.getByRole('combobox', { name: 'Crop' })).toBeVisible();
    await page.getByRole('link', { name: 'Weather & irrigation' }).click();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await lite.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-lite', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(errors).toEqual([]);
  });

  test('empty states show a drawing and a next step', async () => {
    await page.route('**/api/alerts*', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/tickets*', (r) => r.fulfill({ json: [] }));
    await page.goto('/app');
    await expect(page.getByText('All quiet in the fields. No alerts right now.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Check my crop' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask a question' })).toBeVisible();
    await page.unroute('**/api/alerts*');
    await page.unroute('**/api/tickets*');
  });

  test('onboarding walks through you, your field and the soil card', async () => {
    // Pretend there is no field yet; the flow is walked but never saved.
    await page.route('**/api/farms', (r) =>
      r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.abort(),
    );
    await page.goto('/app/welcome');
    await expect(page.getByText('1 You')).toHaveAttribute('aria-current', 'step');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Field name')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel(/^pH/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
    await page.unroute('**/api/farms');
  });

  test('typing "monsoon" in the command palette makes it rain, then stops', async () => {
    // The rain is motion, so this one runs with motion allowed.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/app');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox').fill('monsoon');
    await expect(page.getByText('The monsoon has arrived!')).toBeVisible();
    await expect(page.locator('body > canvas')).toHaveCount(1);
    await expect(page.locator('body > canvas')).toHaveCount(0, { timeout: 8000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });
});
