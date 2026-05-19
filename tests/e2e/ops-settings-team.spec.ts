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
  businessDescription: 'Local QA fixture restaurant for settings browser proof.',
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

const operatingHours = {
  updatedAt: '2026-05-16T00:00:00.000Z',
  weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    notes: null,
    reservationIntervalMinutes: 15,
    reservationSlotTimes: null,
  })),
  overrides: [],
};

const servicePeriods = Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
  {
    id: `lunch-${dayOfWeek}`,
    name: 'Lunch',
    dayOfWeek,
    startTime: '12:00',
    endTime: '15:00',
    bookingOption: 'lunch',
    updatedAt: null,
  },
  {
    id: `dinner-${dayOfWeek}`,
    name: 'Dinner',
    dayOfWeek,
    startTime: '17:00',
    endTime: '22:00',
    bookingOption: 'dinner',
    updatedAt: null,
  },
]);

const occasions = [
  {
    key: 'lunch',
    label: 'Lunch',
    shortLabel: 'Lunch',
    description: 'Lunch bookings',
    availability: [{ kind: 'anytime' }],
    defaultDurationMinutes: 90,
    displayOrder: 10,
    isActive: true,
    isBuiltin: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  },
  {
    key: 'dinner',
    label: 'Dinner',
    shortLabel: 'Dinner',
    description: 'Dinner bookings',
    availability: [{ kind: 'anytime' }],
    defaultDurationMinutes: 120,
    displayOrder: 20,
    isActive: true,
    isBuiltin: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  },
];

const emailTemplateVariant = {
  id: 'confirmation-default',
  name: 'Default',
  subject: 'Booking confirmed - {{venue}}',
  preheader: 'Your table is confirmed.',
  headline: 'Booking confirmed',
  intro: 'We look forward to seeing you.',
  cue: '',
  ask: '',
  ctaLabel: 'Manage booking',
  isActive: true,
  order: 0,
};

async function waitForSettled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

