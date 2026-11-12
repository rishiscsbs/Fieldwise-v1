// The public landing page: works in English and Hindi, links into the app, and falls back to a calm,
// stacked page under reduced motion. Fails on any console error.
import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('the hero introduces Fieldwise and leads into the app', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Advice that knows your soil/ })).toBeVisible();
  await page
    .getByRole('link', { name: /Open the app/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});

test('the landing page switches to Hindi', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByLabel('Language').selectOption('hi');
  await expect(page.getByRole('heading', { level: 1, name: /ऐसी सलाह/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test('shows the seasons as plain cards and live numbers, with no 3D', async ({ page }) => {
    const errors = trackErrors(page);
    // emulateMedia is applied reliably before navigation (the reducedMotion context option was not).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
    for (const s of ['Kharif', 'Rabi', 'Zaid'])
      await expect(page.getByRole('heading', { name: s })).toBeVisible();
    await page.locator('#numbers').scrollIntoViewIfNeeded();
    await expect(page.locator('#numbers dd').first()).toHaveText(/^\d+$/);
    expect(errors).toEqual([]);
  });
});
