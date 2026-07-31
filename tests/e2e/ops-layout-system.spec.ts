import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * Browser proof for the layout-system slice:
 * - email delivery log: attempt-card list below lg, sortable table at >=lg,
 *   retry parity on mobile (layout-system §8)
 * - customers: StaleBoundary on the guest list (param-change dimming, §9)
 * - shell re-proof at tablet width (sidebar at md, bottom nav hidden)
 * - landing at 375/768/1440 without overflow
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

function emailEvent(params: {
  id: string;
  messageId: string;
  recipientEmail: string;
  status: string;
  occurredAt: string;
  error?: string | null;
}) {
  return {
    id: params.id,
    bookingId: null,
    restaurantId,
    emailType: 'booking_confirmation',
    templateType: 'booking_confirmation',
    recipientEmail: params.recipientEmail,
    messageId: params.messageId,
    status: params.status,
    provider: 'mock',
    occurredAt: params.occurredAt,
    error: params.error ?? null,
    metadata: { subject: 'Your booking confirmation' },
  };
}

function buildEmailAttempts() {
  return [
    {
      id: 'aaaa1111-1111-4111-8111-111111111111',
      messageId: 'msg-delivered-001',
      recipientEmail: 'delivered@example.test',
      bookingId: null,
      emailType: 'booking_confirmation',
      templateType: 'booking_confirmation',
      provider: 'mock',
      currentStatus: 'delivered',
      currentOccurredAt: '2026-06-12T18:05:00.000Z',
      events: [
        emailEvent({
          id: 'ev-1',
          messageId: 'msg-delivered-001',
          recipientEmail: 'delivered@example.test',
          status: 'sent',
          occurredAt: '2026-06-12T18:04:00.000Z',
        }),
        emailEvent({
          id: 'ev-2',
          messageId: 'msg-delivered-001',
          recipientEmail: 'delivered@example.test',
          status: 'delivered',
          occurredAt: '2026-06-12T18:05:00.000Z',
        }),
      ],
      booking: null,
    },
    {
      id: 'bbbb2222-2222-4222-8222-222222222222',
      messageId: 'msg-failed-002',
      recipientEmail: 'failed@example.test',
      bookingId: null,
      emailType: 'booking_reminder',
      templateType: 'booking_reminder',
      provider: 'mock',
      currentStatus: 'failed',
      currentOccurredAt: '2026-06-12T19:10:00.000Z',
      events: [
        emailEvent({
          id: 'ev-3',
          messageId: 'msg-failed-002',
          recipientEmail: 'failed@example.test',
          status: 'failed',
          occurredAt: '2026-06-12T19:10:00.000Z',
          error: 'Mailbox unavailable',
        }),
      ],
      booking: null,
    },
  ];
}

const emailSummary = {
  total: 2,
  sent: 0,
  delivered: 1,
  deliveryDelayed: 0,
  bounced: 0,
  complained: 0,
  failed: 1,
  deliveredRate: 0.5,
  failureRate: 0.5,
  uniqueRecipients: 2,
  uniqueBookings: 0,
  p50DeliverySeconds: 60,
  p95DeliverySeconds: 120,
  topFailedTemplates: [],
  topFailedEmailTypes: [],
  stuckInFlight: 0,
};

function buildCustomers() {
  return [
    {
      id: 'cccc3333-3333-4333-8333-333333333333',
      restaurantId,
      name: 'Avery Patel',
      email: 'avery@example.test',
      phone: '+447700900001',
      marketingOptIn: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      firstBookingAt: '2026-01-12T19:00:00.000Z',
      lastBookingAt: '2026-06-01T19:00:00.000Z',
      totalBookings: 6,
      totalCovers: 18,
      totalCancellations: 0,
    },
    {
      id: 'dddd4444-4444-4444-8444-444444444444',
      restaurantId,
      name: 'Rowan Clarke',
      email: 'rowan@example.test',
      phone: '+447700900002',
      marketingOptIn: false,
      createdAt: '2026-02-20T12:00:00.000Z',
      firstBookingAt: null,
      lastBookingAt: null,
      totalBookings: 0,
      totalCovers: 0,
      totalCancellations: 0,
    },
  ];
}

type MockOptions = {
  /** Delay customer list responses after the first call so stale UI is observable. */
  delayedCustomersAfterFirstCallMs?: number;
};

