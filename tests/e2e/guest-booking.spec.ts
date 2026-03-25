import { expect, test } from '@playwright/test';

const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';

test('guest booking route renders the guided shell on the canonical booking URL', async ({ page }) => {
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookings: [] }),
    });
  });

  await page.goto(`/restaurants/${restaurantSlug}/book`);

  await expect(page.getByRole('heading', { name: 'Finish booking with calm, guided steps.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Fox' }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Date' })).toBeVisible();
  await expect(page.getByText('Pick a date to see available times.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});
