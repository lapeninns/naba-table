import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('guest marketing pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('landing page hero renders', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Nabatable keeps your pub service full, confirmed, and under control.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Claim a setup slot' }).first()).toBeVisible();
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { name: 'Clear rules for guest reservation data.' }),
    ).toBeVisible();
    await expect(page.getByText('Effective date', { exact: true })).toBeVisible();
    await expect(page.getByText('January 29, 2026')).toBeVisible();
  });

  test('contact sales page does not expose personal contact details', async ({ page }) => {
    await page.goto('/contact');

    await expect(
      page.getByRole('heading', { name: 'Talk through the rollout before you change the floor.' }),
    ).toBeVisible();
    await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  });
});
