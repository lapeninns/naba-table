import { buildFutureBookingDate } from './future-booking';

import type { Page, Route } from '@playwright/test';

export const bookingFixture = {
  bookingId: '22222222-2222-4222-8222-222222222222',
  bookingReference: 'QA-BOOKING-1234',
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'qa-public-booking',
  time: '12:30',
  timeLabel: '12:30 PM',
  date: buildFutureBookingDate().isoDate,
} as const;

export type BookingCreateMode = 'capacity' | 'server-error' | 'success';

export type BookingMockState = {
  mode: BookingCreateMode;
  readonly emptySchedule?: boolean;
  readonly scheduleDelayMs?: number;
};

export async function seedBookingWizardDraft(page: Page): Promise<void> {
  await page.addInitScript(
    ({ date, slug, time }) => {
      const now = Date.now();
      window.localStorage.setItem(
        `reserve.wizard.draft.${slug}`,
        JSON.stringify({
          version: 1,
          savedAt: now,
          expiresAt: now + 6 * 60 * 60 * 1000,
          details: {
            bookingId: null,
            restaurantId: '',
            restaurantSlug: slug,
            restaurantName: '',
            restaurantAddress: '',
            restaurantTimezone: '',
            reservationDurationMinutes: 90,
            date,
            time,
            party: 2,
            bookingType: 'lunch',
            notes: '',
            name: '',
            email: '',
            phone: '',
            rememberDetails: false,
            agree: false,
            marketingOptIn: false,
          },
        }),
      );
    },
    {
      date: bookingFixture.date,
      slug: bookingFixture.restaurantSlug,
      time: bookingFixture.time,
    },
  );
}

function schedulePayload(date: string, emptySchedule: boolean) {
  return {
    restaurantId: bookingFixture.restaurantId,
    evaluatedPartySize: 2,
    date,
    timezone: 'Europe/London',
    intervalMinutes: 15,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 0,
    window: { opensAt: '12:00', closesAt: '22:00' },
    isClosed: false,
    availableBookingOptions: ['lunch'],
    slots: emptySchedule
      ? []
      : [
          {
            value: bookingFixture.time,
            display: bookingFixture.timeLabel,
            periodId: null,
            periodName: 'Lunch',
            bookingOption: 'lunch',
            defaultBookingOption: 'lunch',
            durationMinutes: 90,
            availability: {
              services: {},
              labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
            },
            disabled: false,
          },
          {
            value: '13:00',
            display: '1:00 PM',
            periodId: null,
            periodName: 'Lunch',
            bookingOption: 'lunch',
            defaultBookingOption: 'lunch',
            durationMinutes: 90,
            availability: {
              services: {},
              labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
            },
            disabled: false,
          },
        ],
    occasionCatalog: [],
  };
}

function bookingPayload() {
  return {
    id: bookingFixture.bookingId,
    restaurant_id: bookingFixture.restaurantId,
    booking_date: bookingFixture.date,
    start_time: bookingFixture.time,
    end_time: '14:00',
    booking_type: 'lunch',
    seating_preference: 'indoor',
    status: 'confirmed',
    party_size: 2,
    customer_name: 'QA Guest',
    customer_email: 'qa.guest@example.test',
    customer_phone: '',
    marketing_opt_in: false,
    notes: null,
    reference: bookingFixture.bookingReference,
    restaurants: {
      name: 'QA Public Booking Restaurant',
      slug: bookingFixture.restaurantSlug,
      timezone: 'Europe/London',
    },
  };
}

export async function installBookingWizardMocks(
  page: Page,
  state: BookingMockState,
): Promise<void> {
  await page.context().setOffline(false);

  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/calendar-mask')) {
      await route.fulfill({
        json: {
          timezone: 'Europe/London',
          from: url.searchParams.get('from') ?? bookingFixture.date,
          to: url.searchParams.get('to') ?? bookingFixture.date,
          closedDaysOfWeek: [],
          closedDates: [],
        },
      });
      return;
    }

    if (url.pathname.endsWith('/schedule')) {
      if (state.scheduleDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, state.scheduleDelayMs));
      }
      await route.fulfill({
        json: schedulePayload(
          url.searchParams.get('date') ?? bookingFixture.date,
          state.emptySchedule === true,
        ),
      });
      return;
    }

    if (url.pathname.endsWith(`/api/restaurants/${bookingFixture.restaurantSlug}`)) {
      await route.fulfill({
        json: {
          restaurant: {
            id: bookingFixture.restaurantId,
            slug: bookingFixture.restaurantSlug,
            name: 'QA Public Booking Restaurant',
            address: '1 QA Street, Test Town',
            phone: '+440000000000',
            email: 'qa.restaurant@example.test',
            policy: 'QA fixtures only.',
            timezone: 'Europe/London',
            logoUrl: null,
            googleMapUrl: null,
          },
        },
      });
      return;
    }

    await route.continue();
  });

  const handleBookingRoute = async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ json: { bookings: [] } });
      return;
    }

    if (state.mode === 'server-error') {
      await route.fulfill({ status: 500, json: { error: 'Booking could not be completed.' } });
      return;
    }

    if (state.mode === 'capacity') {
      await route.fulfill({
        status: 409,
        json: {
          code: 'CAPACITY_EXCEEDED',
          message: 'No tables are available at that time. Please choose another slot.',
          alternatives: [{ time: '13:00', available: true, utilizationPercent: 61 }],
          retryable: false,
        },
      });
      return;
    }

    const booking = bookingPayload();
    await route.fulfill({ json: { booking, bookings: [booking] } });
  };

  await page.route('**/api/bookings**', handleBookingRoute);
  await page.route('**/api/ops/bookings**', handleBookingRoute);
}
