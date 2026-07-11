import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const printDate = '2026-05-16';

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
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

const printBooking = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'confirmed',
  bookingType: 'dinner',
  startTime: '18:30',
  endTime: '20:30',
  partySize: 4,
  customerName: 'Priya Sharma',
  customerEmail: 'priya@example.test',
  customerPhone: '+441234567890',
  notes: 'Window seat please',
  reference: 'QA-PRINT-1',
  details: null,
  source: 'api',
  tableAssignments: [
    {
      groupId: null,
      capacitySum: 4,
      members: [
        {
          tableId: '44444444-4444-4444-8444-444444444444',
          tableNumber: '12',
          capacity: 4,
          section: 'Main',
        },
      ],
    },
  ],
  requiresTableAssignment: false,
  checkedInAt: null,
  checkedOutAt: null,
};

function buildPrintSummary(date: string) {
  return {
    meta: { date, timezone: 'Europe/London', restaurantId },
    date,
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
    bookings: [printBooking],
  };
}

async function installOpsApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/dashboard/summary') {
      const date = url.searchParams.get('date') ?? printDate;
      await route.fulfill({ json: buildPrintSummary(date) });
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

async function stubWindowPrint(page: Page) {
  await page.addInitScript(() => {
    const printWindow = window as Window & { __qaPrintCalls?: number };
    printWindow.__qaPrintCalls = 0;
    printWindow.print = () => {
      printWindow.__qaPrintCalls = (printWindow.__qaPrintCalls ?? 0) + 1;
    };
  });
}

test.describe('ops dashboard print unauthenticated contract', () => {
  test.use({ baseURL: appHostBaseUrl });

  test('print route redirects unauthenticated users to ops sign-in without leaking print content @p0 @browser @security @local-only', async ({
    page,
  }) => {
    await page.goto(`/dashboard/print?date=${printDate}&sortKey=party&sortDir=desc`, {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForURL(/\/auth\/signin/, {
      timeout: 20_000,
      waitUntil: 'domcontentloaded',
    });
    const url = new URL(page.url());

    expect(url.hostname).toBe('app.localhost');
    expect(url.pathname).toBe('/auth/signin');
    expect(url.searchParams.get('redirectedFrom')).toBe(
      `/dashboard/print?date=${printDate}&sortKey=party&sortDir=desc`,
    );
    await expect(
      page.getByRole('heading', { name: 'Streamline your restaurant operations' }),
    ).toBeVisible();

    // The auth wall must not leak any print-view content to unauthenticated visitors.
    await expect(page.locator('#ops-print-root')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Bookings print list' })).toHaveCount(0);
  });

  test('print route responds 307 with a redirect-only body for unauthenticated requests @p0 @browser @security @local-only', async ({
    page,
  }) => {
    const response = await page.request.get('/dashboard/print', { maxRedirects: 0 });

    expect(response.status()).toBe(307);

    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    const locationUrl = new URL(location, appHostBaseUrl);
    expect(locationUrl.pathname).toBe('/auth/signin');
    expect(locationUrl.searchParams.get('redirectedFrom')).toBe('/dashboard/print');

    // Next dev echoes the redirect target as the 307 body; nothing else (no ops
    // booking data) may ride along on the redirect response.
    const body = (await response.text()).trim();
    expect(body).toBe(`${locationUrl.pathname}${locationUrl.search}`);
  });
});

test.describe('ops dashboard print authenticated view', () => {
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
    await stubWindowPrint(page);
    await installOpsApiMocks(page);
  });

  test('print view renders its print-shell landmark and bookings table for authenticated ops users @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto(`/dashboard/print?date=${printDate}&sortKey=party&sortDir=desc`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/dashboard\/print/);

    const printRoot = page.locator('#ops-print-root');
    await expect(printRoot).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bookings print list' })).toBeVisible();
    await expect(printRoot.getByText(/QA App Host Restaurant/)).toBeVisible();

    await expect(printRoot.getByText('Filter: All', { exact: true })).toBeVisible();
    await expect(printRoot.getByText('Sort: Party size (Descending)')).toBeVisible();

    await expect(printRoot.getByRole('cell', { name: 'Priya Sharma' })).toBeVisible();
    await expect(printRoot.getByRole('cell', { name: '12', exact: true })).toBeVisible();
    await expect(printRoot.getByText('Window seat please')).toBeVisible();

    await expect(page).toHaveTitle(/^Print Bookings - /);

    // The page's defining behavior: it auto-triggers window.print once the summary is ready.
    await page.waitForFunction(
      () => ((window as Window & { __qaPrintCalls?: number }).__qaPrintCalls ?? 0) >= 1,
      undefined,
      { timeout: 15_000 },
    );

    await page.screenshot({
      path: testInfo.outputPath('ops-dashboard-print-authenticated-desktop.png'),
      fullPage: true,
    });
  });
});
