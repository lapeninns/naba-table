import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';
const restaurantSlug = 'the-fox';

test.describe('guest marketing pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('landing page hero renders', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /The 'Packed House' Pub System/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Claim one monthly setup spot' })).toBeVisible();
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { name: 'Clear rules for guest reservation data.' }),
    ).toBeVisible();
    await expect(page.getByText('Effective date', { exact: true })).toBeVisible();
    await expect(page.getByText('January 29, 2026')).toBeVisible();
  });

  test('contact sales page exposes direct contact actions', async ({ page }) => {
    await page.goto('/contact');

    await expect(
      page.getByRole('heading', { name: 'Talk through the rollout before you change the floor.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Email sales/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Call sales/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Email the rollout team/i })).toBeVisible();
  });
});
