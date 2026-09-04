import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

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
  businessDescription: 'Local QA fixture restaurant for review-growth browser proof.',
  managerDailySummaryEnabled: true,
  managerNotificationPhone: '+440000000001',
  googleMapUrl: null,
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=qa',
  bookingPolicy: 'QA browser fixtures only.',
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  role: 'owner',
};

const reviewSummary = {
  ok: true,
  restaurantId,
  range: '30d',
  summary: {
    from: '2026-08-05T00:00:00.000Z',
    to: '2026-09-04T23:59:59.999Z',
    completedVisits: 240,
    eligible: 180,
    suppressed: 24,
    sent: 172,
    reached: 156,
    clicked: 58,
    newGoogleReviews: 31,
    channels: {
      whatsapp: {
        sent: 140,
        delivered: 130,
        read: 112,
        opened: 0,
        clicked: 50,
        failed: 10,
        costMicrounits: 6_860_000,
        costCurrency: 'GBP',
      },
      email: {
        sent: 32,
        delivered: 26,
        read: 0,
        opened: 18,
        clicked: 8,
        failed: 6,
        costMicrounits: 0,
        costCurrency: null,
      },
    },
  },
};

async function installReviewGrowthApiMocks(page: Page) {
  // Next's local dev tooling injects optional helpers from unpkg. Keep this
  // browser proof deterministic and fully offline without changing app code.
  await page.route('http://unpkg.com/**', async (route) => {
    await route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/ops/restaurants') {
      await route.fulfill({
        json: {
          items: [restaurant],
          pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
        },
      });
      return;
    }

    if (url.pathname === `/api/ops/restaurants/${restaurantId}`) {
      await route.fulfill({ json: { restaurant } });
      return;
    }

    if (url.pathname === '/api/ops/reviews/summary') {
      await route.fulfill({ json: reviewSummary });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops review growth shipped route', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: '__nabatable_qa_ops_auth',
        value: 'enabled',
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await installReviewGrowthApiMocks(page);
  });

  test('renders the funnel, channel economics, and attribution caveat @p1 @browser @smoke @dry-run-only @local-only', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(`/communications-delivery/reviews?restaurantId=${restaurantId}&range=30d`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/communications-delivery\/reviews/);
    await expect(page.getByRole('heading', { name: 'Review Growth' })).toBeVisible();
    await expect(page.getByText('End-to-end funnel')).toBeVisible();
    await expect(page.getByText('WhatsApp vs email')).toBeVisible();
    await expect(page.getByRole('cell', { name: '£6.86' })).toBeVisible();
    await expect(page.getByText('Maximum 2 asks')).toBeVisible();
    await expect(page.getByText(/not person-level attribution/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reviews' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(consoleErrors).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath('ops-review-growth-desktop.png'),
      fullPage: true,
    });
  });
});
