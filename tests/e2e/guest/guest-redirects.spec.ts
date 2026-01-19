/**
 * Guest Redirect Coverage E2E Tests
 *
 * Validates legacy routes permanently redirect to canonical guest paths.
 */

import { test, expect } from '../fixtures/auth.fixture';

import { resolveGuestBookingId } from '../fixtures/guest-booking-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.setTimeout(45_000);

test.describe('@guest @smoke Guest Redirects', () => {
  test('legacy public routes redirect to canonical paths', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`);
    await expect(page).toHaveURL(/\/auth\/signin/);

    await page.goto(`${BASE_URL}/browse`);
    await expect(page).toHaveURL(/\/restaurants/);
  });

  test('legacy booking redirects resolve to canonical receipt/detail', async ({ guestPage }) => {
    const bookingId = await resolveGuestBookingId(guestPage, BASE_URL);

    await guestPage.goto(`${BASE_URL}/guest/bookings/${bookingId}`);
    await expect(guestPage).toHaveURL(new RegExp(`/bookings/${bookingId}`));

    await guestPage.goto(`${BASE_URL}/thank-you?bookingId=${bookingId}`);
    await expect(guestPage).toHaveURL(new RegExp(`/guest/bookings/${bookingId}/receipt`));
  });
});
