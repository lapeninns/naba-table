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

  test('booking recovery error shows deprecated legacy-link next steps', async ({ page }) => {
    await page.goto('/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED');

    await expect(page.getByRole('heading', { name: 'Link is outdated' })).toBeVisible();
    await expect(
      page.getByText('Please use the latest link from your email or sign in', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('#main-content').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  });

  test('dev booking recovery harness links into a token-free entitled final destination', async ({
    page,
  }) => {
    await page.goto('/dev/booking-recovery?fixture=active');

    await expect(page.getByRole('heading', { name: 'Tokenized booking recovery fixture' })).toBeVisible();
    await expect(page.getByText('Active booking detail + receipt')).toBeVisible();

    const recoveryHref = await page
      .getByRole('link', { name: 'Open recovery link', exact: true })
      .getAttribute('href');
    expect(recoveryHref).toContain('/bookings/recover?access_token=');
    expect(recoveryHref).toContain('next=%2Fbookings%2F22222222-2222-4222-8222-222222222222');
  });

  test('mocked booking-detail comparison harness exposes public and guest detail surfaces side by side', async ({
    page,
  }) => {
    await page.goto('/dev/booking-detail-comparison?fixture=cancelled');

    await expect(page.getByRole('heading', { name: 'Public and guest booking detail comparison' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Public booking detail fixture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guest booking detail fixture' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Guest booking detail fixture' })).toBeVisible();
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

  test('restaurants empty-state fixture renders calm guest guidance and next steps', async ({
    page,
  }) => {
    await page.goto('/restaurants?fixture=empty-state');

    await expect(
      page.getByRole('heading', { name: 'No tables are open to book just yet' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to guest home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try the full restaurant list' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View my bookings' })).toBeVisible();
  });
});
