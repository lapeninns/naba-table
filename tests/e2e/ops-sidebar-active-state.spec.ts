import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * Browser proof that the ops sidebar highlights the active navigation item on
 * the app host, where the proxy strips the /app prefix from the browser URL
 * (the user sees /bookings while nav hrefs are internal /app/bookings paths).
 *
 * Runs against the QA fixture runtime (playwright.app.config.ts) with
 * page-level ops API mocks, mirroring ops-mobile-redesign.spec.ts.
 */

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
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === '/api/ops/bookings' && route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          items: [],
          pageInfo: { page: 1, pageSize: 50, total: 0, hasNext: false },
        },
      });
      return;
    }

    if (pathname === '/api/ops/dashboard/summary') {
      await route.fulfill({
        json: {
          meta: { date: '2026-05-16', timezone: 'Europe/London', restaurantId },
          date: '2026-05-16',
          timezone: 'Europe/London',
          restaurantId,
          totals: {
            total: 0,
            confirmed: 0,
            completed: 0,
            pending: 0,
            cancelled: 0,
            noShow: 0,
            upcoming: 0,
            covers: 0,
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

    await route.fulfill({ json: {} });
  });
}

const ARTIFACT_DIR = 'tasks/ops-sidebar-active-state-apphost-20260612-2140/artifacts';

test.describe('ops sidebar active state on the app host', () => {
  test.use({ baseURL: appHostBaseUrl });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: qaAuthCookieName,
        value: qaAuthCookieValue,
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
      // Render the sidebar expanded so the active row is visible in artifacts.
      {
        name: 'sidebar_state',
        value: 'true',
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('bookings route highlights the Bookings sidebar item', async ({ page }) => {
    await page.goto('/bookings');

    const sidebar = page.locator('[data-sidebar="content"]');
    const bookingsLink = sidebar.getByRole('link', { name: 'Bookings', exact: true });
    await expect(bookingsLink).toBeVisible();
    await expect(bookingsLink).toHaveAttribute('aria-current', 'page');

    // The shadcn menu button carries the active styling hook.
    const activeButtons = sidebar.locator('[data-sidebar="menu-button"][data-active="true"]');
    await expect(activeButtons).toHaveCount(1);
    await expect(activeButtons).toContainText('Bookings');

    const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
    await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');

    await page.screenshot({ path: `${ARTIFACT_DIR}/ops-sidebar-bookings-active-1280.png` });
  });

  test('dashboard route highlights the Dashboard sidebar item', async ({ page }) => {
    await page.goto('/dashboard');

    const sidebar = page.locator('[data-sidebar="content"]');
    const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    const activeButtons = sidebar.locator('[data-sidebar="menu-button"][data-active="true"]');
    await expect(activeButtons).toHaveCount(1);
    await expect(activeButtons).toContainText('Dashboard');
  });
});
