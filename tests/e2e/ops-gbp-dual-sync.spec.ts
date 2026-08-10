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

const gbpOperatorState = {
  version: 'v1',
  restaurantId,
  provider: 'google_business_profile',
  connectionStatus: 'linked',
  writeState: 'eligible',
  connectionGeneration: 3,
  consentEpoch: 4,
  reasonCode: 'operator_enabled',
  rollout: {
    eligible: true,
    cohort: 'pilot',
    evaluatedAt: '2026-08-09T12:00:00.000Z',
  },
  pendingUpdates: {
    version: 'v1',
    restaurantId,
    state: 'known',
    locationMasks: ['phoneNumbers'],
    attributePaths: ['attributes/wheelchair_accessible'],
    observedAt: '2026-08-09T12:00:00.000Z',
    expiresAt: '2026-09-06T12:00:00.000Z',
  },
  notifications: { enabled: true, refCount: 2 },
  refresh: {
    status: 'succeeded',
    lastAttemptAt: '2026-08-09T12:00:00.000Z',
    lastSucceededAt: '2026-08-09T12:00:00.000Z',
    safeErrorCode: null,
  },
};

const terminalNotices = {
  notices: [
    {
      id: 'notice_1',
      grant_id: 'grant_1',
      event_id: 'event_1',
      terminal_kind: 'outcome_unknown',
      safe_reason_code: 'provider_outcome_unknown',
      requires_fresh_preview: true,
      status: 'outcome_unknown',
      terminal_at: '2026-08-09T12:00:00.000Z',
      due_at: '2026-08-09T12:01:00.000Z',
      dispatched_at: '2026-08-09T12:00:00.000Z',
      outcome_unknown_at: '2026-08-09T12:00:30.000Z',
      delivered_at: null,
      failed_at: null,
      last_error_code: 'delivery_outcome_unknown',
      created_at: '2026-08-09T12:00:00.000Z',
      providerInstruction: 'refresh_then_create_new_preview',
      operationalDeliveryInstruction: 'in_app_notice_available_verify_operational_channel',
    },
  ],
  census: {
    pending_count: 0,
    overdue_count: 0,
    claimed_count: 0,
    dispatched_count: 0,
    outcome_unknown_count: 1,
    delivered_count: 0,
    failed_count: 0,
    oldest_pending_at: null,
  },
  asOf: '2026-08-09T12:02:00.000Z',
};

