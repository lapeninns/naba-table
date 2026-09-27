import { expect, test } from '@playwright/test';

import type { Page, Route } from '@playwright/test';

/**
 * Browser proof for the Communications Delivery redesign: the four screens share one header,
 * section nav, metric pattern and filter bar, never scroll the page sideways, and hold up in
 * light and dark at every size class, in loaded, empty and loading states.
 *
 * Screenshots are attached to the test output for independent visual review.
 */

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
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
  businessDescription: 'Local QA fixture restaurant for communications browser proof.',
  role: 'owner',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

type DataState = 'data' | 'empty' | 'loading' | 'error';

const SCREENS = [
  { key: 'overview', path: '/communications-delivery', heading: 'Communications Delivery' },
  { key: 'email', path: '/communications-delivery/email', heading: 'Email Delivery' },
  { key: 'messages', path: '/communications-delivery/messages', heading: 'Message Delivery' },
  { key: 'reviews', path: '/communications-delivery/reviews', heading: 'Review Growth' },
] as const;

const NAV_LABEL: Record<(typeof SCREENS)[number]['key'], RegExp> = {
  overview: /^Overview/,
  email: /^Email/,
  messages: /^Messages/,
  reviews: /^Reviews/,
};

const SIZES = [
  { name: 'base-320', width: 320 },
  { name: 'base-390', width: 390 },
  { name: 'sm-640', width: 640 },
  { name: 'md-768', width: 768 },
  { name: 'lg-1024', width: 1024 },
  { name: 'xl-1280', width: 1280 },
  { name: '2xl-1536', width: 1536 },
] as const;

function emailSummary(empty: boolean) {
  const n = (value: number) => (empty ? 0 : value);
  return {
    total: n(128),
    sent: n(4),
    delivered: n(112),
    deliveryDelayed: n(3),
    bounced: n(5),
    complained: n(1),
    failed: n(3),
    deliveredRate: empty ? 0 : 112 / 128,
    failureRate: empty ? 0 : 9 / 128,
    uniqueRecipients: n(97),
    uniqueBookings: n(88),
    p50DeliverySeconds: empty ? null : 4,
    p95DeliverySeconds: empty ? null : 38,
    topFailedTemplates: empty ? [] : [{ templateType: 'booking_confirmation', count: 5 }],
    topFailedEmailTypes: empty ? [] : [{ emailType: 'created', count: 4 }],
    stuckInFlight: n(2),
  };
}

function emailAttempts(empty: boolean) {
  if (empty) return [];
  return [
    {
      id: '22222222-2222-4222-8222-222222222222',
      messageId: 'provider-message-id-delivered',
      recipientEmail: 'guest.one@example.test',
      bookingId: 'booking-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'resend',
      currentStatus: 'delivered',
      currentOccurredAt: '2026-09-26T18:04:00Z',
      events: [],
      booking: null,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      messageId: 'provider-message-id-failed',
      recipientEmail: 'guest.two.with.a.long.address@example.test',
      bookingId: 'booking-2',
      emailType: 'reminder_24h',
      templateType: 'booking_reminder',
      provider: 'resend',
      currentStatus: 'bounced',
      currentOccurredAt: '2026-09-26T09:12:00Z',
      events: [],
      booking: null,
    },
  ];
}

function smsSummary(empty: boolean) {
  const n = (value: number) => (empty ? 0 : value);
  return {
    total: n(64),
    queued: n(1),
    sent: n(3),
    delivered: n(55),
    undelivered: n(3),
    failed: n(2),
    deliveredRate: empty ? 0 : 55 / 64,
    failureRate: empty ? 0 : 5 / 64,
    uniqueRecipients: n(58),
    uniqueBookings: n(52),
    stuckInFlight: n(2),
    whatsappCount: n(41),
    smsCount: n(23),
    fallbackCount: n(6),
  };
}

