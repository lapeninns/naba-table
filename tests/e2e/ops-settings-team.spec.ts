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

async function expectDirtyNavigationBlocked(page: Page, action: () => Promise<unknown>) {
  const dialogPromise = page.waitForEvent('dialog');
  const actionPromise = action();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toContain('unsaved');
  await dialog.dismiss();
  await actionPromise;
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

    if (pathname === `/api/ops/restaurants/${restaurantId}/availability`) {
      // The Availability page reads one snapshot of hours, meal times, table times and rules.
      const bands = {
        dinner: [{ maxPartySize: 6, durationMinutes: 120 }],
        lunch: [{ maxPartySize: 6, durationMinutes: 90 }],
      };
      await route.fulfill({
        json: {
          data: {
            restaurantId,
            revision: 'qa-availability-r1',
            revisions: {
              hours: 'qa-hours-r1',
              servicePeriods: 'qa-periods-r1',
              turnBands: 'qa-bands-r1',
              rules: 'qa-rules-r1',
            },
            hours: operatingHours,
            servicePeriods,
            turnBands: { restaurantId, bands, defaults: bands },
            rules: {
              reservationIntervalMinutes: 15,
              reservationDefaultDurationMinutes: 90,
              reservationLastSeatingBufferMinutes: 15,
              reservationLifecycleGraceMinutes: 30,
              bookingPolicy: 'QA browser fixtures only.',
              updatedAt: '2026-05-16T00:00:00.000Z',
            },
          },
        },
      });
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
              // Far-future expiry keeps the fixture in the Waiting filter whatever the run date.
              expiresAt: '2099-06-16T12:00:00.000Z',
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
    await expect(
      page.locator('main').getByText(/signed in as an Owner, so you can invite people/),
    ).toBeVisible();
    await expect(page.getByRole('form', { name: 'Invite someone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send invitation', exact: true })).toBeVisible();

    const filters = page.getByRole('group', { name: 'Filter invitations' });
    await expect(filters.getByRole('radio', { name: 'Waiting 1' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const inviteRow = page.getByTestId('team-invite-33333333-3333-4333-8333-333333333333');
    await expect(inviteRow).toContainText('pending.manager@example.test');
    await expect(inviteRow).toContainText('Waiting to be accepted');
    await expect(inviteRow).toContainText('Expires 16 Jun 2099');
    await expect(
      inviteRow.getByRole('button', { name: 'Revoke invitation for pending.manager@example.test' }),
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-team-desktop.png'),
      fullPage: true,
    });
  });

  test('availability settings routes load shipped schedule and booking type surfaces @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    // Former availability URLs redirect to their section of the one page.
    for (const { routePath, landsOn } of [
      { routePath: '/settings/restaurant/availability', landsOn: '' },
      { routePath: '/settings/restaurant/operating-hours', landsOn: '#weekly-hours' },
      { routePath: '/settings/restaurant/service-periods', landsOn: '#service-windows' },
      { routePath: '/settings/restaurant/turn-durations', landsOn: '#booking-occasions' },
      { routePath: '/settings/restaurant/occasions', landsOn: '#booking-occasions' },
    ] as const) {
      await page.goto(routePath, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      await expect(page).toHaveURL(
        new RegExp(`app\\.localhost:\\d+/settings/restaurant/availability${landsOn}$`),
      );
      await expect(
        page.getByRole('heading', { level: 1, name: 'Availability', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Sections on this page' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Weekly hours and meal times' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Booking rules' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Booking types and table times' }),
      ).toBeVisible();
      // Restaurant admins see each booking type's state; only platform admins get the switch.
      const bookingTypes = page.locator('#booking-occasions');
      await expect(bookingTypes.getByText('Lunch', { exact: true }).first()).toBeVisible();
      await expect(bookingTypes.getByText('Dinner', { exact: true }).first()).toBeVisible();
      await expect(bookingTypes.getByText('Available to book').first()).toBeVisible();
    }

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-availability-desktop.png'),
      fullPage: true,
    });
  });

  test('former email templates route redirects into restaurant settings @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/email-templates', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    await expect(page).toHaveURL(/app\.localhost:\d+\/settings\/restaurant\/email-templates/);
    await expect(page.getByRole('heading', { level: 1, name: 'Email templates' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Templates' }).getByText('Booking confirmed').first(),
    ).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('ops-settings-email-templates-desktop.png'),
      fullPage: true,
    });
  });

  test('former settings URLs redirect to their one settings page @p1 @browser @smoke @local-only', async ({
    page,
  }) => {
    for (const { from, to, heading } of [
      { from: '/settings/tables', to: '/settings/restaurant/tables', heading: 'Tables' },
      { from: '/management/team', to: '/settings/restaurant/team', heading: 'Team' },
      {
        from: '/settings/restaurant/table-layout',
        to: '/settings/restaurant/floor-layout',
        heading: 'Floor layout',
      },
    ] as const) {
      await page.goto(from, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);
      await expect(page).toHaveURL(new RegExp(`app\\.localhost:\\d+${to}$`));
      await expect(
        page.getByRole('heading', { level: 1, name: heading, exact: true }),
      ).toBeVisible();
    }
  });

  test('dirty availability settings block sidebar breadcrumb and exit navigation @p1 @browser @smoke @local-only', async ({
    page,
  }) => {
    await page.goto('/settings/restaurant/availability', { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Days are collapsed until selected; open Monday to edit its hours.
    const monday = page.locator('#availability-day-1-panel');
    await expect(async () => {
      if (await monday.isHidden()) await page.locator('#availability-day-1 > button').click();
      await expect(monday).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await monday.getByLabel('Opens').first().fill('12:30');
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();

    await expectDirtyNavigationBlocked(page, () =>
      page.getByRole('link', { name: 'Profile', exact: true }).click(),
    );
    await expect(page).toHaveURL(/\/settings\/restaurant\/availability/);

    // The sidebar marks the page with unsaved edits in text, not just a dot.
    await expect(
      page.getByRole('link', { name: /^Availability/ }).getByText('Unsaved'),
    ).toBeVisible();

    await expectDirtyNavigationBlocked(page, () =>
      page
        .getByRole('navigation', { name: 'Breadcrumb' })
        .getByRole('link', { name: 'Settings' })
        .click(),
    );
    await expect(page).toHaveURL(/\/settings\/restaurant\/availability/);

    await expectDirtyNavigationBlocked(page, () =>
      page.getByRole('link', { name: 'Close restaurant settings' }).click(),
    );
    await expect(page).toHaveURL(/\/settings\/restaurant\/availability/);
  });
});
