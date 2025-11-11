import { expect, test } from '../../fixtures/auth';

import type { APIRequestContext } from '@playwright/test';


type CreateBookingResponse = {
  bookingId: string;
};

function testRouteHeaders() {
  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;
  return apiKey ? { 'x-test-route-key': apiKey } : undefined;
}

async function resolveRestaurantContext(request: APIRequestContext) {
  const response = await request.get('/api/restaurants');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const restaurants = Array.isArray(payload?.data) ? payload.data : [];
  expect(restaurants.length).toBeGreaterThan(0);
  const first = restaurants[0] as { id: string; slug: string };
  return { id: first.id, slug: first.slug };
}

async function createTestBooking(request: APIRequestContext) {
  const restaurant = await resolveRestaurantContext(request);
  const response = await request.post('/api/test/bookings', {
    data: {
      email: process.env.PLAYWRIGHT_AUTH_EMAIL ?? 'qa.manager@example.com',
      name: 'QA Confirmation Guest',
      phone: '07123 456789',
      status: 'confirmed',
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    },
    headers: testRouteHeaders(),
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as CreateBookingResponse;
  expect(body.bookingId).toBeTruthy();
  return body.bookingId;
}

test.describe('reservation detail page', () => {
  test('share CTA surfaces clipboard message', async ({ authedPage, request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    const bookingId = await createTestBooking(request);

    await authedPage.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.resolve(),
        },
      });
    });

    await authedPage.goto(`/reserve/${bookingId}`);
    const shareButton = authedPage.getByRole('button', { name: /share details/i });
    await expect(shareButton).toBeEnabled();

    await shareButton.click();
    await expect(authedPage.getByText(/Reservation details copied/i)).toBeVisible();
  });

  test('offline alert appears and share CTA disables when network drops', async ({ authedPage, request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    const bookingId = await createTestBooking(request);

    await authedPage.goto(`/reserve/${bookingId}`);
    const context = authedPage.context();

    await context.setOffline(true);
    await expect(authedPage.getByText(/You'?re offline/i)).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /share details/i })).toBeDisabled();
    await context.setOffline(false);
  });
});
