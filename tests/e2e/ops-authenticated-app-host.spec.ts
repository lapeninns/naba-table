import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';

const restaurant = {
  id: restaurantId,
  name: 'QA App Host Restaurant',
  slug: 'qa-app-host',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.ops@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  businessDescription: 'Local QA fixture restaurant for browser proof.',
  managerDailySummaryEnabled: true,
  managerNotificationPhone: '+440000000001',
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: 'QA browser fixtures only.',
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

async function installOpsApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/dashboard/summary') {
      await route.fulfill({
        json: {
          meta: {
            date: '2026-05-16',
            timezone: 'Europe/London',
            restaurantId,
          },
          date: '2026-05-16',
          timezone: 'Europe/London',
          restaurantId,
          totals: {
            total: 1,
            confirmed: 1,
            completed: 0,
            pending: 0,
            cancelled: 0,
            noShow: 0,
            upcoming: 1,
            covers: 4,
          },
          bookings: [],
        },
      });
      return;
    }

    if (pathname === '/api/ops/dashboard/heatmap') {
      await route.fulfill({ json: {} });
      return;
    }

    if (pathname === '/api/ops/restaurants') {
      await route.fulfill({
        json: {
          items: [restaurant],
          pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}`) {
      await route.fulfill({ json: { restaurant } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/business-context`) {
      const emptyContext = {
        businessDetails: null,
        links: [],
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      };
      await route.fulfill({
        json: { core: emptyContext, providerSnapshot: emptyContext },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile`) {
      await route.fulfill({
        json: {
          isConfigured: false,
          provider: 'google_business_profile',
          status: 'unlinked',
          pushEnabled: false,
          connectedGoogleEmail: null,
          connectedGoogleName: null,
          externalAccountId: null,
          externalAccountName: null,
          externalLocationId: null,
          externalLocationName: null,
          externalLocationTitle: null,
          externalPlaceId: null,
          providerTimezone: null,
          lastPullAt: null,
          lastPushAt: null,
          lastError: null,
          availableLocations: [],
          businessInfo: {
            details: null,
            addresses: [],
            regularHours: [],
            specialHours: [],
            serviceItems: [],
            categories: [],
            attributes: [],
          },
        },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('authenticated ops app-host shipped routes', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: qaAuthCookieName,
        value: qaAuthCookieValue,
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await installOpsApiMocks(page);
  });

  test('dashboard renders an authenticated shipped route screenshot @p0 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(
      page.locator('main').getByText('Active reservations for QA App Host Restaurant'),
    ).toBeVisible();
    await expect(page.getByText('1 booking')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-dashboard-authenticated-desktop.png'),
      fullPage: true,
    });
  });

  test('restaurant profile settings renders an authenticated shipped route screenshot @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/profile/);
    await expect(page.getByRole('heading', { name: 'Restaurant profile' })).toBeVisible();
    await expect(page.locator('main').getByText('QA App Host Restaurant').first()).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-profile-authenticated-desktop.png'),
      fullPage: true,
    });
  });
});
