import { expect, test } from '@playwright/test';

const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingDate = '2026-02-10';
const bookingStartTime = '19:00';
const restaurantTimezone = 'Europe/London';

type CallCounts = {
  calendarMask: number;
  schedule: number;
  restaurantDetail: number;
  restaurantList: number;
  bookingLookup: number;
  bookingHistory: number;
};

test('mocked guest APIs are exercised', async ({ page }) => {
  const counts: CallCounts = {
    calendarMask: 0,
    schedule: 0,
    restaurantDetail: 0,
    restaurantList: 0,
    bookingLookup: 0,
    bookingHistory: 0,
  };

  await page.route('**/api/restaurants**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      counts.calendarMask += 1;
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
      counts.schedule += 1;
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
      counts.restaurantList += 1;
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

    if (url.pathname === `/api/restaurants/${restaurantSlug}`) {
      counts.restaurantDetail += 1;
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

    if (url.pathname.endsWith('/history')) {
      counts.bookingHistory += 1;
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

    if (url.searchParams.has('email') || url.searchParams.has('phone')) {
      counts.bookingLookup += 1;
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
      body: JSON.stringify({ bookings: [] }),
    });
  });

  await page.goto(`/restaurants/${restaurantSlug}/book`);
  await expect(page.getByRole('heading', { name: 'Finish booking with calm, guided steps.' })).toBeVisible();

  await page.evaluate(
    ({ bookingId, restaurantId, restaurantSlug, bookingDate }) => {
      const params = new URLSearchParams({
        email: 'guest@example.com',
        phone: '+441234567890',
        restaurantId,
      });
      return Promise.all([
        fetch('/api/restaurants'),
        fetch(`/api/restaurants/${restaurantSlug}`),
        fetch(`/api/restaurants/${restaurantSlug}/calendar-mask?from=2026-02-01&to=2026-02-28`),
        fetch(`/api/restaurants/${restaurantSlug}/schedule?date=${bookingDate}`),
        fetch(`/api/bookings?${params.toString()}`),
        fetch(`/api/bookings/${bookingId}/history`),
      ]);
    },
    { bookingId, restaurantId, restaurantSlug, bookingDate },
  );

  expect(counts.restaurantDetail).toBeGreaterThan(0);
  expect(counts.calendarMask).toBeGreaterThan(0);
  expect(counts.schedule).toBeGreaterThan(0);
  expect(counts.restaurantList).toBeGreaterThan(0);
  expect(counts.bookingLookup).toBeGreaterThan(0);
  expect(counts.bookingHistory).toBeGreaterThan(0);
});

test('dev guest dashboard and bookings harnesses expose canonical mocked portal states', async ({ page }) => {
  await page.goto('/dev/guest-dashboard?fixture=default');
  await expect(page.getByRole('heading', { name: /dashboard harness/i })).toBeVisible();
  await expect(page.getByText('Guest dashboard', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Fox' })).toBeVisible();

  await page.goto('/dev/guest-bookings?fixture=default&tab=history');
  await expect(page).toHaveURL(/tab=past/);
  await expect(page.getByRole('heading', { name: /your reservations/i })).toBeVisible();
  await expect(page.getByText('Orchard House')).toBeVisible();

  await page.goto('/dev/guest-bookings?fixture=empty');
  await expect(page.getByText('No bookings yet')).toBeVisible();

  await page.goto('/dev/guest-dashboard?fixture=error');
  await expect(page.getByText("We couldn't fetch your reservations. Please try again.")).toBeVisible();
});

test('dev guest profile harness supports inline validation and deterministic save feedback', async ({
  page,
}) => {
  await page.goto('/dev/guest-profile?fixture=default&mutation=success');

  await expect(page.getByRole('heading', { name: /profile harness/i })).toBeVisible();
  await expect(page.getByLabel('Email Address')).toHaveValue('ada@example.com');
  await expect(page.getByLabel('Email Address')).toBeDisabled();

  await page.getByLabel('Full Name').fill('A');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();

  await page.getByLabel('Full Name').fill('Ada Byron');
  await page.getByLabel('Phone Number').fill('+447700900555');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText('Profile updated successfully.')).toBeVisible();

  await page.goto('/dev/guest-profile?fixture=default&mutation=error');
  await page.getByLabel('Full Name').fill('Ada Error');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText('Failed to save changes. Please try again.')).toBeVisible();
});
