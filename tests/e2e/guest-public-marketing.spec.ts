import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';
const restaurantSlug = 'the-fox';

test.describe('guest marketing pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('landing page hero renders', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Zero-Risk No-Show/i })).toBeVisible();
    await expect(
      page.locator('#hero').getByRole('link', { name: 'Contact Sales' }),
    ).toBeVisible();
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByText('Effective date:', { exact: false })).toBeVisible();
  });

  test('restaurant thank-you redirect lands on canonical page', async ({ page }) => {
    await page.goto(`/restaurants/${restaurantSlug}/thank-you`);

    await expect(page).toHaveURL(
      `${appBaseUrl}/restaurants/${restaurantSlug}/book/thank-you`,
    );
    await expect(page.getByRole('heading', { name: 'Reservation confirmed!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View my bookings' })).toBeVisible();
  });
});
