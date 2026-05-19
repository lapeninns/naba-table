import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';

const appBaseUrl = 'http://localhost:5180';
const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '33333333-3333-4333-8333-333333333333';
const bookingReference = 'NB5678';
const restaurantTimezone = 'Europe/London';

type BookingState = {
  bookingDate: string;
  startTime: string;
  endTime: string;
  staleStartAt: string;
  staleEndAt: string;
  notes: string | null;
};

function localUtcIso(date: string, time: string): string {
  const resolved = DateTime.fromISO(`${date}T${time}`, { zone: restaurantTimezone }).toUTC();
  const iso = resolved.toISO();
  if (!iso) {
    throw new Error(`Unable to build UTC ISO for ${date} ${time}`);
  }
  return iso;
}

function futureDate(daysAhead: number): string {
  return DateTime.now().setZone(restaurantTimezone).plus({ days: daysAhead }).toISODate() ?? '';
}

function buildBookingApiPayload(state: BookingState) {
  return {
    id: bookingId,
    restaurant_id: restaurantId,
    booking_date: state.bookingDate,
    start_time: state.startTime,
    end_time: state.endTime,
    start_at: state.staleStartAt,
    end_at: state.staleEndAt,
    booking_type: 'dinner',
    seating_preference: 'indoor',
    status: 'confirmed',
    party_size: 2,
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
  };
}

function buildSchedulePayload(date: string) {
  return {
    restaurantId,
    date,
    timezone: restaurantTimezone,
    intervalMinutes: 15,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 0,
    window: { opensAt: '12:00', closesAt: '23:00' },
    isClosed: false,
    availableBookingOptions: ['dinner'],
    slots: ['20:15', '20:45'].map((value) => ({
      value,
      display: value,
      periodId: null,
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: {},
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: false,
    })),
    occasionCatalog: [],
  };
}

test.describe('guest booking instant sync', () => {
  test.use({ baseURL: appBaseUrl });

  test('detail uses edited booking date/time when stored instants are stale', async ({
    page,
    context,
  }) => {
    const originalDate = futureDate(8);
    const updatedDate = futureDate(9);
    const staleStartAt = localUtcIso(originalDate, '18:00');
    const staleEndAt = localUtcIso(originalDate, '19:30');
    const state: BookingState = {
      bookingDate: originalDate,
      startTime: '20:15',
      endTime: '21:45',
      staleStartAt,
      staleEndAt,
      notes: 'Window please',
    };

    await context.addCookies([
      {
        name: 'sr_access',
        value: 'test-session',
        url: appBaseUrl,
      },
    ]);

    await page.route('**/api/restaurants/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith('/calendar-mask')) {
        const from = url.searchParams.get('from') ?? originalDate;
        const to = url.searchParams.get('to') ?? updatedDate;
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildSchedulePayload(url.searchParams.get('date') ?? originalDate)),
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

      if (url.pathname.endsWith(`/bookings/${bookingId}`)) {
        if (request.method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ booking: buildBookingApiPayload(state) }),
          });
          return;
        }

        if (request.method() === 'PUT') {
          const body = request.postDataJSON?.() as { notes?: string | null } | null;
          state.bookingDate = updatedDate;
          state.startTime = '20:45';
          state.endTime = '22:15';
          state.notes = body?.notes ?? state.notes;

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: bookingId,
              restaurantName: 'The Fox',
              partySize: 2,
              startIso: localUtcIso(updatedDate, '20:45'),
              endIso: localUtcIso(updatedDate, '22:15'),
              status: 'confirmed',
              notes: state.notes,
              booking: buildBookingApiPayload(state),
            }),
          });
          return;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [] }),
      });
    });

    await page.goto(`/bookings/${bookingId}`);

    await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();
    await expect(page.locator('main').getByText('20:15')).toBeVisible();
    await expect(page.locator('main').getByText('18:00')).toHaveCount(0);

    await page.getByRole('button', { name: 'Modify Details' }).click();
    await page.getByLabel('Notes (optional)').fill('Updated note for the team');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.locator('main').getByText('20:45')).toBeVisible();
    await expect(page.locator('main').getByText('Updated note for the team')).toBeVisible();
    await expect(page.locator('main').getByText('18:00')).toHaveCount(0);
  });
});
