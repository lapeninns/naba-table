import { expect, test } from '@playwright/test';

const shouldRunMyBookingsFlow = process.env.PLAYWRIGHT_TEST_DASHBOARD === 'true';
const demoEmail = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'qa@example.com';
const demoPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'password123';

const upcomingBooking = {
  id: 'booking-abc',
  restaurantName: 'Test Bistro',
  partySize: 2,
  startIso: '2050-01-01T18:00:00.000Z',
  endIso: '2050-01-01T20:00:00.000Z',
  status: 'confirmed',
  notes: null,
};

const cancelledBooking = {
  ...upcomingBooking,
  status: 'cancelled' as const,
};

test.describe('my bookings access control', () => {
  test('redirects anonymous users to sign-in', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/my-bookings');

    await expect(page).toHaveURL(/\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get('redirectedFrom')).toBe('/my-bookings');
  });
});

test.describe('my bookings cancel flow', () => {
  test.skip(!shouldRunMyBookingsFlow, 'Enable PLAYWRIGHT_TEST_DASHBOARD=true with valid credentials to exercise my bookings flow.');

  test('cancels an upcoming booking with optimistic update', async ({ page, baseURL, context }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    let state: 'initial' | 'cancelled' = 'initial';

    await page.route('**/api/bookings?**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.searchParams.get('me') !== '1') {
        return route.continue();
      }

      const body = state === 'initial'
        ? {
            items: [upcomingBooking],
            pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
          }
        : {
            items: [cancelledBooking],
            pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
          };

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    });

    await page.route('**/api/bookings/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        return route.continue();
      }

      state = 'cancelled';
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(demoEmail);
    await page.getByLabel(/password/i).fill(demoPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/my-bookings/);
    await expect(page.getByRole('heading', { name: /my bookings/i })).toBeVisible();

    const row = page.getByRole('row', { name: /test bistro/i });
    await expect(row).toContainText('Confirmed');

    await row.getByRole('button', { name: /^Cancel$/ }).click();

    const dialog = page.getByRole('dialog', { name: /cancel this booking/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /cancel booking/i }).click();

    await expect(row).toContainText('Cancelled');
    await expect(row.getByRole('button', { name: /^Cancel$/ })).toBeDisabled();

    const storage = await context.storageState();
    expect(storage.cookies.length).toBeGreaterThan(0);
  });
});