function smsAttempts(empty: boolean) {
  if (empty) return [];
  const event = (id: string, status: string, occurredAt: string) => ({
    id,
    bookingId: 'booking-1',
    restaurantId,
    smsType: 'booking_confirmation',
    recipientPhone: '+44 7700 900123',
    messageSid: `SM${id}`,
    status,
    provider: 'twilio',
    occurredAt,
    error: null,
    metadata: null,
  });
  return [
    {
      messageSid: 'SM-whatsapp-1',
      recipientPhone: '+44 7700 900123',
      bookingId: 'booking-1',
      smsType: 'booking_confirmation',
      provider: 'twilio',
      currentStatus: 'delivered',
      currentOccurredAt: '2026-09-26T18:05:00Z',
      events: [
        event('e1', 'sent', '2026-09-26T18:04:00Z'),
        event('e2', 'delivered', '2026-09-26T18:05:00Z'),
      ],
      booking: null,
      channel: 'whatsapp',
    },
    {
      messageSid: 'SM-sms-fallback-1',
      recipientPhone: '+44 7700 900456',
      bookingId: 'booking-2',
      smsType: 'booking_reminder',
      provider: 'twilio',
      currentStatus: 'sent',
      currentOccurredAt: '2026-09-25T08:00:00Z',
      events: [event('e3', 'sent', '2026-09-25T08:00:00Z')],
      booking: null,
      channel: 'sms',
      fallbackForAttemptId: 'SM-whatsapp-0',
      isStale: true,
      stuckForMs: 30 * 60 * 60 * 1000,
    },
  ];
}

function reviewSummary(empty: boolean) {
  const n = (value: number) => (empty ? 0 : value);
  return {
    from: '2026-08-28T00:00:00.000Z',
    to: '2026-09-27T23:59:59.999Z',
    completedVisits: n(240),
    eligible: n(180),
    suppressed: n(24),
    sent: n(172),
    reached: n(156),
    clicked: n(58),
    newGoogleReviews: n(31),
    channels: {
      whatsapp: {
        sent: n(140),
        delivered: n(130),
        read: n(112),
        opened: 0,
        clicked: n(50),
        failed: n(10),
        costMicrounits: empty ? 0 : 6_860_000,
        costCurrency: empty ? null : 'GBP',
      },
      email: {
        sent: n(32),
        delivered: n(26),
        read: 0,
        opened: n(18),
        clicked: n(8),
        failed: n(6),
        costMicrounits: 0,
        costCurrency: null,
      },
    },
  };
}

