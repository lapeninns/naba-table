import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';

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

const serviceDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: restaurant.timezone,
}).format(new Date());

const booking = {
  id: bookingId,
  restaurantId,
  restaurantName: restaurant.name,
  restaurantSlug: restaurant.slug,
  restaurantTimezone: restaurant.timezone,
  reservationIntervalMinutes: 15,
  partySize: 4,
  startIso: `${serviceDate}T18:00:00.000Z`,
  endIso: `${serviceDate}T19:30:00.000Z`,
  status: 'confirmed',
  notes: 'Window seat if possible.',
  customerName: 'Alex Johnson',
  customerEmail: 'alex@example.test',
  customerPhone: '+447700900123',
  startTime: '18:00',
  endTime: '19:30',
  reference: 'QA123',
  details: null,
  source: 'phone',
  profileNotes: null,
  allergies: ['Nuts'],
  dietaryRestrictions: ['Vegetarian'],
  seatingPreference: null,
  marketingOptIn: null,
  tableAssignments: [],
  requiresTableAssignment: false,
  checkedInAt: null,
  checkedOutAt: null,
};

async function installBookingDialogApiMocks(page: Page) {
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

    if (pathname === '/api/ops/bookings') {
      await route.fulfill({
        json: {
          items: [booking],
          pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
        },
      });
      return;
    }

    if (pathname === '/api/ops/bookings/status-summary') {
      await route.fulfill({
        json: {
          restaurantId,
          range: { from: null, to: null },
          filter: { statuses: null },
          totals: {
            pending: 0,
            pending_allocation: 0,
            confirmed: 1,
            checked_in: 0,
            PRIORITY_WAITLIST: 0,
            completed: 0,
            cancelled: 0,
            no_show: 0,
          },
          generatedAt: '2026-05-16T00:00:00.000Z',
        },
      });
      return;
    }

    if (pathname === `/api/ops/bookings/${bookingId}/dialog`) {
      await route.fulfill({
        json: {
          booking,
          assignmentContext: {
            booking: {
              id: bookingId,
              restaurant_id: restaurantId,
              party_size: booking.partySize,
              status: booking.status,
            },
            currentAssignments: [],
            suggestedTables: [],
            zones: [],
            disabledAssignments: [],
            contextVersion: 'qa-context-version',
          },
        },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops booking dialog action rail', () => {
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
    await installBookingDialogApiMocks(page);
  });

  test('opens the booking dialog action rail from the shipped bookings route @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto(`/bookings?date=${serviceDate}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(/app\.localhost:\d+\/bookings/);
    await expect(page.getByRole('heading', { name: 'Manage bookings' })).toBeVisible();
    await expect(page.getByText('Alex Johnson').first()).toBeVisible();

    await page.getByRole('button', { name: 'Details', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Booking for Alex Johnson' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Call Guest' })).toHaveAttribute(
      'href',
      'tel:+447700900123',
    );

    await page.getByRole('button', { name: 'More operations' }).click();
    await expect(page.getByRole('menuitem', { name: 'Copy summary' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copy reference' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Mark no-show' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Cancel booking' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-booking-dialog-action-rail-desktop.png'),
      fullPage: true,
    });
  });
});
