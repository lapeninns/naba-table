import { expect, test } from '@playwright/test';

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

const bookingPayload = {
  id: bookingId,
  restaurant_id: restaurantId,
  booking_date: bookingDate,
  start_time: bookingStartTime,
  end_time: bookingEndTime,
  start_at: bookingStartIso,
  end_at: bookingEndIso,
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  party_size: 2,
  customer_name: 'Guest Booker',
  customer_email: 'guest@example.com',
  customer_phone: '+441234567890',
  marketing_opt_in: false,
  notes: 'Window please',
  reference: bookingReference,
  restaurants: {
    name: 'The Fox',
    slug: restaurantSlug,
    timezone: restaurantTimezone,
  },
};

test.describe('reserve routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/restaurants**', async (route) => {
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

      if (url.pathname.endsWith('/api/restaurants')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: restaurantId,
                slug: restaurantSlug,
                name: 'The Fox',
                address: '1 High Street, London',
                timezone: restaurantTimezone,
                capacity: 80,
                bookingPolicy: 'You can cancel up to 24 hours before your reservation.',
                contactEmail: 'hello@thefox.test',
                contactPhone: '+441234567890',
                googleMapUrl: null,
                logoUrl: null,
                reservationIntervalMinutes: 15,
                reservationDefaultDurationMinutes: 90,
                reservationLastSeatingBufferMinutes: 0,
                reservationLifecycleGraceMinutes: 0,
                isActive: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurant: {
            id: restaurantId,
            slug: restaurantSlug,
            name: 'The Fox',
            address: '1 High Street, London',
            phone: '+441234567890',
            email: 'hello@thefox.test',
            policy: 'You can cancel up to 24 hours before your reservation.',
            timezone: restaurantTimezone,
            logoUrl: null,
            googleMapUrl: null,
          },
        }),
      });
    });

    await page.route('**/api/bookings**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() !== 'POST') {
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
          body: JSON.stringify({ bookings: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          booking: bookingPayload,
          bookings: [bookingPayload],
        }),
      });
    });
  });

  test('reserve root shows plan step', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'When would you like to join us?' }),
    ).toBeVisible();
  });

  test('reserve new alias shows plan step', async ({ page }) => {
    await page.goto('/new');
    await expect(
      page.getByRole('heading', { name: 'When would you like to join us?' }),
    ).toBeVisible();
  });

  test('reserve reservation details stub renders id', async ({ page }) => {
    await page.goto('/resv-test-123');
    await expect(page.getByRole('heading', { name: 'Reservation resv-test-123' })).toBeVisible();
    await expect(page.getByText('Details view coming soon.')).toBeVisible();
  });

  test('reserve not found route shows guidance', async ({ page }) => {
    await page.goto('/missing/path');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to reservations' })).toBeVisible();
  });

  test('restaurant detail and booking entry stay on guest-owned routes', async ({ page }) => {
    await page.goto(`/restaurants/${restaurantSlug}`);

    await expect(page).toHaveURL(`http://localhost:3000/restaurants/${restaurantSlug}`);
    await expect(page.getByRole('heading', { name: 'We couldn’t find that restaurant page.' })).toBeVisible();
    await expect(page.locator('#main-content').getByRole('link', { name: 'Browse restaurants' })).toBeVisible();
  });
});
