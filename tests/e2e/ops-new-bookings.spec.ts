import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const restaurantSlug = 'qa-app-host';
const wizardTime = '12:30';
const wizardTimeLabel = '12:30 PM';

const restaurant = {
  id: restaurantId,
  name: 'QA App Host Restaurant',
  slug: restaurantSlug,
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.ops@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

const formatDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const wizardFallbackDate = formatDateKey(addDays(new Date(), 1));

async function installOpsApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

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

async function installPublicAvailabilityMocks(page: Page) {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? wizardFallbackDate;
      const to = url.searchParams.get('to') ?? wizardFallbackDate;
      await route.fulfill({
        json: {
          timezone: 'Europe/London',
          from,
          to,
          closedDaysOfWeek: [],
          closedDates: [],
        },
      });
      return;
    }

    if (url.pathname.endsWith('/schedule')) {
      const date = url.searchParams.get('date') ?? wizardFallbackDate;
      await route.fulfill({
        json: {
          restaurantId,
          date,
          timezone: 'Europe/London',
          intervalMinutes: 15,
          defaultDurationMinutes: 90,
          lastSeatingBufferMinutes: 0,
          window: { opensAt: '12:00', closesAt: '22:00' },
          isClosed: false,
          availableBookingOptions: ['lunch'],
          slots: [
            {
              value: wizardTime,
              display: wizardTimeLabel,
              periodId: null,
              periodName: 'Lunch',
              bookingOption: 'lunch',
              defaultBookingOption: 'lunch',
              availability: {
                services: {},
                labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
              },
              disabled: false,
            },
          ],
          occasionCatalog: [],
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        restaurant: {
          id: restaurantId,
          slug: restaurantSlug,
          name: 'QA App Host Restaurant',
          address: '1 QA Street, Test Town',
          phone: '+440000000000',
          email: 'qa.ops@example.test',
          policy: 'QA browser fixtures only.',
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      },
    });
  });
}

test.describe('ops new-bookings unauthenticated contract', () => {
  test.use({ baseURL: appHostBaseUrl });

  test('new-bookings redirects unauthenticated users to ops sign-in without leaking booking tools @p0 @browser @security @local-only', async ({
    page,
  }) => {
    await page.goto('/new-bookings', { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/\/auth\/signin/, {
      timeout: 20_000,
      waitUntil: 'domcontentloaded',
    });
    const url = new URL(page.url());

    expect(url.hostname).toBe('app.localhost');
    expect(url.pathname).toBe('/auth/signin');
    expect(url.searchParams.get('redirectedFrom')).toBe('/new-bookings');
    await expect(
      page.getByRole('heading', { name: 'Streamline your restaurant operations' }),
    ).toBeVisible();

    // The auth wall must not leak the ops booking surface to unauthenticated visitors.
    await expect(page.getByRole('heading', { name: 'New booking', exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Create a walk-in or reservation with full ops controls.'),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to bookings' })).toHaveCount(0);
  });

  test('new-bookings responds 307 with a redirect-only body for unauthenticated requests @p0 @browser @security @local-only', async ({
    page,
  }) => {
    const response = await page.request.get('/new-bookings', { maxRedirects: 0 });

    expect(response.status()).toBe(307);

    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    const locationUrl = new URL(location, appHostBaseUrl);
    expect(locationUrl.pathname).toBe('/auth/signin');
    expect(locationUrl.searchParams.get('redirectedFrom')).toBe('/new-bookings');

    // Next dev echoes the redirect target as the 307 body; nothing else (no ops
    // content) may ride along on the redirect response.
    const body = (await response.text()).trim();
    expect(body).toBe(`${locationUrl.pathname}${locationUrl.search}`);
  });
});

test.describe('ops new-bookings authenticated view', () => {
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
    await installPublicAvailabilityMocks(page);
  });

  test('new-bookings renders the page header and booking wizard for authenticated ops users @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/new-bookings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/new-bookings/);
    await expect(page.getByRole('heading', { name: 'New booking' })).toBeVisible();
    await expect(
      page.getByText('Create a walk-in or reservation with full ops controls.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to bookings' })).toBeVisible();

    // The shared reservation wizard mounts in ops mode with its plan step controls.
    await expect(page.getByRole('region', { name: 'Plan your table' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Party size' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Time' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-new-bookings-authenticated-desktop.png'),
      fullPage: true,
    });
  });
});
