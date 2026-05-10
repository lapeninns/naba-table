import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('public booking pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('bookings landing page highlights actions', async ({ page }) => {
    await page.goto('/bookings');

    await expect(
      page.getByRole('heading', { name: 'Start a new booking', level: 1 }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByRole('link', { name: 'Browse restaurants' }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByRole('link', { name: 'Sign in to view bookings' }),
    ).toBeVisible();
  });

  test('booking recovery error shows missing token copy', async ({ page }) => {
    await page.goto('/bookings/recover/error?code=MISSING_ACCESS_TOKEN');

    await expect(
      page.getByRole('heading', { name: 'This booking link is incomplete' }),
    ).toBeVisible();
    await expect(
      page.getByText('missing the recovery information', { exact: false }),
    ).toBeVisible();
  });
});
