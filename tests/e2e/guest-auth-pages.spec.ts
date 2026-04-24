import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('guest auth pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('role selection highlights guest and owner options', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: 'Choose how to continue.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue as guest/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Owner sign-in/i })).toBeVisible();
    await expect(
      page.locator('main').getByRole('link', { name: /Browse restaurants/i }),
    ).toBeVisible();
  });

  test('guest sign-in page renders the magic-link form', async ({ page }) => {
    await page.goto('/auth/signin');

    await expect(page.getByRole('heading', { name: 'Sign in to your bookings' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in to operations' })).toBeVisible();
  });
});