async function installSettingsApiMocks(page: Page) {
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

    if (pathname === `/api/ops/restaurants/${restaurantId}/hours`) {
      await route.fulfill({ json: operatingHours });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/service-periods`) {
      await route.fulfill({ json: { periods: servicePeriods } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/turn-bands`) {
      await route.fulfill({
        json: {
          restaurantId,
          bands: {
            dinner: [{ maxPartySize: 6, durationMinutes: 120 }],
            lunch: [{ maxPartySize: 6, durationMinutes: 90 }],
          },
          defaults: {},
        },
      });
      return;
    }

    if (pathname === '/api/ops/occasions') {
      await route.fulfill({ json: { occasions } });
      return;
    }

    if (pathname === '/api/ops/team/invitations') {
      await route.fulfill({
        json: {
          invites: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              restaurantId,
              email: 'pending.manager@example.test',
              role: 'manager',
              status: 'pending',
              expiresAt: '2026-06-16T12:00:00.000Z',
              invitedBy: '99999999-9999-4999-8999-999999999999',
              acceptedAt: null,
              revokedAt: null,
              createdAt: '2026-05-16T12:00:00.000Z',
              updatedAt: '2026-05-16T12:00:00.000Z',
            },
          ],
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/email-templates`) {
      await route.fulfill({
        json: {
          restaurantId,
          canEdit: true,
          groups: [
            {
              key: 'confirmation',
              title: 'Confirmation',
              description: 'Confirmed reservation emails sent when a table is secured.',
              templates: [
                {
                  key: 'confirmation',
                  title: 'Booking confirmed',
                  description: 'Confirmed reservation emails sent when a table is secured.',
                  groupKey: 'confirmation',
                  supportsCtaLabel: true,
                  availableVariables: ['{{venue}}', '{{date}}', '{{time}}', '{{party}}'],
                  recommendedVariables: ['{{venue}}', '{{date}}', '{{time}}'],
                  authoringHints: ['Keep the guest-facing confirmation clear.'],
                  status: 'default',
                  activeVariantCount: 1,
                  variants: [emailTemplateVariant],
                  defaultVariants: [emailTemplateVariant],
                },
              ],
            },
          ],
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/email-templates/confirmation/preview`) {
      await route.fulfill({
        json: {
          preview: {
            templateKey: 'confirmation',
            selectedVariantId: 'confirmation-default',
            selectedVariantName: 'Default',
            preheader: 'Your table is confirmed.',
            headline: 'Booking confirmed',
            intro: 'We look forward to seeing you.',
            cue: '',
            ask: '',
            ctaLabel: 'Manage booking',
            ctaUrl: 'https://nabatable.example.test/manage',
            subject: 'Booking confirmed - QA App Host Restaurant',
            html: '<p>Booking confirmed</p>',
            text: 'Booking confirmed',
          },
        },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

test.describe('ops restaurant settings and team shipped routes', () => {
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
    await installSettingsApiMocks(page);
  });

  test('team settings route renders invite workflow proof @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/team', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/team/);
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.locator('main').getByText('Team workflow')).toBeVisible();
    await expect(page.locator('main').getByText('Invite a team member')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send invite' })).toBeVisible();

    await page.getByRole('button', { name: 'Invitations' }).click();
    await expect(
      page.locator('main').getByRole('cell', { name: 'pending.manager@example.test' }),
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-team-desktop.png'),
      fullPage: true,
    });
  });

  test('availability settings routes load shipped schedule and booking type surfaces @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    for (const { routePath, heading, initialWorkspace } of [
      {
        routePath: '/settings/restaurant/availability',
        heading: 'Availability & Booking types',
        initialWorkspace: 'rules',
      },
      {
        routePath: '/settings/restaurant/operating-hours',
        heading: 'Operating hours',
        initialWorkspace: 'schedule',
      },
      {
        routePath: '/settings/restaurant/service-periods',
        heading: 'Service periods',
        initialWorkspace: 'schedule',
      },
      {
        routePath: '/settings/restaurant/turn-durations',
        heading: 'Reservation durations',
        initialWorkspace: 'booking-types',
      },
      {
        routePath: '/settings/restaurant/occasions',
        heading: 'Booking types',
        initialWorkspace: 'booking-types',
      },
    ] as const) {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      await expect(page).toHaveURL(new RegExp(`app\\.localhost:\\d+${routePath}`));
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.locator('main').getByText('Availability sections')).toBeVisible();
      if (initialWorkspace === 'rules') {
        await expect(
          page.locator('#booking-rules').getByText('Booking rules', { exact: true }),
        ).toBeVisible();
      } else if (initialWorkspace === 'schedule') {
        await expect(
          page.locator('main').getByText('Weekly operating hours', { exact: true }),
        ).toBeVisible();
      } else {
        await expect(page.locator('main').getByText('Booking types and turn times')).toBeVisible();
      }

      await page
        .locator('main')
        .getByRole('button', { name: /^Schedule/ })
        .click();
      await expect(
        page.locator('main').getByText('Weekly operating hours', { exact: true }),
      ).toBeVisible();

      await page
        .locator('main')
        .getByRole('button', { name: /^Booking types/ })
        .click();
      await expect(page.locator('main').getByText('Booking types and turn times')).toBeVisible();
      await expect(page.locator('#booking-occasions').getByRole('row', { name: /Lunch/ })).toBeVisible();
      await expect(page.locator('#booking-occasions').getByRole('row', { name: /Dinner/ })).toBeVisible();
    }

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-availability-desktop.png'),
      fullPage: true,
    });
  });

  test('email templates settings route redirects to standalone command center @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/settings/restaurant/email-templates', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/email-templates/);
    await expect(page.locator('aside').getByText('Email Templates')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.locator('aside').getByText('Booking confirmed')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-email-templates-desktop.png'),
      fullPage: true,
    });
  });
});
