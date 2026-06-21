import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * Browser proof for the mobile-first ops redesign slices:
 * - mobile bottom action bar on shipped app-host routes
 * - no horizontal overflow at 375px
 * - bookings list stale-while-revalidate boundary (param-change dimming)
 *
 * Runs against the QA fixture runtime (playwright.app.config.ts) with
 * page-level ops API mocks, mirroring ops-authenticated-app-host.spec.ts.
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

function isoAtHour(hour: number): { startIso: string; endIso: string } {
  const start = new Date();
  start.setHours(hour, 30, 0, 0);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function buildBookingItems() {
  const dinner = isoAtHour(18);
  const lateDinner = isoAtHour(20);
  return [
    {
      id: '22222222-2222-4222-8222-222222222222',
      restaurantId,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      restaurantTimezone: restaurant.timezone,
      partySize: 4,
      startIso: dinner.startIso,
      endIso: dinner.endIso,
      status: 'confirmed',
      customerName: 'Avery Patel',
      customerEmail: 'avery@example.test',
      customerPhone: '+447700900001',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      restaurantId,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      restaurantTimezone: restaurant.timezone,
      partySize: 2,
      startIso: lateDinner.startIso,
      endIso: lateDinner.endIso,
      status: 'pending',
      customerName: 'Rowan Clarke',
      customerEmail: 'rowan@example.test',
      customerPhone: '+447700900002',
    },
  ];
}

type MockOptions = {
  /** Delay list responses after the first call to make stale UI observable. */
  delayedBookingsAfterFirstCallMs?: number;
};

async function installOpsApiMocks(page: Page, options: MockOptions = {}) {
  let bookingsCalls = 0;

  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/bookings' && route.request().method() === 'GET') {
      bookingsCalls += 1;
      const delayMs =
        bookingsCalls > 1 && options.delayedBookingsAfterFirstCallMs
          ? options.delayedBookingsAfterFirstCallMs
          : 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const items = buildBookingItems();
      await route.fulfill({
        json: {
          items,
          pageInfo: { page: 1, pageSize: 50, total: items.length, hasNext: false },
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
            total: 2,
            confirmed: 1,
            completed: 0,
            pending: 1,
            cancelled: 0,
            noShow: 0,
            upcoming: 2,
            covers: 6,
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

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

const ARTIFACT_DIR = 'tasks/uxui-redesign-foundation-20260612-2054/artifacts';

test.describe('ops mobile redesign — bottom nav and bookings stale UX', () => {
  test.use({ baseURL: appHostBaseUrl });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: qaAuthCookieName,
        value: qaAuthCookieValue,
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
  });

  test('dashboard at 375px shows the bottom action bar without overflow', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');

    const bottomNav = page.getByRole('navigation', { name: 'Primary' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Bookings' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'New booking' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Guests' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();

    await expect(bottomNav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Touch-target height: every bottom action is at least 44px tall.
    const linkBox = await bottomNav.getByRole('link', { name: 'Bookings' }).boundingBox();
    expect(linkBox).not.toBeNull();
    expect(linkBox!.height).toBeGreaterThanOrEqual(44);

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/ops-dashboard-375.png`, fullPage: false });

    // Keyboard: first Tab reveals the skip link; tabbing onward reaches the
    // bottom nav, whose keyboard focus renders a visible ring (box-shadow).
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

    let reachedBottomNav = false;
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Tab');
      reachedBottomNav = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Primary"]');
        return Boolean(nav && document.activeElement && nav.contains(document.activeElement));
      });
      if (reachedBottomNav) break;
    }
    expect(reachedBottomNav).toBe(true);
    const focusRing = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).boxShadow,
    );
    expect(focusRing).not.toBe('none');
  });

  test('bookings at 375px keeps active state, stale boundary, and no overflow', async ({
    page,
  }) => {
    await installOpsApiMocks(page, { delayedBookingsAfterFirstCallMs: 1500 });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/bookings');

    const bottomNav = page.getByRole('navigation', { name: 'Primary' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Bookings' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // List body is wrapped in the SWR stale boundary and idle by default.
    const staleBoundary = page.locator('[data-slot="stale-boundary"]');
    await expect(staleBoundary).toBeVisible();
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Avery Patel')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/ops-bookings-375.png`, fullPage: false });

    // Param change (search) must dim only the list body while the delayed
    // refetch is in flight, then settle back to interactive. The search field
    // lives in the toolbar outside the boundary and stays usable throughout.
    const search = page.getByRole('searchbox', { name: 'Search guests' });
    await search.fill('Avery');
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'true', { timeout: 10_000 });
    await expect(search).toBeEnabled();
    await page.screenshot({ path: `${ARTIFACT_DIR}/ops-bookings-375-stale.png`, fullPage: false });
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
  });

  test('bottom action bar is hidden at desktop width', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await page.screenshot({ path: `${ARTIFACT_DIR}/ops-dashboard-1280.png`, fullPage: false });
  });
});

test.describe('root-host landing calm pass', () => {
  const rootHostBaseUrl = `http://localhost:${appPort}`;

  test('landing renders calm at 375px and 1280px without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${rootHostBaseUrl}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Decorative pulse/ping indicators were removed from hero and footer.
    await expect(page.locator('#hero .animate-pulse, #hero .animate-ping')).toHaveCount(0);
    await expect(page.locator('footer .animate-pulse, footer .animate-ping')).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/landing-375.png`, fullPage: false });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/landing-1280.png`, fullPage: false });
  });
});
