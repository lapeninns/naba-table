import { expect, test } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;

const protectedRoutes = [
  { name: 'dashboard', path: '/dashboard', redirectedFrom: '/dashboard' },
  {
    name: 'bookings',
    path: '/bookings?date=2026-05-16',
    redirectedFrom: '/bookings?date=2026-05-16',
  },
  { name: 'root', path: '/', redirectedFrom: '/dashboard' },
  { name: 'app-prefixed dashboard', path: '/app/dashboard', redirectedFrom: '/dashboard' },
];

test.describe('ops app-host redirects', () => {
  test.use({ baseURL: appHostBaseUrl });

  for (const { name, path, redirectedFrom } of protectedRoutes) {
    test(`${name} redirects unauthenticated users to ops sign-in @p0 @browser @security @local-only`, async ({
      page,
    }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await page.waitForURL(/\/auth\/signin/, {
        timeout: 20_000,
        waitUntil: 'domcontentloaded',
      });
      const url = new URL(page.url());

      expect(url.hostname).toBe('app.localhost');
      expect(url.pathname).toBe('/auth/signin');
      expect(url.searchParams.get('redirectedFrom')).toBe(redirectedFrom);
      await expect(
        page.getByRole('heading', { name: 'Streamline your restaurant operations' }),
      ).toBeVisible();
    });
  }
});
