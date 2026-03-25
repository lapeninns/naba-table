import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:3000';

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
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
  });

  test('invalid callback errors render guest-safe copy on sign-in', async ({ page }) => {
    await page.goto(
      '/auth/signin?error=link_expired&message=Your%20magic%20link%20has%20expired.%20Please%20request%20a%20new%20one.',
    );

    const errorAlert = page
      .getByRole('alert')
      .filter({ has: page.getByText('Unable to sign in') });

    await expect(errorAlert).toContainText('Unable to sign in');
    await expect(errorAlert).toContainText(
      'Your magic link has expired. Please request a new one.',
    );
  });
});
