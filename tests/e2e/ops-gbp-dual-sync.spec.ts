import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';

const restaurant = {
  id: restaurantId,
  name: 'QA GBP Restaurant',
  slug: 'qa-gbp',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.gbp@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  businessDescription: 'Local QA fixture restaurant for GBP browser proof.',
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

const emptyBusinessInfo = {
  details: {
    businessName: 'QA GBP Restaurant',
    description: 'Fixture listing description',
    languageCode: 'en',
    openingDate: null,
    businessStatus: 'OPEN',
    isServiceAreaBusiness: false,
    canReopen: null,
    source: 'gbp',
    managedBy: 'gbp',
    lastSyncedAt: '2026-05-16T09:00:00.000Z',
  },
  addresses: [],
  phoneNumbers: [],
  links: [],
  categories: [],
  serviceAreas: [],
  hours: [],
  attributes: [],
  serviceItems: [],
  coreNormalization: {
    operatingHours: {
      source: 'gbp',
      matchStatus: 'matched',
      summary: 'Google hours match Nabatable hours.',
      warnings: [],
      weekly: [],
      overrides: [],
    },
    servicePeriods: {
      source: 'gbp',
      matchStatus: 'matched',
      summary: 'Google meal windows match Nabatable services.',
      warnings: [],
      periods: [],
    },
    bookingHours: {
      matchStatus: 'matched',
      summary: 'Booking hours are aligned.',
      warnings: [],
      missingInputs: [],
    },
  },
};

const googleBusinessProfileConnection = {
  isConfigured: true,
  provider: 'google_business_profile',
  status: 'linked',
  pushEnabled: true,
  connectedGoogleEmail: 'ops@example.test',
  connectedGoogleName: 'QA Ops',
  externalAccountId: 'account-1',
  externalAccountName: 'accounts/1',
  externalLocationId: 'location-1',
  externalLocationName: 'locations/1',
  externalLocationTitle: 'QA GBP Restaurant',
  externalPlaceId: 'places/qa-gbp',
  providerTimezone: 'Europe/London',
  lastPullAt: '2026-05-16T09:00:00.000Z',
  lastPushAt: null,
  lastError: null,
  availableLocations: [],
  businessInfo: emptyBusinessInfo,
};

const dualSyncField = {
  fieldKey: 'profile.phone',
  sectionKey: 'profile',
  kind: 'profile',
  label: 'Phone number',
  helpText: 'Keep public contact details aligned before publishing to Google.',
  conflictPolicy: 'manual',
  deletePolicy: 'manual',
  policy: {
    fieldKey: 'profile.phone',
    sectionKey: 'profile',
    authority: 'bidirectional_manual',
    riskLevel: 'critical',
    importable: true,
    exportable: true,
    requiresManualReview: true,
    googleWriteGroup: 'location.profile',
    semanticComparator: 'phone',
    canonicalizer: 'canonicalizePhone',
    destructiveWritePossible: false,
  },
  importable: true,
  exportable: true,
  sortOrder: 0,
  coreValue: '+44 1223 000000',
  gbpValue: '+44 1223 111111',
  coreCanonicalHash: 'core-phone-hash',
  gbpCanonicalHash: 'gbp-phone-hash',
  capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
  state: 'core_dirty',
  lastInSyncAt: null,
  lastCoreChangeAt: '2026-05-16T09:10:00.000Z',
  lastGbpChangeAt: null,
  openCandidate: null,
};

const dualSyncState = {
  restaurantId,
  coreSnapshot: {},
  gbpSnapshot: {},
  coreSnapshotHash: 'state-core-hash',
  gbpSnapshotHash: 'state-gbp-hash',
  fields: [dualSyncField],
  outboundQueue: {
    totalOpen: 0,
    autoExportable: 0,
    missingBaseline: 0,
    lastQueuedAt: null,
  },
  lastSnapshot: {
    runId: 'snapshot-run-1',
    runKind: 'manual',
    startedAt: '2026-05-16T09:00:00.000Z',
    finishedAt: '2026-05-16T09:00:01.000Z',
  },
  control: {
    restaurantId,
    provider: 'google_business_profile',
    syncPaused: false,
    pauseReason: null,
    pausedByUserId: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: null,
    updatedAt: null,
  },
};

const previewPlan = {
  restaurantId,
  coreSnapshotHash: 'plan-core-hash',
  gbpSnapshotHash: 'plan-gbp-hash',
  acceptedCount: 1,
  rejectedCount: 0,
  ignoredCount: 0,
  groups: [
    {
      groupId: 'export_to_google:profile:location.profile',
      direction: 'export_to_google',
      sectionKey: 'profile',
      writeGroup: 'location.profile',
      fields: [
        {
          fieldKey: 'profile.phone',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: 'core-phone-hash',
          pinnedGbpHash: 'gbp-phone-hash',
        },
      ],
      riskLevel: 'critical',
      requiresPreflight: true,
      requiresManualConfirmation: true,
      destructiveWritePossible: false,
      googleUpdateMasks: ['phoneNumbers'],
    },
  ],
  rejected: [],
  warnings: [
    {
      code: 'HIGH_RISK',
      groupId: 'export_to_google:profile:location.profile',
      message: 'Profile phone updates public Google Business Profile data.',
    },
  ],
};

async function waitForSettled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

async function installGbpApiMocks(page: Page) {
  let previewRequests = 0;
  let publishRequests = 0;

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

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile`) {
      await route.fulfill({ json: googleBusinessProfileConnection });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business/locations`) {
      await route.fulfill({ json: { locations: [] } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/state`) {
      await route.fulfill({ json: dualSyncState });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/publish/preview`) {
      previewRequests += 1;
      await route.fulfill({ json: previewPlan });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/publish`) {
      publishRequests += 1;
      await route.fulfill({
        status: 500,
        json: { error: 'Publish execution must not be reached by this browser smoke.' },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });

  return {
    getPreviewRequests: () => previewRequests,
    getPublishRequests: () => publishRequests,
  };
}

test.describe('ops GBP dual-sync shipped route', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1280, height: 940 } });

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

  test('google business profile route loads sync review and preview without publishing @p2 @browser @contract @dry-run-only @external-mock @local-only', async ({
    page,
  }, testInfo) => {
    const requests = await installGbpApiMocks(page);

    await page.goto('/settings/restaurant/google-business-profile', {
      waitUntil: 'domcontentloaded',
    });
    await waitForSettled(page);

    await expect(page).toHaveURL(
      /app\.localhost:\d+\/settings\/restaurant\/google-business-profile/,
    );
    await expect(page.locator('main').getByText('GBP overview')).toBeVisible();
    await expect(page.locator('main').getByText('Review changes below')).toBeVisible();
    await expect(page.locator('main').getByText('Google workflow')).toBeVisible();
    await expect(
      page.locator('#gbp-sync-review').getByText('Google Business Profile sync'),
    ).toBeVisible();
    await page.getByRole('button', { name: /Profile \(1\)/ }).click();
    await expect(page.locator('#gbp-sync-review').getByText('Phone number')).toBeVisible();

    await page.locator('#gbp-sync-review').getByRole('radio', { name: 'Export to Google' }).click();
    await page.getByRole('button', { name: 'Publish (1)' }).click();

    await expect(page.getByRole('dialog').getByText('Review publish plan')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('High-risk publish review')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('phoneNumbers')).toBeVisible();
    expect(requests.getPreviewRequests()).toBe(1);
    expect(requests.getPublishRequests()).toBe(0);

    await page.screenshot({
      path: testInfo.outputPath('ops-gbp-dual-sync-preview-desktop.png'),
      fullPage: true,
    });
  });
});
