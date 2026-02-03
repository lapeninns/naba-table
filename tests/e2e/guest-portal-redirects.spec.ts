import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';
const bookingId = '22222222-2222-4222-8222-222222222222';

const redirectCases = [
  { name: 'guest root', path: '/guest', redirectedFrom: '/guest/dashboard' },
  { name: 'guest dashboard', path: '/guest/dashboard', redirectedFrom: '/guest/dashboard' },
  { name: 'guest thank-you', path: '/guest/thank-you', redirectedFrom: '/guest/dashboard' },
  { name: 'guest bookings', path: '/guest/bookings', redirectedFrom: '/guest/bookings' },
  {
    name: 'guest booking detail',
    path: `/guest/bookings/${bookingId}`,
    redirectedFrom: `/bookings/${bookingId}`,
  },
  {
    name: 'guest booking receipt',
    path: `/guest/bookings/${bookingId}/receipt`,
    redirectedFrom: `/guest/bookings/${bookingId}/receipt`,
  },
  { name: 'guest profile', path: '/guest/profile', redirectedFrom: '/guest/profile' },
];

test.describe('guest portal redirects', () => {
  test.use({ baseURL: appBaseUrl });

  for (const { name, path, redirectedFrom } of redirectCases) {
    test(`${name} redirects to sign-in`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/auth\/signin/);
      const url = new URL(page.url());
      expect(url.searchParams.get('redirectedFrom')).toBe(redirectedFrom);
    });
  }
});
