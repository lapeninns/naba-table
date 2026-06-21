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
  businessDescription: 'Local QA fixture restaurant for customers and delivery browser proof.',
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

const customersPage = {
  items: [
    {
      id: 'cust-qa-avery',
      restaurantId,
      name: 'Avery Guest',
      email: 'avery.guest@example.test',
      phone: '+44 7000 000101',
      marketingOptIn: true,
      createdAt: '2026-05-10T10:00:00.000Z',
      firstBookingAt: '2026-05-10T18:00:00.000Z',
      lastBookingAt: '2026-05-15T19:00:00.000Z',
      totalBookings: 6,
      totalCovers: 18,
      totalCancellations: 0,
    },
    {
      id: 'cust-qa-riley',
      restaurantId,
      name: 'Riley Returning',
      email: 'riley.returning@example.test',
      phone: '+44 7000 000202',
      marketingOptIn: false,
      createdAt: '2026-04-01T10:00:00.000Z',
      firstBookingAt: '2026-04-04T18:00:00.000Z',
      lastBookingAt: '2026-05-01T19:00:00.000Z',
      totalBookings: 3,
      totalCovers: 8,
      totalCancellations: 1,
    },
  ],
  pageInfo: { page: 1, pageSize: 50, total: 2, hasNext: false },
  summary: {
    total: 2,
    optedIn: 1,
    optedOut: 1,
    returning: 2,
    vip: 1,
    neverVisited: 0,
  },
};

const emailDeliverySummary = {
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
  uniqueBookings: 2,
  p50DeliverySeconds: 16,
  p95DeliverySeconds: 30,
  topFailedTemplates: [{ templateType: 'booking_confirmation', count: 1 }],
  topFailedEmailTypes: [{ emailType: 'booking_confirmation', count: 1 }],
  stuckInFlight: 0,
};

const emailDeliveryFeed = {
  ok: true,
  restaurantId,
  range: '7d',
  pageInfo: { page: 1, pageSize: 50, hasNext: false },
  summary: emailDeliverySummary,
  attempts: [
    {
      id: 'email-log-failed-1',
      messageId: 'msg_qa_failed_1',
      recipientEmail: 'qa.delivery@example.test',
      bookingId: 'booking-email-1',
      emailType: 'booking_confirmation',
      templateType: 'booking_confirmation',
      provider: 'mock',
      currentStatus: 'failed',
      currentOccurredAt: '2026-05-16T12:10:00.000Z',
      booking: {
        id: 'booking-email-1',
        reference: 'QA-EMAIL-1',
        bookingDate: '2026-05-17',
        startTime: '18:00',
        endTime: '19:30',
        customerName: 'Email QA Guest',
        partySize: 2,
      },
      events: [
        {
          id: 'email-event-failed-1',
          bookingId: 'booking-email-1',
          restaurantId,
          emailType: 'booking_confirmation',
          templateType: 'booking_confirmation',
          recipientEmail: 'qa.delivery@example.test',
          messageId: 'msg_qa_failed_1',
          status: 'failed',
          provider: 'mock',
          occurredAt: '2026-05-16T12:10:00.000Z',
          error: 'Mock provider rejected the message.',
          metadata: { subject: 'QA booking confirmation failed' },
        },
      ],
    },
  ],
};

const emailQueueFeed = {
  ok: true,
  restaurantId,
  pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 1 },
  summary: { total: 1, waiting: 0, active: 0, delayed: 1, dlq: 0 },
  jobs: [
    {
      id: 'email-job-qa-1',
      status: 'delayed',
      type: 'review_request',
      bookingId: 'booking-email-2',
      restaurantId,
      scheduledFor: '2026-05-17T12:00:00.000Z',
      failedReason: null,
      failedAt: null,
      attemptsMade: 0,
      booking: {
        id: 'booking-email-2',
        reference: 'QA-QUEUE-1',
        customerName: 'Queue QA Guest',
        customerEmail: 'queue.qa@example.test',
        startAt: '2026-05-17T18:00:00.000Z',
        endAt: '2026-05-17T19:30:00.000Z',
        status: 'confirmed',
      },
    },
  ],
  timestamp: '2026-05-16T12:00:00.000Z',
};

