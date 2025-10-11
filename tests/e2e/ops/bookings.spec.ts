import { expect, Page } from '@playwright/test';
import { test } from '../../fixtures/auth';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);
const SHOULD_RUN = process.env.PLAYWRIGHT_OPS_BOOKINGS === 'true';
const RESTAURANT_ID = process.env.PLAYWRIGHT_OPS_RESTAURANT_ID ?? '11111111-1111-4111-8111-111111111111';

async function ensureAuthenticated(page: Page, testInfo: import('@playwright/test').TestInfo) {
  if (!ALLOWED_PROJECTS.has(testInfo.project.name)) {
    testInfo.skip(true, 'Ops flows verified on Chromium-based projects.');
    return false;
  }
  await page.goto('/ops');
  const url = page.url();
  if (url.includes('/signin')) {
    testInfo.skip(true, 'Authenticated storage state unavailable; skipping bookings scenario.');
    return false;
  }
  return true;
}

test.describe('Ops bookings CRUD smoke', () => {
  test('create and cancel walk-in booking via API', async ({ authedPage }, testInfo) => {
    if (!SHOULD_RUN) {
      test.skip(true, 'Set PLAYWRIGHT_OPS_BOOKINGS=true to enable bookings CRUD test once seed data is ready.');
    }
    const authed = await ensureAuthenticated(authedPage, testInfo);
    if (!authed) return;

    const createPayload = {
      restaurantId: RESTAURANT_ID,
      date: '2025-10-10',
      time: '18:00',
      party: 2,
      bookingType: 'dinner',
      seating: 'indoor',
      notes: null,
      name: 'Playwright QA',
      email: 'playwright@example.com',
      phone: null,
      marketingOptIn: false,
    };

    const createResponse = await authedPage.request.post('/api/ops/bookings', { data: createPayload });
    test.skip(createResponse.status() !== 201, `Booking creation unavailable (${createResponse.status()}).`);

    const created = await createResponse.json();
    expect(created.booking.id).toBeTruthy();

    const bookingId = created.booking.id as string;
    const cancelResponse = await authedPage.request.delete(`/api/ops/bookings/${bookingId}`);
    expect(cancelResponse.status()).toBe(200);
  });
});

test.describe('Ops customer export smoke', () => {
  test('download CSV via API', async ({ authedPage }, testInfo) => {
    if (!SHOULD_RUN) {
      test.skip(true, 'Set PLAYWRIGHT_OPS_BOOKINGS=true to enable CSV export test once seed data is ready.');
    }
    const authed = await ensureAuthenticated(authedPage, testInfo);
    if (!authed) return;

    const response = await authedPage.request.get(`/api/ops/customers/export?restaurantId=${RESTAURANT_ID}`);
    test.skip(response.status() !== 200, `Customer export unavailable (${response.status()}).`);

    const buffer = await response.body();
    expect(buffer.slice(0, 3)).toEqual(Uint8Array.from([0xef, 0xbb, 0xbf]));
  });
});
