import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('guest auth pages', () => {
  test.use({ baseURL: appBaseUrl });

  test('role selection highlights guest and owner options', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: 'Choose your path' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in as Guest' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in as Owner' })).toBeVisible();
  });

  test('guest sign-in page renders hero and form', async ({ page }) => {
    await page.goto('/auth/signin');

    await expect(
      page.getByRole('heading', { name: 'Welcome back to effortless dining' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
  });
});
