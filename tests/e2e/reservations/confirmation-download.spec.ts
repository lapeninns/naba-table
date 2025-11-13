import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '../../fixtures/auth';

import type { APIRequestContext } from '@playwright/test';

const artifactsDir = path.resolve(__dirname, '../../artifacts');

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

test.describe('reservation detail confirmation download', () => {
  test('downloads confirmation for seeded booking', async ({ authedPage, request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await fs.mkdir(artifactsDir, { recursive: true });

    const restaurant = await resolveRestaurantContext(request);
    const createResponse = await request.post('/api/test/bookings', {
      data: {
        email: process.env.PLAYWRIGHT_AUTH_EMAIL ?? 'qa.manager@example.com',
        name: 'QA Download Guest',
        phone: '07123 456789',
        status: 'confirmed',
        restaurantId: restaurant.id,
        restaurantSlug: restaurant.slug,
      },
      headers: testRouteHeaders(),
    });

    expect(createResponse.ok()).toBeTruthy();
    const { bookingId } = await createResponse.json();
    expect(bookingId).toBeTruthy();

    await authedPage.goto(`/reserve/${bookingId}`);
    const downloadPromise = authedPage.waitForEvent('download');
    await authedPage.getByRole('button', { name: /Download confirmation/i }).click();
    const download = await downloadPromise;

    const filePath = path.join(artifactsDir, await download.suggestedFilename());
    await download.saveAs(filePath);
    const stats = await fs.stat(filePath);
    expect(stats.size).toBeGreaterThan(100);
  });
});
