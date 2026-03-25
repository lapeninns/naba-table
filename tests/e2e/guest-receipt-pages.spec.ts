import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:3000';
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

const pendingBookingPayload = {
  ...bookingPayload,
  id: '44444444-4444-4444-8444-444444444444',
  reference: 'NB9012',
  status: 'pending',
};

const cancelledBookingPayload = {
  ...bookingPayload,
  id: '55555555-5555-4555-8555-555555555555',
  reference: 'NB3456',
  status: 'cancelled',
};

test.describe('guest receipt pages', () => {
  test.use({ baseURL: appBaseUrl });

  test.beforeEach(async ({ page }) => {
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

      if (url.pathname.endsWith(`/bookings/${pendingBookingPayload.id}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ booking: pendingBookingPayload }),
        });
        return;
      }

      if (url.pathname.endsWith(`/bookings/${cancelledBookingPayload.id}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ booking: cancelledBookingPayload }),
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

  test('legacy thank-you redirects to receipt and preserves query params', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}/thank-you?token=abc123&source=email`);

    await expect(page).toHaveURL(
      `${appBaseUrl}/guest/bookings/${bookingId}/receipt?token=abc123&source=email`,
    );
    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(
      page.getByText('Save this receipt for easier check-in when you arrive.'),
    ).toBeVisible();
  });

  test('receipt page renders booking summary with token access', async ({ page }) => {
    await page.goto(`/guest/bookings/${bookingId}/receipt?token=abc123`);

    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(page.getByText(bookingReference)).toBeVisible();
    await expect(page.getByText('Party')).toBeVisible();
  });

  test('pending receipts avoid confirmed language', async ({ page }) => {
    await page.goto(`/guest/bookings/${pendingBookingPayload.id}/receipt?token=abc123`);

    await expect(page.getByText('Pending Confirmation')).toBeVisible();
    await expect(
      page.getByText('Your request has been received. We’ll confirm the reservation as soon as the venue reviews it.'),
    ).toBeVisible();
    await expect(
      page.getByText('We’ll email you as soon as the venue confirms or updates this reservation.'),
    ).toBeVisible();
  });

  test('cancelled receipts use cancelled messaging', async ({ page }) => {
    await page.goto(`/guest/bookings/${cancelledBookingPayload.id}/receipt?token=abc123`);

    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByText('This reservation has been cancelled.')).toBeVisible();
    await expect(
      page.getByText('Need another table? You can start a fresh booking whenever you’re ready.'),
    ).toBeVisible();
  });
});
