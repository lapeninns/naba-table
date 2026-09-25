import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const mainZoneId = '22222222-2222-4222-8222-222222222222';
const patioZoneId = '33333333-3333-4333-8333-333333333333';

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

const zones = [
  {
    id: mainZoneId,
    restaurant_id: restaurantId,
    name: 'Main Dining',
    sort_order: 0,
    active: true,
    created_at: '2026-05-16T00:00:00.000Z',
    updated_at: '2026-05-16T00:00:00.000Z',
  },
  {
    id: patioZoneId,
    restaurant_id: restaurantId,
    name: 'Patio',
    sort_order: 1,
    active: true,
    created_at: '2026-05-16T00:00:00.000Z',
    updated_at: '2026-05-16T00:00:00.000Z',
  },
];

const tables = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    restaurant_id: restaurantId,
    table_number: '1',
    capacity: 4,
    min_party_size: 1,
    max_party_size: null,
    section: null,
    category: 'dining',
    seating_type: 'standard',
    mobility: 'movable',
    zone_id: mainZoneId,
    zone: { id: mainZoneId, name: 'Main Dining', active: true },
    active: true,
    status: 'available',
    position: { x: 10, y: 20, rotation: 0 },
    notes: null,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    restaurant_id: restaurantId,
    table_number: '2',
    capacity: 4,
    min_party_size: 1,
    max_party_size: null,
    section: null,
    category: 'dining',
    seating_type: 'standard',
    mobility: 'movable',
    zone_id: patioZoneId,
    zone: { id: patioZoneId, name: 'Patio', active: true },
    active: true,
    status: 'available',
    position: { x: 80, y: 20, rotation: 0 },
    notes: null,
  },
];

async function installCapacityApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/dashboard/summary') {
      await route.fulfill({
        json: {
          meta: {
            date: '2026-05-16',
            restaurantId,
            timezone: 'Europe/London',
          },
          bookings: [],
          covers: 0,
          date: '2026-05-16',
          restaurantId,
          timezone: 'Europe/London',
          totals: {
            cancelled: 0,
            completed: 0,
            confirmed: 0,
            covers: 0,
            noShow: 0,
            pending: 0,
            total: 0,
            upcoming: 0,
          },
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
          pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}`) {
      await route.fulfill({ json: { restaurant } });
      return;
    }

    if (pathname === '/api/ops/tables') {
      await route.fulfill({
        json: {
          summary: {
            availableTables: 2,
            serviceCapacities: [
              {
                assumptions: {
                  bufferMinutes: 15,
                  intervalMinutes: 15,
                  turnMinutes: 90,
                  windowMinutes: 240,
                },
                capacity: 16,
                key: 'dinner',
                label: 'Dinner',
                seatsPerTurn: 8,
                tablesConsidered: 2,
                turnsPerTable: 2,
              },
            ],
            totalCapacity: 8,
            totalTables: 2,
            zones: [
              { active: true, id: mainZoneId, name: 'Main Dining', sort_order: 0 },
              { active: true, id: patioZoneId, name: 'Patio', sort_order: 1 },
            ],
          },
          tables,
        },
      });
      return;
    }

    if (pathname === '/api/ops/zones') {
      await route.fulfill({ json: { zones } });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops capacity and table shipped routes', () => {
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
    await installCapacityApiMocks(page);
  });

  test('tables settings route renders capacity and inventory proof @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/tables', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/tables/);
    await expect(page.getByRole('heading', { level: 1, name: 'Tables' })).toBeVisible();
    const summary = page.locator('main').getByTestId('table-inventory-metrics');
    await expect(summary.getByText('Bookable now')).toBeVisible();
    await expect(summary.getByText('2 tables', { exact: true })).toBeVisible();
    await expect(summary.getByText('8 seats')).toBeVisible();
    await expect(summary.getByText('Dinner: 16 covers')).toBeVisible();
    await expect(summary.getByRole('link', { name: 'Change meal times' })).toBeVisible();
    await expect(page.locator('main').getByRole('region', { name: 'Zones' })).toBeVisible();
    await expect(page.locator('main').getByRole('region', { name: 'Tables' })).toBeVisible();
    await expect(page.locator('main').getByText('Tables workflow')).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('ops-capacity-tables-settings-desktop.png'),
      fullPage: true,
    });
  });

  test('tables settings route exposes shared category enum options @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/tables', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await page.locator('main').getByRole('button', { name: 'Add table' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Add table' })).toBeVisible();

    await page.getByRole('button', { name: /^Details and service notes/ }).click();
    await page.getByRole('combobox', { name: 'Category' }).click();
    await expect(page.getByRole('option', { name: 'Dining' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Patio' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Private' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-tables-category-options.png'),
      fullPage: true,
    });
  });

  test('tables settings route uses compact mobile settings nav and table cards @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings/restaurant/tables', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(
      page.getByRole('button', { name: 'Toggle restaurant settings navigation' }),
    ).toBeVisible();
    const card = page.locator('main').getByTestId(`table-card-${tables[0].id}`);
    await expect(card.getByText('Table 1', { exact: true })).toBeVisible();
    await expect(card.getByText('4 seats · parties of 1–4')).toBeVisible();
    await expect(card.getByText('Bookable')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Edit table 1' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Delete table 1' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-capacity-tables-settings-mobile.png'),
      fullPage: true,
    });
  });

  test('legacy seating routes redirect to the authenticated dashboard @p1 @browser @smoke @local-only', async ({
    page,
  }) => {
    for (const legacyRoute of ['/seating', '/seating/floor-plan']) {
      await page.goto(legacyRoute, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

      await expect(page).toHaveURL(/app\.localhost:\d+\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    }
  });
});
