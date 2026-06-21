import { expect, test } from '@playwright/test';

import { createSessionRecoveryAccessToken } from '../../server/security/session-recovery-access-token';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appBaseUrl = `http://localhost:${appPort}`;
const recoverySecret = 'test-session-recovery-secret';
const bookingId = '33333333-3333-4333-8333-333333333333';
const bookingReference = 'NB5678';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const restaurantSlug = 'the-fox';
const restaurantTimezone = 'Europe/London';

const bookingPayload = {
  id: bookingId,
  restaurant_id: restaurantId,
  booking_date: '2026-02-12',
  start_time: '18:30',
  end_time: '20:00',
  start_at: '2026-02-12T18:30:00.000Z',
  end_at: '2026-02-12T20:00:00.000Z',
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  party_size: 4,
  customer_name: 'Receipt Guest',
  customer_email: 'receipt@example.com',
  customer_phone: '+441234567891',
  marketing_opt_in: true,
  notes: null,
  reference: bookingReference,
  restaurants: {
    name: 'The Fox',
    slug: restaurantSlug,
    timezone: restaurantTimezone,
  },
};

test.describe('guest receipt pages', () => {
  test.use({ baseURL: appBaseUrl });

  test.beforeEach(async ({ page, context }) => {
    const recoveryToken = createSessionRecoveryAccessToken({
      restaurantId,
      email: bookingPayload.customer_email,
      phone: bookingPayload.customer_phone,
      secret: recoverySecret,
      ttlSeconds: 900,
    });

    await context.addCookies([
      {
        name: 'sr_access',
        value: recoveryToken,
        url: appBaseUrl,
      },
    ]);

    await page.route('**/api/bookings/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith(`/bookings/${bookingId}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ booking: bookingPayload }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('legacy thank-you redirects deprecated token links to recovery guidance', async ({
    page,
  }) => {
    await page.goto(`/bookings/${bookingId}/thank-you?token=abc123&source=email`);

    await expect(
      page.getByRole('heading', { name: 'This older booking link is no longer supported' }),
    ).toBeVisible();
  });

  test('receipt page renders booking summary with token access', async ({ page }) => {
    await page.goto(`/guest/bookings/${bookingId}/receipt`);

    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(page.getByText(bookingReference)).toBeVisible();
    await expect(page.getByText('Party')).toBeVisible();
  });
});
