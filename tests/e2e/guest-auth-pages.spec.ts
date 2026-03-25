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

  test('sign-in sanitizes unsafe redirect params and supports authError alias messaging', async ({ page }) => {
    await page.goto(
      '/auth/signin?redirectedFrom=https%3A%2F%2Fevil.example%2Fsteal&authError=link_used',
    );

    await expect(page).toHaveURL(/\/auth\/signin\?error=link_used$/);

    const restaurantSignInLink = page.getByRole('link', { name: /sign in to operations console/i });
    await expect(restaurantSignInLink).toHaveAttribute('href', /\/auth\/signin$/);

    const errorAlert = page.getByRole('alert').filter({ has: page.getByText('Unable to sign in') });
    await expect(errorAlert).toContainText(
      'This magic link has already been used. Please request a new one.',
    );
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

  test('error_description callback failures reuse the guest-safe sign-in error banner', async ({
    page,
  }) => {
    await page.goto(
      '/auth/signin?error=access_denied&error_description=This%20magic%20link%20has%20expired%20or%20has%20already%20been%20used.',
    );

    const errorAlert = page
      .getByRole('alert')
      .filter({ has: page.getByText('Unable to sign in') });

    await expect(errorAlert).toContainText('Unable to sign in');
    await expect(errorAlert).toContainText(
      'This magic link has expired or has already been used.',
    );
  });

  test('invalid-format email submission shows visible inline validation', async ({ page }) => {
    await page.goto('/auth/signin');

    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.getByRole('button', { name: 'Send magic link' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
  });

  test('failing callback route redirects used links into the guest auth surface', async ({ page }) => {
    await page.goto(
      '/api/auth/callback?token_hash=already-used-test-token&redirectedFrom=%2Fguest%2Fdashboard',
    );

    await expect(page).toHaveURL(/\/auth(\?|$)/);
    await expect(page.getByRole('heading', { name: 'Choose your path' })).toBeVisible();

    const guestSignInLink = page.getByRole('link', { name: 'Sign in as Guest' });
    await expect(guestSignInLink).toHaveAttribute(
      'href',
      /error=link_expired|error=link_used|error=auth_failed/,
    );
    await expect(guestSignInLink).not.toHaveAttribute('href', /otp_disabled|already%20been%20used/);
  });
});