const smsDeliveryFeed = {
  ok: true,
  restaurantId,
  range: '7d',
  pageInfo: { page: 1, pageSize: 50, hasNext: false },
  summary: {
    total: 2,
    queued: 0,
    sent: 0,
    delivered: 1,
    undelivered: 0,
    failed: 1,
    deliveredRate: 0.5,
    failureRate: 0.5,
    uniqueRecipients: 2,
    uniqueBookings: 2,
    stuckInFlight: 0,
  },
  attempts: [
    {
      messageSid: 'SM_qa_delivered_1',
      recipientPhone: 'ending 0101',
      bookingId: 'booking-sms-1',
      smsType: 'booking_confirmation',
      provider: 'mock',
      currentStatus: 'delivered',
      currentOccurredAt: '2026-05-16T12:05:00.000Z',
      booking: {
        id: 'booking-sms-1',
        reference: 'QA-SMS-1',
        bookingDate: '2026-05-17',
        startTime: '18:00',
        endTime: '19:30',
        customerName: 'SMS QA Guest',
        partySize: 2,
      },
      events: [
        {
          id: 'sms-event-delivered-1',
          bookingId: 'booking-sms-1',
          restaurantId,
          smsType: 'booking_confirmation',
          recipientPhone: 'ending 0101',
          messageSid: 'SM_qa_delivered_1',
          status: 'delivered',
          provider: 'mock',
          occurredAt: '2026-05-16T12:05:00.000Z',
          error: null,
          metadata: null,
        },
      ],
    },
  ],
};

async function waitForSettled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

async function installCustomersDeliveryApiMocks(page: Page) {
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

    if (pathname === '/api/ops/customers') {
      await route.fulfill({ json: customersPage });
      return;
    }

    if (pathname === '/api/ops/email-delivery') {
      if (url.searchParams.get('summaryOnly') === '1') {
        await route.fulfill({
          json: {
            ok: true,
            restaurantId,
            range: '7d',
            summary: emailDeliverySummary,
          },
        });
        return;
      }

      await route.fulfill({ json: emailDeliveryFeed });
      return;
    }

    if (pathname === '/api/ops/email-queue') {
      await route.fulfill({ json: emailQueueFeed });
      return;
    }

    if (pathname === '/api/ops/sms-delivery') {
      await route.fulfill({ json: smsDeliveryFeed });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops customers and delivery shipped routes', () => {
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
    await installCustomersDeliveryApiMocks(page);
  });

  test('customers route renders guest list filters and export controls @p1 @browser @smoke @dry-run-only @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/customers?focus=cust-qa-avery', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/customers/);
    await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible();
    await expect(page.locator('main').getByText('Guest metrics')).toBeVisible();
    await expect(page.locator('main').getByText('Avery Guest')).toBeVisible();
    await expect(page.getByLabel('Avery Guest', { exact: true }).getByText('VIP')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export guests to CSV' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search guests' }).fill('Avery');
    await expect(page.locator('main').getByText('Avery Guest')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-customers-desktop.png'),
      fullPage: true,
    });
  });

  test('email delivery route renders delivery log filters and queue monitor @p1 @browser @smoke @dry-run-only @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/email-delivery', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/email-delivery/);
    await expect(page.getByRole('heading', { name: 'Email Delivery' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Delivery Log' })).toBeVisible();
    await expect(
      page.getByRole('searchbox', { name: 'Search email delivery attempts' }),
    ).toBeVisible();
    await expect(page.locator('main').getByText('QA booking confirmation failed')).toBeVisible();
    await expect(page.locator('main').getByText('QA-EMAIL-1')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry email for qa.delivery@example.test' }),
    ).toBeVisible();

    await page
      .getByRole('searchbox', { name: 'Search email delivery attempts' })
      .fill('qa.delivery@example.test');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/recipientEmail=qa\.delivery%40example\.test/);

    await page.getByRole('tab', { name: 'Queue' }).click();
    await expect(page.locator('main').getByText('Scheduled email queue')).toBeVisible();
    await expect(page.locator('main').getByText('QA-QUEUE-1')).toBeVisible();
    await expect(page.locator('main').getByText('Queue QA Guest')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-email-delivery-desktop.png'),
      fullPage: true,
    });
  });

  test('sms delivery route renders dashboard filters without full recipient phone exposure @p1 @browser @smoke @dry-run-only @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/sms-delivery', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/sms-delivery/);
    await expect(page.getByRole('heading', { name: 'SMS Delivery' })).toBeVisible();
    await expect(page.locator('main').getByText('Total attempts')).toBeVisible();
    await expect(page.locator('main').getByText('SMS Delivery Log')).toBeVisible();
    await expect(page.locator('main').getByText('Booking confirmation')).toBeVisible();
    await expect(page.locator('main').getByText('Ref QA-SMS-1')).toBeVisible();
    await expect(page.locator('main').getByText('ending 0101')).toBeVisible();
    await expect(page.locator('main').getByText('+447700900101')).toHaveCount(0);

    await page.getByRole('button', { name: 'Failed' }).click();
    await expect(page.locator('main').getByText('Booking confirmation')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-sms-delivery-desktop.png'),
      fullPage: true,
    });
  });
});