async function installApiMocks(page: Page, state: DataState) {
  const empty = state === 'empty';
  const hang = () => new Promise<never>(() => undefined);

  await page.route('http://unpkg.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );

  await page.route('**/api/ops/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

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

    const isDeliveryData =
      pathname.startsWith('/api/ops/email-delivery') ||
      pathname.startsWith('/api/ops/email-queue') ||
      pathname.startsWith('/api/ops/sms-delivery') ||
      pathname === '/api/ops/reviews/summary';
    if (state === 'loading' && isDeliveryData) {
      await hang();
      return;
    }
    if (state === 'error' && isDeliveryData) {
      await route.fulfill({
        status: 503,
        json: {
          ok: false,
          code: 'DELIVERY_LOG_UNAVAILABLE',
          error: 'Tracking unavailable',
          message: 'Tracking unavailable',
        },
      });
      return;
    }

    const range = url.searchParams.get('range') ?? '7d';
    if (pathname === '/api/ops/email-delivery/summary') {
      await route.fulfill({
        json: { ok: true, restaurantId, range, summary: emailSummary(empty) },
      });
      return;
    }
    if (pathname === '/api/ops/email-delivery') {
      await route.fulfill({
        json: {
          ok: true,
          restaurantId,
          range,
          pageInfo: { page: 1, pageSize: 50, hasNext: false },
          attempts: emailAttempts(empty),
          summary: emailSummary(empty),
        },
      });
      return;
    }
    if (pathname === '/api/ops/email-queue') {
      await route.fulfill({
        json: {
          ok: true,
          restaurantId,
          pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
          summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
          jobs: [],
          timestamp: '2026-09-27T09:00:00.000Z',
        },
      });
      return;
    }
    if (pathname === '/api/ops/sms-delivery') {
      const stuckOnly = url.searchParams.get('stuckOnly') === 'true';
      await route.fulfill({
        json: {
          ok: true,
          restaurantId,
          range,
          pageInfo: { page: 1, pageSize: 50, hasNext: false },
          attempts: smsAttempts(empty).filter((attempt) => !stuckOnly || attempt.isStale),
          summary: smsSummary(empty),
        },
      });
      return;
    }
    if (pathname === '/api/ops/reviews/summary') {
      await route.fulfill({
        json: { ok: true, restaurantId, range, summary: reviewSummary(empty) },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

/**
 * Resize and keep the requested colour mode. The mode is re-applied after each resize because
 * the sidebar's colour-mode control can remount at a breakpoint and reset the class.
 */
async function resize(page: Page, width: number, dark: boolean) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate((isDark) => {
    window.localStorage.setItem('nabatable-color-mode', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, dark);
}

async function expectNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(0);
}

async function openScreen(
  page: Page,
  screen: (typeof SCREENS)[number],
  { state, dark }: { state: DataState; dark: boolean },
) {
  await page.addInitScript(
    (mode) => {
      window.localStorage.setItem('nabatable-color-mode', mode);
    },
    dark ? 'dark' : 'light',
  );
  await installApiMocks(page, state);
  await page.goto(`${screen.path}?restaurantId=${restaurantId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: screen.heading })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Communications delivery sections' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: NAV_LABEL[screen.key] })).toHaveAttribute(
    'aria-current',
    'page',
  );

  if (state === 'loading') {
    if (screen.key !== 'email') {
      await expect(page.getByTestId('comms-metric-skeleton')).toHaveCount(4);
    }
  } else {
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  }
}

test.describe('ops communications delivery layout', () => {
  test.use({ baseURL: appHostBaseUrl });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: '__nabatable_qa_ops_auth',
        value: 'enabled',
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
  });

  test('overview preserves range and restaurant across channel navigation @p1 @browser @dry-run-only @local-only', async ({
    page,
  }) => {
    await openScreen(page, SCREENS[0], { state: 'data', dark: false });
    await page.getByRole('combobox', { name: 'Date range' }).click();
    await page.getByRole('option', { name: 'Last 30 days' }).click();
    await expect(page).toHaveURL(/range=30d/);
    const nav = page.getByRole('navigation', { name: 'Communications delivery sections' });
    await expect(nav.getByRole('link', { name: /^Messages/ })).toHaveAttribute(
      'href',
      `/app/communications-delivery/messages?restaurantId=${restaurantId}&range=30d`,
    );
    await nav.getByRole('link', { name: /^Messages/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Message Delivery' })).toBeVisible();
    await expect(page).toHaveURL(/range=30d/);
    await expect(page).toHaveURL(new RegExp(`restaurantId=${restaurantId}`));
  });

  test('overview keeps healthy channel visible and recovers failed summaries @p1 @browser @dry-run-only @local-only', async ({
    page,
  }, testInfo) => {
    await installApiMocks(page, 'data');
    let failing = true;
    await page.route('**/api/ops/email-delivery/summary?**', async (route) => {
      if (!failing) return route.fallback();
      return route.fulfill({
        status: 503,
        json: { ok: false, code: 'DELIVERY_LOG_UNAVAILABLE', error: 'Tracking unavailable' },
      });
    });
    await page.goto(`/communications-delivery?restaurantId=${restaurantId}`);
    const trackingAlert = page
      .getByRole('alert')
      .filter({ hasText: 'Email tracking could not be refreshed' });
    await expect(trackingAlert).toBeVisible();
    await expect(page.getByText('86%', { exact: true })).toBeVisible();
    await expect(page.getByText('Summary unavailable', { exact: true })).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath('overview-partial-failure.png'),
      fullPage: true,
    });
    failing = false;
    await page.getByRole('button', { name: 'Retry summaries' }).click();
    await expect(page.getByText('88%', { exact: true })).toBeVisible();
    await expect(trackingAlert).toHaveCount(0);
  });

  test('message stuck filter reaches the backend and clears without losing context @p1 @browser @dry-run-only @local-only', async ({
    page,
  }) => {
    await openScreen(page, SCREENS[2], { state: 'data', dark: false });
    const request = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        url.pathname === '/api/ops/sms-delivery' && url.searchParams.get('stuckOnly') === 'true'
      );
    });
    await page.getByRole('button', { name: 'Show stuck only' }).click();
    expect(new URL((await request).url()).searchParams.get('restaurantId')).toBe(restaurantId);
    await expect(page.getByRole('button', { name: 'Show all messages' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Show all messages' }).click();
    await expect(page.getByRole('button', { name: 'Show stuck only' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('combobox', { name: 'Select date range' }).click();
    await page.getByRole('option', { name: 'Last 30 days' }).click();
    await expect(page).toHaveURL(/range=30d/);
    await expect(
      page
        .getByRole('navigation', { name: 'Communications delivery sections' })
        .getByRole('link', { name: /^Email/ }),
    ).toHaveAttribute(
      'href',
      `/app/communications-delivery/email?restaurantId=${restaurantId}&range=30d`,
    );
  });

  for (const screen of SCREENS) {
    test(`${screen.key} tracking error is actionable @p1 @browser @dry-run-only @local-only`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await openScreen(page, screen, { state: 'error', dark: false });
      await expect(page.getByRole('alert').first()).toBeVisible();
      await expectNoHorizontalPageScroll(page);
      await page.screenshot({
        path: testInfo.outputPath(`${screen.key}-tracking-error.png`),
        fullPage: true,
      });
    });
  }

  for (const screen of SCREENS) {
    for (const dark of [false, true]) {
      const mode = dark ? 'dark' : 'light';

      test(`${screen.key} holds every size class in ${mode} @p1 @browser @dry-run-only @local-only`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: SIZES[0].width, height: 900 });
        await openScreen(page, screen, { state: 'data', dark });

        for (const size of SIZES) {
          await resize(page, size.width, dark);
          await expectNoHorizontalPageScroll(page);
          await page.screenshot({
            path: testInfo.outputPath(`${screen.key}-${mode}-data-${size.name}.png`),
            fullPage: true,
          });
        }

        // 200% text zoom: rem-based layout must still fit without sideways scrolling.
        await resize(page, 1280, dark);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await expectNoHorizontalPageScroll(page);
        await page.screenshot({
          path: testInfo.outputPath(`${screen.key}-${mode}-data-zoom200.png`),
          fullPage: true,
        });
      });

      for (const state of ['empty', 'loading'] as const) {
        test(`${screen.key} ${state} state in ${mode} @p1 @browser @dry-run-only @local-only`, async ({
          page,
        }, testInfo) => {
          await page.setViewportSize({ width: 390, height: 900 });
          await openScreen(page, screen, { state, dark });

          for (const width of [390, 768, 1024]) {
            await resize(page, width, dark);
            await expectNoHorizontalPageScroll(page);
            await page.screenshot({
              path: testInfo.outputPath(`${screen.key}-${mode}-${state}-${width}.png`),
              fullPage: true,
            });
          }

          if (state === 'empty' && screen.key !== 'email') {
            // Zero is a real value, not an empty card.
            await expect(page.getByText(/^0(%| \/ 0)?$/).first()).toBeVisible();
          }
        });
      }
    }
  }
});
