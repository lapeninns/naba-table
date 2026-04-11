import { expect, test } from '@playwright/test';

const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingReference = 'NB1234';

test('guest can complete a booking flow', async ({ page }) => {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? '2026-02-01';
      const to = url.searchParams.get('to') ?? '2026-02-28';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timezone: 'Europe/London',
          from,
          to,
          closedDaysOfWeek: [],
          closedDates: [],
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/schedule')) {
      const date = url.searchParams.get('date') ?? '2026-02-10';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurantId,
          date,
          timezone: 'Europe/London',
          intervalMinutes: 15,
          defaultDurationMinutes: 90,
          lastSeatingBufferMinutes: 0,
          window: { opensAt: '12:00', closesAt: '22:00' },
          isClosed: false,
          availableBookingOptions: ['dinner'],
          slots: [
            {
              value: '19:00',
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
      body: JSON.stringify({
        restaurant: {
          id: restaurantId,
          slug: restaurantSlug,
          name: 'The Fox',
          address: '1 High Street, London',
          phone: '+441234567890',
          email: 'hello@thefox.test',
          policy: 'You can cancel up to 24 hours before your reservation.',
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      }),
    });
  });

  await page.route('**/api/bookings**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
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
        booking: {
          id: bookingId,
          restaurant_id: restaurantId,
          booking_date: '2026-02-10',
          start_time: '19:00',
          end_time: '20:30',
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
            timezone: 'Europe/London',
          },
        },
        bookings: [
          {
            id: bookingId,
            restaurant_id: restaurantId,
            booking_date: '2026-02-10',
            start_time: '19:00',
            end_time: '20:30',
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
              timezone: 'Europe/London',
            },
          },
        ],
      }),
    });
  });

  await page.goto(`/r/${restaurantSlug}`);

  await page.getByRole('button', { name: 'Date' }).click();
  await page
    .getByRole('button', { name: 'Tuesday, February 10th, 2026' })
    .click();

  await page.getByRole('combobox', { name: 'Time' }).click();
  await page.getByRole('option', { name: '7:00 PM' }).click();

  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Full name').fill('Guest Booker');
  await page.getByLabel('Email address').fill('guest@example.com');
  await page.getByLabel('UK phone number').fill('+441234567890');
  await page.getByRole('button', { name: /Preferences/i }).click();
  await page
    .getByRole('checkbox', { name: /I agree to the terms and privacy notice/i })
    .check();

  await page.getByRole('button', { name: 'Review booking' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  await expect(page.getByText(bookingReference)).toBeVisible();
});

test('guest sees a friendly duplicate-booking error instead of a raw code', async ({ page }) => {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? '2026-02-01';
      const to = url.searchParams.get('to') ?? '2026-02-28';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timezone: 'Europe/London',
          from,
          to,
          closedDaysOfWeek: [],
          closedDates: [],
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/schedule')) {
      const date = url.searchParams.get('date') ?? '2026-02-10';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurantId,
          date,
          timezone: 'Europe/London',
          intervalMinutes: 15,
          defaultDurationMinutes: 90,
          lastSeatingBufferMinutes: 0,
          window: { opensAt: '12:00', closesAt: '22:00' },
          isClosed: false,
          availableBookingOptions: ['dinner'],
          slots: [
            {
              value: '19:00',
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
      body: JSON.stringify({
        restaurant: {
          id: restaurantId,
          slug: restaurantSlug,
          name: 'The Fox',
          address: '1 High Street, London',
          phone: '+441234567890',
          email: 'hello@thefox.test',
          policy: 'You can cancel up to 24 hours before your reservation.',
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      }),
    });
  });

  await page.route('**/api/bookings**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'DUPLICATE_RESOURCE',
        error: 'duplicate key value violates unique constraint',
      }),
    });
  });

  await page.goto(`/r/${restaurantSlug}`);

  await page.getByRole('button', { name: 'Date' }).click();
  await page
    .getByRole('button', { name: 'Tuesday, February 10th, 2026' })
    .click();

  await page.getByRole('combobox', { name: 'Time' }).click();
  await page.getByRole('option', { name: '7:00 PM' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Full name').fill('Guest Booker');
  await page.getByLabel('Email address').fill('guest@example.com');
  await page.getByLabel('UK phone number').fill('+441234567890');
  await page
    .getByRole('checkbox', { name: /I agree to the terms and privacy notice/i })
    .check();

  await page.getByRole('button', { name: 'Review booking' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(
    page.getByText(
      'We already have a booking with those details. Please check your confirmation email or call the restaurant if you need help.',
    ),
  ).toBeVisible();
  await expect(page.getByText('DUPLICATE_RESOURCE')).toHaveCount(0);
});
