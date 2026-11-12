// The pitch deck: keyboard and clicker navigation, the presenter window kept in step over BroadcastChannel,
// the architecture diagram and live numbers. Fails on any console error.
import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** The current slide (an outgoing one is aria-hidden while it animates away). */
const slideLabel = (page: Page) => page.locator('[aria-roledescription="slide"]:not([aria-hidden="true"])');

test('keyboard and clicker keys move through the deck', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/pitch');
  await expect(slideLabel(page)).toHaveAttribute('aria-label', 'Slide 1 of 7');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('86%');

  await page.keyboard.press('ArrowRight');
  await expect(slideLabel(page)).toHaveAttribute('aria-label', 'Slide 2 of 7');
  await page.keyboard.press('PageDown'); // what most clickers send
  await expect(slideLabel(page)).toHaveAttribute('aria-label', 'Slide 3 of 7');
  // The live demo slide shows numbers from the running API.
  await expect(page.getByText('Live from the running platform')).toBeVisible();
  await page.keyboard.press('PageUp');
  await expect(slideLabel(page)).toHaveAttribute('aria-label', 'Slide 2 of 7');

  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { level: 1, name: 'Thank you' })).toBeVisible();
  await expect(page).toHaveURL(/#7$/);
  expect(errors).toEqual([]);
});

test('the architecture slide shows the diagram with every part named', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/pitch#5');
  const diagram = page.getByRole('img', { name: /Architecture:/ });
  await expect(diagram).toBeVisible();
  for (const part of ['Fastify API', 'Advisory engine', 'Open-Meteo', 'Agmarknet', 'Live alerts']) {
    await expect(diagram.getByText(part)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('the presenter window and the deck stay in step', async ({ context }) => {
  const deck = await context.newPage();
  const errors = trackErrors(deck);
  await deck.goto('/pitch#3');
  await expect(slideLabel(deck)).toHaveAttribute('aria-label', 'Slide 3 of 7');
  const presenter = await context.newPage();
  await presenter.goto('/pitch/presenter');

  // A late-opened presenter catches up with the deck, then drives it.
  await expect(presenter.getByText('Connected to the deck')).toBeVisible();
  await expect(presenter.getByText('Now · Slide 3 of 7')).toBeVisible();
  await expect(presenter.getByText(/Switch to the app/)).toBeVisible(); // demo notes

  await presenter.getByRole('button', { name: 'Next slide' }).click();
  await expect(slideLabel(deck)).toHaveAttribute('aria-label', 'Slide 4 of 7');

  // And the deck drives the presenter.
  await deck.bringToFront();
  await deck.keyboard.press('ArrowRight');
  await expect(presenter.getByText('Now · Slide 5 of 7')).toBeVisible();

  await presenter.getByRole('button', { name: 'Start' }).click();
  await expect(presenter.getByRole('timer')).not.toHaveText('00:00', { timeout: 3000 });
  expect(errors).toEqual([]);
});
