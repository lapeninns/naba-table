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
  managerWhatsappEnabled: false,
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

const emptyDualSyncState = {
  restaurantId,
  coreSnapshot: {},
  gbpSnapshot: {},
  coreSnapshotHash: 'qa-core-hash',
  gbpSnapshotHash: 'qa-gbp-hash',
  fields: [],
  outboundQueue: {
    totalOpen: 0,
    autoExportable: 0,
    missingBaseline: 0,
    lastQueuedAt: null,
  },
  lastSnapshot: null,
  control: null,
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

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/state`) {
      await route.fulfill({ json: emptyDualSyncState });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

async function expectProfileStatusBar(page: Page) {
  // Readiness is a sticky column from xl and a compact summary card below it.
  await expect(
    page.locator('main').getByText('Everything guests need is filled in').filter({ visible: true }),
  ).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/google-business-profile#gbp-connection',
  );
  await expect(page.getByRole('button', { name: /Compare with Google/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Public details' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Name and booking link' })).toHaveAttribute(
    'href',
    '#profile-identity',
  );
  // Manager alerts moved to Staff communications.
  await expect(page.getByRole('switch', { name: 'Try WhatsApp first' })).toHaveCount(0);
}

async function expectStaffCommunications(page: Page) {
  await page.locator('main').getByRole('link', { name: 'Staff communications' }).click();
  await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/staff-communications/);
  await expect(page.getByRole('heading', { level: 2, name: 'Manager alerts' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Try WhatsApp first' })).toBeVisible();
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
    await expect(
      page.locator('main').getByRole('textbox', { name: /^Restaurant name/ }),
    ).toHaveValue('QA App Host Restaurant');
    await expectProfileStatusBar(page);
    await page.screenshot({
      path: testInfo.outputPath('ops-settings-profile-authenticated-desktop.png'),
      fullPage: true,
    });
    await expectStaffCommunications(page);
  });

  test('restaurant profile status bar wraps on tablet @p1 @browser @local-only', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/settings/restaurant/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/profile/);
    await expectProfileStatusBar(page);
    await page.screenshot({
      path: testInfo.outputPath('ops-settings-profile-authenticated-tablet.png'),
      fullPage: true,
    });
    await expectStaffCommunications(page);
  });

  test('restaurant discovery details renders authenticated shipped route proof @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/discovery', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/discovery/);
    await expect(page.locator('main').getByText('Discovery details').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Categories' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-discovery-authenticated-desktop.png'),
      fullPage: true,
    });
  });
});
