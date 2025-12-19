/**
 * Guest Route Coverage E2E Tests
 *
 * Validates core guest/public routes render and key redirects resolve.
 */

import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

import { resolveGuestBookingId } from '../fixtures/guest-booking-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_RESTAURANT_SLUG = process.env.E2E_TEST_RESTAURANT_SLUG || 'white-horse-pub-waterbeach';

async function visitAndAssert(page: Page, path: string, locator: ReturnType<Page['locator']>) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await expect(locator).toBeVisible({ timeout: 10_000 });
}

test.setTimeout(60_000);

test.describe.serial('@guest @smoke Guest Route Coverage', () => {
  let bookingId: string | null = null;

  test('public discovery routes render', async ({ page }) => {
    await test.step('Home page loads', async () => {
      await visitAndAssert(page, '/', page.locator('main'));
    });

    await test.step('Sign-in page loads', async () => {
      await visitAndAssert(
        page,
        '/auth/signin',
        page.getByRole('heading', { name: /welcome back/i })
      );
    });

    await test.step('Restaurants list loads', async () => {
      await visitAndAssert(
        page,
        '/restaurants',
        page.getByRole('heading', { level: 1 }).first()
      );
      await expect(page.getByRole('heading', { name: /find the right table fast/i })).toBeVisible();
    });

    await test.step('Restaurant detail loads', async () => {
      await visitAndAssert(
        page,
        `/restaurants/${TEST_RESTAURANT_SLUG}`,
        page.getByRole('heading', { level: 1 }).first()
      );
      await expect(page.getByRole('link', { name: /book a table/i }).first()).toBeVisible();
    });

    await test.step('Restaurant booking entry loads', async () => {
      await visitAndAssert(
        page,
        `/restaurants/${TEST_RESTAURANT_SLUG}/book`,
        page.getByTestId('wizard-action-plan-continue')
      );
    });

    await test.step('Restaurant booking thank-you loads', async () => {
      await visitAndAssert(
        page,
        `/restaurants/${TEST_RESTAURANT_SLUG}/book/thank-you`,
        page.getByRole('heading', { name: /reservation confirmed/i })
      );
    });
  });

  test('guest portal and booking routes render', async ({ guestPage }) => {
    await test.step('Guest dashboard loads', async () => {
      await visitAndAssert(guestPage, '/guest/dashboard', guestPage.getByRole('heading', { level: 1 }).first());
      await expect(guestPage.getByText(/guest dashboard/i)).toBeVisible();
    });

    await test.step('Guest thank-you redirects to dashboard', async () => {
      await guestPage.goto(`${BASE_URL}/guest/thank-you`);
      await expect(guestPage).toHaveURL(/\/guest\/dashboard/);
    });

    await test.step('Resolve booking id for booking detail pages', async () => {
      bookingId = bookingId ?? (await resolveGuestBookingId(guestPage, BASE_URL));
      expect(bookingId).toBeTruthy();
    });

    await test.step('Booking detail page loads', async () => {
      if (!bookingId) {
        throw new Error('Booking id missing for booking detail coverage.');
      }
      await guestPage.goto(`${BASE_URL}/bookings/${bookingId}`);
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage.getByText(/manage booking/i)).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Booking thank-you redirects to receipt', async () => {
      if (!bookingId) {
        throw new Error('Booking id missing for receipt redirect coverage.');
      }
      await guestPage.goto(`${BASE_URL}/bookings/${bookingId}/thank-you`);
      await expect(guestPage).toHaveURL(new RegExp(`/guest/bookings/${bookingId}/receipt`));
      await expect(guestPage.getByText(/confirmation email has been sent/i)).toBeVisible({ timeout: 10_000 });
    });
  });
});
