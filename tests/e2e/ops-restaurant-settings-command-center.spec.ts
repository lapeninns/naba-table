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
  businessDescription: 'Local QA fixture restaurant for settings command-center proof.',
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

const operatingHours = {
  updatedAt: '2026-05-16T00:00:00.000Z',
  weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    notes: null,
    reservationIntervalMinutes: 15,
    reservationSlotTimes: null,
  })),
  overrides: [],
};

const servicePeriods = Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
  {
    id: `lunch-${dayOfWeek}`,
    name: 'Lunch',
    dayOfWeek,
    startTime: '12:00',
    endTime: '15:00',
    bookingOption: 'lunch',
    updatedAt: null,
  },
  {
    id: `dinner-${dayOfWeek}`,
    name: 'Dinner',
    dayOfWeek,
    startTime: '17:00',
    endTime: '22:00',
    bookingOption: 'dinner',
    updatedAt: null,
  },
]);

const occasions = [
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch bookings',
    sortOrder: 1,
    defaultStartTime: '12:00',
    defaultEndTime: '15:00',
    isActive: true,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner bookings',
    sortOrder: 2,
    defaultStartTime: '17:00',
    defaultEndTime: '22:00',
    isActive: true,
  },
];

const emptyBusinessInfo = {
  details: null,
  addresses: [],
  phoneNumbers: [],
  links: [],
  categories: [],
  serviceAreas: [],
  hours: [],
  specialHours: [],
  attributes: [],
  serviceItems: [],
};

async function installCommandCenterApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/restaurants') {
      await route.fulfill({
        json: {
          items: [restaurant],
          pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
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
          businessInfo: emptyBusinessInfo,
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/state`) {
      await route.fulfill({ json: emptyDualSyncState });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/hours`) {
      await route.fulfill({ json: operatingHours });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/service-periods`) {
      await route.fulfill({ json: { periods: servicePeriods } });
      return;
    }

    if (pathname === '/api/ops/occasions') {
      await route.fulfill({ json: { occasions } });
      return;
    }

    if (pathname === '/api/ops/team/invitations') {
      await route.fulfill({
        json: {
          invites: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              restaurantId,
              email: 'pending.manager@example.test',
              role: 'manager',
              status: 'pending',
              expiresAt: '2026-06-16T12:00:00.000Z',
              invitedBy: '99999999-9999-4999-8999-999999999999',
              acceptedAt: null,
              revokedAt: null,
              createdAt: '2026-05-16T12:00:00.000Z',
              updatedAt: '2026-05-16T12:00:00.000Z',
            },
          ],
        },
      });
      return;
    }

    if (pathname === '/api/ops/tables') {
      await route.fulfill({
        json: {
          summary: {
            availableTables: 2,
            serviceCapacities: [],
            totalCapacity: 8,
            totalTables: 2,
            zones: [{ active: true, id: 'zone-main', name: 'Main Dining', sort_order: 0 }],
          },
          tables: [
            {
              id: 'table-1',
              restaurant_id: restaurantId,
              table_number: '1',
              capacity: 4,
              zone_id: 'zone-main',
              zone: { id: 'zone-main', name: 'Main Dining', active: true },
              active: true,
              status: 'available',
              position: null,
              notes: null,
            },
          ],
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/menus`) {
      await route.fulfill({ json: { menus: [] } });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops restaurant settings command-center primary routes', () => {
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
    await installCommandCenterApiMocks(page);
  });

  test('index route renders the setup overview @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant$/);
    await expect(page.getByRole('heading', { name: 'Restaurant setup' })).toBeVisible();
    await expect(page.locator('main').getByText('Required setup', { exact: true })).toBeVisible();
    await expect(page.locator('main').getByText('3/3 complete')).toBeVisible();
    await expect(
      page.locator('main').getByText('Team ready · Google Business Profile pending'),
    ).toBeVisible();
    await expect(page.locator('main').getByText('All required setup is complete')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open availability' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability#booking-rules',
    );
    await expect(page.getByRole('link', { name: 'Open tables' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/tables#table-capacity-summary',
    );

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-setup-overview-desktop.png'),
      fullPage: true,
    });
  });

  test('index route keeps the setup overview usable at tablet width @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/settings/restaurant', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page.getByRole('navigation', { name: 'Restaurant settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Restaurant profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Restaurant setup' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open availability' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open tables' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-setup-overview-tablet.png'),
      fullPage: true,
    });
  });

  test('discovery route shows GBP-aware disconnected status @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/discovery', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/discovery/);
    await expect(page.getByRole('heading', { name: 'Discovery details' })).toBeVisible();
    await expect(page.locator('main').getByText('Public discovery')).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: 'Connect Google Business Profile to import suggestions',
      }),
    ).toHaveAttribute('href', '/app/settings/restaurant/google-business-profile#gbp-connection');
    await expect(page.locator('main').getByText('Suggested 0')).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-discovery-gbp-disconnected.png'),
      fullPage: true,
    });
  });

  test('profile route offers a clean-state GBP link action @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/profile/);
    await expect(page.getByRole('heading', { name: 'Restaurant profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-profile-gbp-link-action.png'),
      fullPage: true,
    });
  });

  test('menu route renders the menu command center @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/menu/);
    await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible();
    await expect(page.locator('main').getByText('Menu catalogues')).toBeVisible();
    await expect(page.getByRole('button', { name: /Food Menu/ })).toBeVisible();
    await expect(page.locator('main').getByText('No menus yet')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-menu-command-center-desktop.png'),
      fullPage: true,
    });
  });

  test('availability route renders schedule workspace proof @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/availability#availability-schedule', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/availability/);
    await expect(page.getByRole('heading', { name: 'Availability & Booking types' })).toBeVisible();
    await expect(page.locator('main').getByText('Availability sections')).toBeVisible();
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.locator('main').getByText('Weekly schedule').first()).toBeVisible();
    await expect(
      page.locator('main').getByText('Weekly operating hours', { exact: true }),
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-availability-schedule-desktop.png'),
      fullPage: true,
    });
  });
});