const availableLocation = {
  accountName: 'accounts/2',
  accountId: '2',
  accountDisplayName: 'QA Google Group',
  locationName: 'locations/2',
  locationId: '2',
  title: 'QA GBP Restaurant - Cambridge',
  addressText: '2 QA Street, Cambridge',
  placeId: 'places/qa-cambridge',
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

function exactPreview() {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 15 * 60_000);
  const coreHash = 'a'.repeat(64);
  const googleHash = 'b'.repeat(64);
  return {
    confirmationVersion: 'gbp-exact-consent-v1',
    policyVersion: 'gbp-write-policy-v1',
    rendererVersion: 'gbp-renderer-v1',
    listing: {
      restaurantId,
      externalProfileRowId: 'profile_row_1',
      accountId: 'account_1',
      profileId: 'profile_1',
      locationId: 'location_1',
      connectionGeneration: 3,
      consentEpoch: 4,
    },
    snapshotPins: { core: coreHash, google: googleHash },
    groups: [
      {
        groupId: 'group_profile_phone',
        writeGroup: 'location.profile',
        direction: 'export_to_google',
        fieldKeys: ['profile.phone'],
        method: 'PATCH',
        resource: 'locations/location_1',
        updateMasks: ['phoneNumbers'],
        beforeDisplay: {
          core: { 'profile.phone': '+44 1223 000000' },
          google: { 'profile.phone': '+44 1223 111111' },
        },
        afterDisplay: {
          core: { 'profile.phone': '+44 1223 000000' },
          google: { 'profile.phone': '+44 1223 000000' },
        },
        beforeHashes: {
          core: { 'profile.phone': coreHash },
          google: { 'profile.phone': googleHash },
        },
        afterHashes: {
          core: { 'profile.phone': coreHash },
          google: { 'profile.phone': coreHash },
        },
        requestHash: 'c'.repeat(64),
        decisionHash: 'd'.repeat(64),
        warnings: ['Profile phone updates public Google Business Profile data.'],
        riskLevel: 'critical',
        fullReplacement: false,
      },
      {
        groupId: 'group_food_menus',
        writeGroup: 'foodMenus',
        direction: 'export_to_google',
        fieldKeys: ['foodMenus.menu'],
        method: 'PATCH',
        resource: 'accounts/account_1/locations/location_1/foodMenus',
        updateMasks: ['menus'],
        beforeDisplay: {
          core: { 'foodMenus.menu': 'Dinner menu v2' },
          google: { 'foodMenus.menu': 'Dinner menu v1' },
        },
        afterDisplay: {
          core: { 'foodMenus.menu': 'Dinner menu v2' },
          google: { 'foodMenus.menu': 'Dinner menu v2' },
        },
        beforeHashes: {
          core: { 'foodMenus.menu': coreHash },
          google: { 'foodMenus.menu': googleHash },
        },
        afterHashes: {
          core: { 'foodMenus.menu': coreHash },
          google: { 'foodMenus.menu': coreHash },
        },
        requestHash: 'f'.repeat(64),
        decisionHash: '1'.repeat(64),
        warnings: ['This replaces the complete Google FoodMenus resource.'],
        riskLevel: 'critical',
        fullReplacement: true,
      },
    ],
    planFingerprint: 'e'.repeat(64),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

async function waitForSettled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

async function navigateToGbpSettings(page: Page) {
  const connectionResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/details`
    );
  });

  await page.goto('/settings/restaurant/google-business-profile', {
    waitUntil: 'domcontentloaded',
  });
  await connectionResponse;
  await waitForSettled(page);
}

async function assertNextDevToolsAbsent(page: Page) {
  await waitForSettled(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const matches: string[] = [];
          const visit = (root: Document | ShadowRoot) => {
            root.querySelectorAll('*').forEach((element) => {
              const tagName = element.tagName.toLowerCase();
              const text = element.textContent?.trim() ?? '';
              if (/^(Rendering|Compiling)(?:\.{3}|…)?$/.test(text)) matches.push(text);
              if (
                tagName.startsWith('nextjs-') ||
                /next(?:\.js)? dev tools/i.test(element.getAttribute('aria-label') ?? '') ||
                /next(?:\.js)? dev tools/i.test(element.getAttribute('title') ?? '')
              ) {
                matches.push(tagName);
              }
              if (element.shadowRoot) visit(element.shadowRoot);
            });
          };
          visit(document);
          return matches;
        }),
      { timeout: 15_000 },
    )
    .toEqual([]);
}

async function prepareEvidenceCapture(page: Page) {
  await waitForSettled(page);
  const removedTags = await page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('nextjs-portal'));
    portals.forEach((portal) => portal.remove());
    return portals.map((portal) => portal.tagName.toLowerCase());
  });
  expect(removedTags.every((tagName) => tagName === 'nextjs-portal')).toBe(true);
  await assertNextDevToolsAbsent(page);
}

const shouldCaptureEvidence = process.env.GBP_CAPTURE_EVIDENCE === '1';

async function captureEvidenceScreenshot(
  page: Page,
  options: { path: string; fullPage?: boolean },
) {
  if (!shouldCaptureEvidence) return;
  await prepareEvidenceCapture(page);
  await page.screenshot(options);
}

const captureWidths = [375, 768, 1280] as const;

async function captureState(
  page: Page,
  state: 'main-linked' | 'exact-confirmation' | 'outcome-unknown',
  heights: Record<(typeof captureWidths)[number], number>,
) {
  for (const width of captureWidths) {
    await page.setViewportSize({ width, height: heights[width] });
    await captureEvidenceScreenshot(page, {
      path: `.omo/evidence/gbp-wave3-${state}-${width}.png`,
      fullPage: true,
    });
  }
}

type GbpApiMockOptions = {
  connection?: typeof googleBusinessProfileConnection;
  locations?: (typeof availableLocation)[];
  dualSync?: typeof dualSyncState;
  operatorState?: typeof gbpOperatorState;
};

async function installGbpApiMocks(page: Page, options: GbpApiMockOptions = {}) {
  const connection = options.connection ?? googleBusinessProfileConnection;
  const locations = options.locations ?? [];
  const state = options.dualSync ?? dualSyncState;
  let operatorState = options.operatorState ?? gbpOperatorState;
  let previewRequests = 0;
  let publishRequests = 0;
  const disconnectRequests: unknown[] = [];

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

    if (
      pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/details` &&
      route.request().method() === 'GET'
    ) {
      await route.fulfill({ json: connection });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile`) {
      if (route.request().method() === 'DELETE') {
        disconnectRequests.push(route.request().postDataJSON());
        await route.fulfill({
          json: {
            ...connection,
            status: 'unlinked',
            externalAccountId: null,
            externalAccountName: null,
            externalLocationId: null,
            externalLocationName: null,
            externalLocationTitle: null,
          },
        });
        return;
      }

      await route.fulfill({ json: operatorState });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/write-access`) {
      const request = route.request().postDataJSON() as { eligible: boolean };
      operatorState = {
        ...operatorState,
        writeState: request.eligible ? 'eligible' : 'blocked',
        reasonCode: request.eligible ? 'operator_enabled' : 'operator_disabled',
      };
      await route.fulfill({ json: operatorState });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/notifications`) {
      if (route.request().method() === 'PUT') {
        const request = route.request().postDataJSON() as { enabled: boolean };
        operatorState = {
          ...operatorState,
          notifications: { enabled: request.enabled, refCount: request.enabled ? 2 : 1 },
        };
        await route.fulfill({ json: operatorState.notifications });
        return;
      }
      await route.fulfill({ json: terminalNotices });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/google-business-profile/locations`) {
      await route.fulfill({ json: { locations } });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/state`) {
      await route.fulfill({ json: state });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/publish/preview`) {
      previewRequests += 1;
      await route.fulfill({ json: exactPreview() });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}/dual-sync/publish`) {
      publishRequests += 1;
      await route.fulfill({
        json: {
          mode: 'immediate',
          bundleId: 'bundle_1',
          grantIds: ['grant_1'],
          outcomes: [
            {
              groupId: 'group_profile_phone',
              status: 'outcome_unknown',
              reasonCode: 'provider_outcome_unknown',
            },
          ],
        },
      });
      return;
    }

    await route.fulfill({ json: {} });
  });

  return {
    getPreviewRequests: () => previewRequests,
    getPublishRequests: () => publishRequests,
    getDisconnectRequests: () => disconnectRequests,
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

  test('google business profile route loads operator review, exact confirmation, and outcome recovery @p1 @browser @contract @external-mock @local-only', async ({
    page,
  }) => {
    const requests = await installGbpApiMocks(page);

    await navigateToGbpSettings(page);

    await expect(page).toHaveURL(
      /app\.localhost:\d+\/settings\/restaurant\/google-business-profile/,
    );
    await expect(page.locator('main').getByText('Google command center')).toBeVisible();
    await expect(
      page.getByTestId('gbp-overview-card').getByText('Linked', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId('gbp-overview-card').getByText('Location mapped', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('main').getByText('Review changes below')).toBeVisible();
    await expect(page.locator('main').getByText('Google workflow')).toBeVisible();
    await expect(
      page.locator('#gbp-sync-review').getByText('Google Business Profile sync'),
    ).toBeVisible();
    await expect(
      page.locator('#gbp-sync-review').getByRole('button', { name: /^Profile\b/ }),
    ).toBeVisible();
    await expect(page.locator('#gbp-sync-review').getByText('Phone number')).toBeVisible();
    await expect(page.getByTestId('gbp-operator-controls')).toBeVisible();
    await expect(page.getByTestId('gbp-operator-controls').getByText('Generation 3')).toBeVisible();
    await expect(
      page.getByTestId('gbp-operator-controls').getByText('Consent epoch 4'),
    ).toBeVisible();
    await expect(page.getByTestId('gbp-operator-controls').getByText('phoneNumbers')).toBeVisible();
    await expect(
      page.getByTestId('gbp-operator-controls').getByText('attributes/wheelchair_accessible'),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('gbp-operator-controls')
        .getByText(/refresh google, then create a new preview/i),
    ).toBeVisible();
    await expect(
      page
        .getByTestId('gbp-operator-controls')
        .getByText(/verify the operational notification channel/i),
    ).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    const settingsHeader = page.locator('header').filter({
      has: page.getByRole('link', { name: 'Close restaurant settings' }),
    });
    const mobileTitle = settingsHeader.getByRole('heading', {
      name: 'Google Business Profile',
      level: 1,
    });
    const reviewStatus = settingsHeader.locator('a[href$="#gbp-sync-review"]');
    await expect(mobileTitle).toBeVisible();
    await expect(reviewStatus).toBeVisible();
    await expect(settingsHeader.getByText('QA App Host Restaurant')).toBeHidden();
    const mobileTitleBox = await mobileTitle.boundingBox();
    const reviewStatusBox = await reviewStatus.boundingBox();
    expect(mobileTitleBox?.width).toBeGreaterThan(96);
    expect(reviewStatusBox?.width).toBeLessThanOrEqual(112);
    expect((mobileTitleBox?.x ?? 0) + (mobileTitleBox?.width ?? 0)).toBeLessThanOrEqual(
      reviewStatusBox?.x ?? 0,
    );
    const workflowNav = page.getByRole('navigation', { name: 'Google workflow' });
    const reviewWorkflowStep = workflowNav.getByRole('button', { name: /Review changes/ });
    await expect(reviewWorkflowStep).toBeVisible();
    const reviewWorkflowBox = await reviewWorkflowStep.boundingBox();
    expect(reviewWorkflowBox?.x).toBeGreaterThanOrEqual(0);
    expect((reviewWorkflowBox?.x ?? 0) + (reviewWorkflowBox?.width ?? 0)).toBeLessThanOrEqual(375);

    const operatorControls = page.getByTestId('gbp-operator-controls');
    for (const width of captureWidths) {
      const height = width === 1280 ? 1000 : 1400;
      await page.setViewportSize({ width, height });
      await operatorControls.scrollIntoViewIfNeeded();
      const operatorBox = await operatorControls.boundingBox();
      expect(operatorBox?.y).toBeGreaterThanOrEqual(0);
      expect((operatorBox?.y ?? 0) + (operatorBox?.height ?? 0)).toBeLessThanOrEqual(height);
      await captureEvidenceScreenshot(page, {
        path: `.omo/evidence/gbp-wave3-main-linked-${width}.png`,
        fullPage: true,
      });
    }

    await page.locator('#gbp-sync-review').getByRole('radio', { name: 'Send to Google' }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    const publishTrigger = page.getByRole('button', { name: 'Review and publish (1)' });
    await publishTrigger.click();

    const previewDialog = page.getByRole('dialog');
    const previewTitle = previewDialog.getByRole('heading', {
      name: 'Confirm exact Google publish',
    });
    await expect(previewTitle).toBeVisible();
    await expect(previewTitle).toBeFocused();
    await expect(page.getByRole('dialog').getByText('location_1', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('valid for at most 15 minutes')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('phoneNumbers')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByText('Before Google · foodMenus.menu'),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog').getByText(/fully replace google foodmenus/i),
    ).toBeVisible();
    expect(requests.getPreviewRequests()).toBe(1);
    expect(requests.getPublishRequests()).toBe(0);

    const initialScroll = await previewDialog.evaluate((element) => ({
      top: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(initialScroll.top).toBe(0);
    expect(initialScroll.scrollHeight).toBeGreaterThan(initialScroll.clientHeight);
    await previewDialog.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const settledPreviewBox = await previewDialog.boundingBox();
    expect(settledPreviewBox?.x).toBeGreaterThanOrEqual(0);
    expect((settledPreviewBox?.x ?? 0) + (settledPreviewBox?.width ?? 0)).toBeLessThanOrEqual(375);
    expect(settledPreviewBox?.y).toBeGreaterThanOrEqual(0);
    expect((settledPreviewBox?.y ?? 0) + (settledPreviewBox?.height ?? 0)).toBeLessThanOrEqual(812);
    const settledTitleBox = await previewTitle.boundingBox();
    const settledCloseBox = await previewDialog
      .getByRole('button', { name: 'Close' })
      .boundingBox();
    expect((settledTitleBox?.x ?? 0) + (settledTitleBox?.width ?? 0)).toBeLessThanOrEqual(
      settledCloseBox?.x ?? 0,
    );
    await captureEvidenceScreenshot(page, {
      path: '.omo/evidence/gbp-wave3-exact-confirmation-375-initial.png',
    });

    await page.keyboard.press('Tab');
    await expect(
      previewDialog.getByLabel(/changes public google business profile data/i),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(previewDialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      previewDialog.getByLabel(/changes public google business profile data/i),
    ).toBeFocused();
    await previewDialog.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(previewDialog.getByLabel(/fully replace google foodmenus/i)).toBeInViewport();
    await expect(
      previewDialog.getByRole('button', { name: 'Publish exact plan' }),
    ).toBeInViewport();
    await captureEvidenceScreenshot(page, {
      path: '.omo/evidence/gbp-wave3-exact-confirmation-375-scrolled.png',
    });

    await page.keyboard.press('Escape');
    await expect(previewDialog).toBeHidden();
    await expect(publishTrigger).toBeFocused();
    await publishTrigger.press('Enter');
    await expect(previewTitle).toBeFocused();
    expect(requests.getPreviewRequests()).toBe(2);

    await page.setViewportSize({ width: 375, height: 2600 });
    await expect(
      page.getByRole('dialog').getByText('valid for at most 15 minutes'),
    ).toBeInViewport();
    await expect(
      page.getByRole('dialog').getByLabel(/fully replace google foodmenus/i),
    ).toBeInViewport();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Publish exact plan' }),
    ).toBeInViewport();

    await captureState(page, 'exact-confirmation', {
      375: 2600,
      768: 1600,
      1280: 1200,
    });
    await previewDialog.getByLabel(/changes public google business profile data/i).click();
    await previewDialog.getByLabel(/fully replace google foodmenus/i).click();
    await previewDialog.getByRole('button', { name: 'Publish exact plan' }).click();

    const resultDialog = page.getByRole('dialog');
    await expect(resultDialog.getByText('Google publish outcome')).toBeVisible();
    await expect(resultDialog.getByText('Provider outcome unknown')).toBeVisible();
    await expect(
      resultDialog.getByText(/refresh google state, verify the listing, and create a new preview/i),
    ).toBeVisible();
    await expect(
      resultDialog.getByText(/verify the operational notification channel/i),
    ).toBeVisible();
    expect(requests.getPreviewRequests()).toBe(2);
    expect(requests.getPublishRequests()).toBe(1);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 });

    await page.setViewportSize({ width: 375, height: 900 });
    const resultClose = resultDialog.getByRole('button', { name: 'Close' });
    const resultDescription = resultDialog.getByText(/queued is not complete/i);
    const resultCloseBox = await resultClose.boundingBox();
    const resultDescriptionTextBox = await resultDescription.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rectangle = range.getBoundingClientRect();
      return { right: rectangle.right };
    });
    expect(resultDescriptionTextBox.right).toBeLessThanOrEqual(resultCloseBox?.x ?? 0);

    await captureState(page, 'outcome-unknown', {
      375: 900,
      768: 900,
      1280: 940,
    });
  });

  test('google business profile route shows disconnected and unconfigured states @p1 @browser @contract @external-mock @local-only', async ({
    page,
  }) => {
    await installGbpApiMocks(page, {
      connection: {
        ...googleBusinessProfileConnection,
        isConfigured: false,
        status: 'unlinked',
        connectedGoogleEmail: null,
        connectedGoogleName: null,
        externalAccountId: null,
        externalAccountName: null,
        externalLocationId: null,
        externalLocationName: null,
        externalLocationTitle: null,
        externalPlaceId: null,
        availableLocations: [],
      },
    });

    await navigateToGbpSettings(page);

    await expect(
      page.getByTestId('gbp-overview-card').getByText('Not connected', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId('gbp-overview-card').getByText('No location mapped', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByText('Google Business Profile credentials are not configured'),
    ).toBeVisible();
    await expect(
      page.locator('main').getByRole('button', { name: 'Connect Google Business Profile' }),
    ).toBeDisabled();
  });

  test('google business profile route shows connect state without publish controls @p1 @browser @contract @external-mock @local-only', async ({
    page,
  }) => {
    await installGbpApiMocks(page, {
      connection: {
        ...googleBusinessProfileConnection,
        status: 'unlinked',
        connectedGoogleEmail: null,
        connectedGoogleName: null,
        externalAccountId: null,
        externalAccountName: null,
        externalLocationId: null,
        externalLocationName: null,
        externalLocationTitle: null,
        externalPlaceId: null,
        availableLocations: [],
      },
    });

    await navigateToGbpSettings(page);

    await expect(
      page.getByTestId('gbp-overview-card').getByText('Not connected', { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByRole('button', { name: 'Connect Google Business Profile' }),
    ).toBeEnabled();
  });

  test('google business profile route shows the location picker before linking @p1 @browser @contract @external-mock @local-only', async ({
    page,
  }) => {
    await installGbpApiMocks(page, {
      connection: {
        ...googleBusinessProfileConnection,
        status: 'authorized',
        externalAccountId: null,
        externalAccountName: null,
        externalLocationId: null,
        externalLocationName: null,
        externalLocationTitle: null,
        externalPlaceId: null,
        availableLocations: [],
      },
      locations: [availableLocation],
    });

    await navigateToGbpSettings(page);

    await expect(
      page.getByTestId('gbp-overview-card').getByText('Choose location', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator('main').getByText('Available locations')).toBeVisible();
    await expect(
      page.locator('main').getByText('QA GBP Restaurant - Cambridge').first(),
    ).toBeVisible();
    await expect(page.locator('main').getByText('2 QA Street, Cambridge')).toBeVisible();
    await expect(page.locator('main').getByRole('button', { name: 'Link location' })).toBeVisible();
  });

  test('google business profile disconnect requires password on the shipped route @p1 @browser @contract @external-mock @local-only', async ({
    page,
  }) => {
    const requests = await installGbpApiMocks(page);

    await navigateToGbpSettings(page);

    await page.locator('main').getByTestId('gbp-disconnect-button').click();
    const dialog = page.getByTestId('gbp-disconnect-dialog');

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Disconnect$/ })).toBeDisabled();

    await dialog.getByLabel(/confirm with your password/i).fill('secret-password');
    await dialog.getByRole('button', { name: /^Disconnect$/ }).click();

    await expect(dialog).toBeHidden();
    expect(requests.getDisconnectRequests()).toEqual([{ password: 'secret-password' }]);
  });
});
