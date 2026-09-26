import { expect, test } from '@playwright/test';

import { buildFutureBookingDate } from './helpers/future-booking';
import { createBookingAccessToken } from '../../server/security/booking-access-token';

const appBaseUrl = 'http://localhost:5180';
const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingReference = 'NB1234';
const futureBooking = buildFutureBookingDate();
const bookingDate = futureBooking.isoDate;
const bookingStartTime = '19:00';
const bookingEndTime = '20:30';
const bookingStartIso = futureBooking.startIsoUtc;
const bookingEndIso = futureBooking.endIsoUtc;
const restaurantTimezone = 'Europe/London';
const accessSecret = 'test-session-recovery-secret';

type BookingState = {
  notes: string | null;
  partySize: number;
  status: 'confirmed' | 'cancelled';
};

const buildBookingApiPayload = (state: BookingState) => ({
  id: bookingId,
  restaurant_id: restaurantId,
  booking_date: bookingDate,
  start_time: bookingStartTime,
  end_time: bookingEndTime,
  start_at: bookingStartIso,
  end_at: bookingEndIso,
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: state.status,
  party_size: state.partySize,
  customer_name: 'Guest Booker',
  customer_email: 'guest@example.com',
  customer_phone: '+441234567890',
  marketing_opt_in: false,
  notes: state.notes,
  reference: bookingReference,
  restaurants: {
    name: 'The Fox',
    slug: restaurantSlug,
    timezone: restaurantTimezone,
  },
});

const buildBookingDto = (state: BookingState) => ({
  id: bookingId,
  restaurantId,
  restaurantName: 'The Fox',
  restaurantSlug,
  restaurantTimezone,
  partySize: state.partySize,
  startIso: bookingStartIso,
  endIso: bookingEndIso,
  status: state.status,
  notes: state.notes,
  customerName: 'Guest Booker',
  customerEmail: 'guest@example.com',
  customerPhone: '+441234567890',
  reservationIntervalMinutes: 15,
});

/**
 * Booking-scoped access cookie (bk1) for the fixture booking, signed with the QA
 * SESSION_RECOVERY_ACCESS_TOKEN_SECRET. Over plain http (local QA) the app reads the
 * non-__Host development cookie name. The server-side page gate also reads the booking
 * row, so the QA database must hold this booking.
 */
function bookingAccessCookie(booking: {
  id: string;
  restaurant_id: string;
  customer_email: string;
  customer_phone: string;
  start_at?: string | null;
  end_at?: string | null;
  booking_date?: string | null;
}) {
  const access = createBookingAccessToken({
    booking,
    secret: accessSecret,
    source: 'redeem',
  });
  if (!access) {
    throw new Error('fixture booking cannot hold an access token');
  }
  return { name: `nt_bk.${booking.id}`, value: access.token, url: appBaseUrl };
}

test.describe('guest booking management', () => {
  test.use({ baseURL: appBaseUrl });

  test.beforeEach(async ({ page, context }) => {
    const bookingState: BookingState = {
      notes: 'Window please',
      partySize: 2,
      status: 'confirmed',
    };

    await context.addCookies([bookingAccessCookie(buildBookingApiPayload(bookingState))]);

    await page.route('**/api/restaurants/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith('/calendar-mask')) {
        const from = url.searchParams.get('from') ?? '2026-02-01';
        const to = url.searchParams.get('to') ?? '2026-02-28';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            timezone: restaurantTimezone,
            from,
            to,
            closedDaysOfWeek: [],
            closedDates: [],
          }),
        });
        return;
      }

      if (url.pathname.endsWith('/schedule')) {
        const date = url.searchParams.get('date') ?? bookingDate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            restaurantId,
            date,
            timezone: restaurantTimezone,
            intervalMinutes: 15,
            defaultDurationMinutes: 90,
            lastSeatingBufferMinutes: 0,
            window: { opensAt: '12:00', closesAt: '22:00' },
            isClosed: false,
            availableBookingOptions: ['dinner'],
            slots: [
              {
                value: bookingStartTime,
                display: '7:00 PM',
                periodId: null,
                periodName: 'Dinner',
                bookingOption: 'dinner',
                defaultBookingOption: 'dinner',
                availability: {
                  services: {},
                  labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
                },
                disabled: false,
              },
            ],
            occasionCatalog: [],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.route('**/api/bookings/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname.endsWith('/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [],
            pagination: { limit: 10, offset: 0, count: 0 },
          }),
        });
        return;
      }

      if (url.pathname.endsWith('/bookings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookings: [] }),
        });
        return;
      }

      if (url.pathname.endsWith(`/bookings/${bookingId}`)) {
        if (request.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ booking: buildBookingApiPayload(bookingState) }),
          });
          return;
        }

        if (request.method() === 'PUT') {
          const body = request.postDataJSON?.() as {
            partySize?: number;
            notes?: string | null;
          } | null;
          if (body?.partySize) {
            bookingState.partySize = body.partySize;
          }
          if (body?.notes !== undefined) {
            bookingState.notes = body.notes ?? null;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildBookingDto(bookingState)),
          });
          return;
        }

        if (request.method() === 'DELETE') {
          bookingState.status = 'cancelled';
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: bookingId, status: bookingState.status }),
          });
          return;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('guest can view booking details', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}`);

    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(page.getByText(bookingReference)).toBeVisible();
    await expect(page.getByText('Party Size')).toBeVisible();
  });

  test('guest can update and cancel a booking', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}`);

    await page.getByRole('button', { name: 'Modify Details' }).click();
    await page.getByLabel('Notes (optional)').fill('Updated note for the team');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      page.locator('#main-content').getByText('Updated note for the team'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    await expect(page.getByRole('heading', { name: 'Cancel this booking?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(page.getByText('Cancelled')).toBeVisible();
  });

  test('legacy manage route redirects to booking detail', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}/manage?view=manage`);

    await expect(page).toHaveURL(`${appBaseUrl}/bookings/${bookingId}?view=manage`);
    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
  });
});
