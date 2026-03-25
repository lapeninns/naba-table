import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:3000';
const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingReference = 'NB1234';
const bookingDate = '2026-02-10';
const bookingStartTime = '19:00';
const bookingEndTime = '20:30';
const bookingStartIso = '2026-02-10T19:00:00.000Z';
const bookingEndIso = '2026-02-10T20:30:00.000Z';
const restaurantTimezone = 'Europe/London';

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

test.describe('guest booking management', () => {
  test.use({ baseURL: appBaseUrl });

  test.beforeEach(async ({ page }) => {
    const bookingState: BookingState = {
      notes: 'Window please',
      partySize: 2,
      status: 'confirmed',
    };

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

  test('recovery-authorized booking detail is readable', async ({ page }) => {
    await page.goto('/dev/booking-recovery?fixture=active&autoStart=1');

    await expect(page).toHaveURL(`${appBaseUrl}/bookings/${bookingId}`);
    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(page.getByText(bookingReference)).toBeVisible();
    await expect(page.getByText('Party Size')).toBeVisible();
  });

  test('recovery-authorized detail keeps manage actions read-only and preserves rebook', async ({ page }) => {
    await page.goto('/dev/booking-recovery?fixture=active&autoStart=1');

    await expect(page.getByRole('button', { name: 'Modify Details' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel Booking' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Book Again' })).toBeEnabled();

    await page.getByRole('button', { name: 'Book Again' }).click();
    await expect(page).toHaveURL(
      `${appBaseUrl}/restaurants/${restaurantSlug}/book?source=rebook&reservationId=${bookingId}`,
    );
  });

  test('legacy manage route redirects to sign-in handoff without recovery session', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}/manage?view=manage`);

    await expect(page).toHaveURL(
      `${appBaseUrl}/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252F${bookingId}%253Fview%253Dmanage`,
    );
  });
});
