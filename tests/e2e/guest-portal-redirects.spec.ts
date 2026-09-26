import { expect, test } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appBaseUrl = `http://localhost:${appPort}`;
const bookingId = '22222222-2222-4222-8222-222222222222';

const redirectCases = [
  { name: 'guest root', path: '/guest', redirectedFrom: '/guest/dashboard' },
  { name: 'guest dashboard', path: '/guest/dashboard', redirectedFrom: '/guest/dashboard' },
  { name: 'guest bookings', path: '/guest/bookings', redirectedFrom: '/guest/bookings' },
  { name: 'guest profile', path: '/guest/profile', redirectedFrom: '/guest/profile' },
];

// Booking detail and receipt pages no longer bounce signed-out guests to sign-in. Access is
// booking-scoped (an emailed link or the creator cookie), so they render the access state:
// get a new link by email, or sign in and come back to this booking.
const bookingAccessCases = [
  {
    name: 'guest booking detail',
    path: `/guest/bookings/${bookingId}`,
    landsOn: `/bookings/${bookingId}`,
  },
  {
    name: 'guest booking receipt',
    path: `/guest/bookings/${bookingId}/receipt`,
    landsOn: `/guest/bookings/${bookingId}/receipt`,
  },
];

test.describe('guest portal redirects', () => {
  test.use({ baseURL: appBaseUrl });

  for (const { name, path, redirectedFrom } of redirectCases) {
    test(`${name} redirects to sign-in`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/auth\/signin/, {
        timeout: 20_000,
      });
      const url = new URL(page.url());
      expect(url.searchParams.get('redirectedFrom')).toBe(redirectedFrom);
    });
  }

  for (const { name, path, landsOn } of bookingAccessCases) {
    test(`${name} shows booking access options without a link or session`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { name: 'Open your booking' })).toBeVisible({
        timeout: 20_000,
      });
      expect(new URL(page.url()).pathname).toBe(landsOn);
      await expect(main.getByRole('link', { name: 'Email me a new link' })).toHaveAttribute(
        'href',
        '/bookings/find',
      );

      const signInHref = await main.getByRole('link', { name: 'Sign in' }).getAttribute('href');
      const signInUrl = new URL(signInHref ?? '', page.url());
      expect(signInUrl.pathname).toBe('/auth/signin');
      expect(signInUrl.searchParams.get('redirectedFrom')).toBe(landsOn);
    });
  }
});
