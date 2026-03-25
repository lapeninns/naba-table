import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:3000';

test.describe('public booking pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('bookings landing page highlights actions', async ({ page }) => {
    await page.goto('/bookings');

    const actions = page.getByRole('region', { name: 'Booking actions' });

    await expect(page.getByRole('heading', { name: 'Your Reservations', level: 1 })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Browse restaurants' })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'View my bookings' })).toBeVisible();
  });

  test('booking recovery error shows missing token copy', async ({ page }) => {
    await page.goto('/bookings/recover/error?code=MISSING_ACCESS_TOKEN');

    await expect(page.getByRole('heading', { name: 'Link is incomplete' })).toBeVisible();
    await expect(
      page.getByText('missing recovery information', { exact: false }),
    ).toBeVisible();
  });

  test('invalid restaurant detail and book routes resolve to the guest not-found experience', async ({
    page,
  }) => {
    await page.goto('/restaurants/not-a-real-restaurant');

    await expect(page.getByRole('heading', { name: 'We couldn’t find that restaurant page.' })).toBeVisible();
    await expect(page.locator('#main-content').getByRole('link', { name: 'Browse restaurants' })).toBeVisible();

    await page.goto('/restaurants/not-a-real-restaurant/book');

    await expect(page.getByRole('heading', { name: 'We couldn’t find that restaurant page.' })).toBeVisible();
    await expect(page.locator('#main-content').getByRole('link', { name: 'Go to bookings' })).toBeVisible();
  });
});