async function installOpsApiMocks(page: Page, options: MockOptions = {}) {
  let customersCalls = 0;

  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/email-delivery' && route.request().method() === 'GET') {
      if (url.searchParams.get('summaryOnly') === '1') {
        await route.fulfill({
          json: { ok: true, restaurantId, range: '7d', summary: emailSummary },
        });
        return;
      }
      await route.fulfill({
        json: {
          ok: true,
          restaurantId,
          range: '7d',
          pageInfo: { page: 1, pageSize: 25, hasNext: false },
          attempts: buildEmailAttempts(),
          summary: emailSummary,
        },
      });
      return;
    }

    if (pathname === '/api/ops/customers' && route.request().method() === 'GET') {
      customersCalls += 1;
      const delayMs =
        customersCalls > 1 && options.delayedCustomersAfterFirstCallMs
          ? options.delayedCustomersAfterFirstCallMs
          : 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const items = buildCustomers();
      await route.fulfill({
        json: {
          items,
          pageInfo: { page: 1, pageSize: 50, total: items.length, hasNext: false },
          summary: {
            total: items.length,
            optedIn: 1,
            optedOut: 1,
            returning: 1,
            vip: 0,
            neverVisited: 1,
          },
        },
      });
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

    if (pathname === '/api/ops/bookings' && route.request().method() === 'GET') {
      await route.fulfill({
        json: { items: [], pageInfo: { page: 1, pageSize: 50, total: 0, hasNext: false } },
      });
      return;
    }

    if (pathname === '/api/ops/dashboard/summary') {
      await route.fulfill({
        json: {
          meta: { date: '2026-06-12', timezone: 'Europe/London', restaurantId },
          date: '2026-06-12',
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

const ARTIFACT_DIR = 'test-results/browser-proof/layout-system';
const EMAIL_DELIVERY_URL = `/email-delivery?restaurantId=${restaurantId}&tab=delivery-log`;

test.describe('layout system — email delivery log responsive variants', () => {
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

  test('375px renders attempt cards with retry parity and no overflow', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(EMAIL_DELIVERY_URL);

    await expect(page.getByRole('table')).toHaveCount(0);

    // Retry stays available on mobile with the same accessible name as the table.
    const retry = page.getByRole('button', { name: 'Retry email for failed@example.test' });
    await expect(retry).toBeVisible();

    await expect(page.getByText('failed@example.test')).toBeVisible();
    await expect(page.getByText('delivered@example.test')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/email-delivery-375.png`, fullPage: false });
  });

  test('768px still renders cards — 7-column table does not fit beside the sidebar', async ({
    page,
  }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(EMAIL_DELIVERY_URL);

    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByText('failed@example.test')).toBeVisible();
    await expect(page.getByText('delivered@example.test')).toBeVisible();

    // Tablet shell: fixed sidebar visible, bottom action bar hidden at >=md.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/email-delivery-768.png`, fullPage: false });
  });

  test('1440px renders the sortable table and no cards', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(EMAIL_DELIVERY_URL);

    await expect(page.getByRole('table')).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'failed@example.test', exact: true }),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/email-delivery-1440.png`, fullPage: false });
  });
});

test.describe('layout system — customers stale boundary and widths', () => {
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

  test('375px guest card list dims via StaleBoundary on filter change', async ({ page }) => {
    await installOpsApiMocks(page, { delayedCustomersAfterFirstCallMs: 1500 });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/customers?restaurantId=${restaurantId}`);

    await expect(page.getByText('Avery Patel')).toBeVisible();

    const staleBoundary = page.locator('[data-slot="stale-boundary"]');
    await expect(staleBoundary).toBeVisible();
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'false');

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/customers-375.png`, fullPage: false });

    // Param change (debounced search) dims only the list body; the toolbar
    // search input stays interactive while the delayed refetch is in flight.
    const search = page.getByRole('searchbox', { name: 'Search guests' });
    await search.fill('Avery');
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'true', { timeout: 10_000 });
    await expect(search).toBeEnabled();
    await page.screenshot({ path: `${ARTIFACT_DIR}/customers-375-stale.png`, fullPage: false });
    await expect(staleBoundary).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
  });

  test('768px and 1440px keep the header primary action visible without overflow', async ({
    page,
  }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/customers?restaurantId=${restaurantId}`);

    await expect(page.getByText('Avery Patel')).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/customers-768.png`, fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/customers-1440.png`, fullPage: false });
  });
});

test.describe('layout system — shell and bookings re-proof', () => {
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

  test('dashboard at 768px shows sidebar shell, no bottom bar, no overflow', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/dashboard-768.png`, fullPage: false });
  });

  test('bookings at 1440px keeps header, toolbar, and list order', async ({ page }) => {
    await installOpsApiMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/bookings');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search guests' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/bookings-1440.png`, fullPage: false });
  });
});

test.describe('layout system — landing widths', () => {
  const rootHostBaseUrl = `http://localhost:${appPort}`;

  test('landing renders without overflow at 375/768/1440', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${rootHostBaseUrl}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/landing-375.png`, fullPage: false });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/landing-768.png`, fullPage: false });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${ARTIFACT_DIR}/landing-1440.png`, fullPage: false });
  });
});
