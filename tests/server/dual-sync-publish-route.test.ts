import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const runPublishMock = vi.hoisted(() => vi.fn());
const defaultDualSyncPortsMock = vi.hoisted(() => vi.fn());
const createDurableDualSyncGoogleEditThrottleMock = vi.hoisted(() => vi.fn());
const enqueueDualSyncJobMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const isDualSyncRestaurantPausedErrorMock = vi.hoisted(() => vi.fn());
const confirmExactConsentAndIssueMock = vi.hoisted(() => vi.fn());
const buildSupportedExactConsentPlanMock = vi.hoisted(() => vi.fn());
const readSupportedExactConsentEligibilityMock = vi.hoisted(() => vi.fn());
const readSupportedGoogleUpdatesMock = vi.hoisted(() => vi.fn());
const withExactConsentListingLockMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator', () => ({
  runPublish: runPublishMock,
}));

vi.mock('@/server/dual-sync/publish/ports', () => ({
  defaultDualSyncPorts: defaultDualSyncPortsMock,
}));

vi.mock('@/server/dual-sync/publish/google-safety', () => ({
  createDurableDualSyncGoogleEditThrottle: createDurableDualSyncGoogleEditThrottleMock,
}));

vi.mock('@/server/dual-sync/queue', () => ({
  enqueueDualSyncJob: enqueueDualSyncJobMock,
}));

vi.mock('@/server/dual-sync/controls', () => ({
  DUAL_SYNC_RESTAURANT_PAUSED_CODE: 'DUAL_SYNC_RESTAURANT_PAUSED',
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
  isDualSyncRestaurantPausedError: isDualSyncRestaurantPausedErrorMock,
}));

vi.mock('@/server/dual-sync/publish/exact-consent', () => ({
  EXACT_CONSENT_VERSION: 'gbp-exact-consent-v1',
  ExactConsentError: class ExactConsentError extends Error {
    readonly status = 409;
    readonly code = 'GBP_PREVIEW_MISMATCH';
  },
  ExactConsentUnsupportedPlanError: class ExactConsentUnsupportedPlanError extends Error {
    readonly status = 422;
    readonly code = 'GBP_EXACT_CONSENT_UNSUPPORTED_PLAN';
  },
  buildSupportedExactConsentPlan: buildSupportedExactConsentPlanMock,
  confirmExactConsentAndIssue: confirmExactConsentAndIssueMock,
  readSupportedExactConsentEligibility: readSupportedExactConsentEligibilityMock,
  readSupportedGoogleUpdates: readSupportedGoogleUpdatesMock,
  withExactConsentListingLock: withExactConsentListingLockMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
    child: () => ({ error: loggerErrorMock, child: vi.fn() }),
  },
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish/route';

const serviceClient = { from: vi.fn() };
const ports = {
  applyImportToCore: vi.fn(),
  applyExportToGoogle: vi.fn(),
};
const googleEditThrottle = {
  reserve: vi.fn(),
};
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function exactPreview() {
  const issuedAt = new Date(Date.now() + 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const displays = {
    core: { 'profile.businessDescription': 'Core' },
    google: { 'profile.businessDescription': 'Google' },
  };
  const hashes = {
    core: { 'profile.businessDescription': SHA_A },
    google: { 'profile.businessDescription': SHA_B },
  };
  return {
    confirmationVersion: 'gbp-exact-consent-v1' as const,
    policyVersion: 'gbp-write-policy-v1' as const,
    rendererVersion: 'gbp-renderer-v1' as const,
    listing: {
      restaurantId: 'rest-1',
      externalProfileRowId: 'profile-row-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 1,
      consentEpoch: 1,
    },
    snapshotPins: { core: SHA_A, google: SHA_B },
    groups: [
      {
        groupId: 'profile',
        writeGroup: 'google.location.profile',
        direction: 'export_to_google' as const,
        fieldKeys: ['profile.businessDescription'],
        method: 'PATCH' as const,
        resource: 'locations/location-1',
        updateMasks: ['profile'],
        beforeDisplay: displays,
        afterDisplay: displays,
        beforeHashes: hashes,
        afterHashes: hashes,
        requestHash: SHA_A,
        decisionHash: SHA_B,
        warnings: [],
        riskLevel: 'medium' as const,
        fullReplacement: false,
      },
    ],
    planFingerprint: SHA_A,
    issuedAt,
    expiresAt,
  };
}

describe('dual-sync publish route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    runPublishMock.mockReset();
    defaultDualSyncPortsMock.mockReset();
    createDurableDualSyncGoogleEditThrottleMock.mockReset();
    enqueueDualSyncJobMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockReset();
    isDualSyncRestaurantPausedErrorMock.mockReset();
    confirmExactConsentAndIssueMock.mockReset();
    buildSupportedExactConsentPlanMock.mockReset();
    readSupportedExactConsentEligibilityMock.mockReset();
    readSupportedGoogleUpdatesMock.mockReset();
    withExactConsentListingLockMock.mockReset();
    loggerErrorMock.mockReset();
    googleEditThrottle.reserve.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(undefined);
    isDualSyncRestaurantPausedErrorMock.mockReturnValue(false);
    defaultDualSyncPortsMock.mockReturnValue(ports);
    createDurableDualSyncGoogleEditThrottleMock.mockReturnValue(googleEditThrottle);
    runPublishMock.mockResolvedValue({
      summary: {
        publishJobId: 'job-1',
        restaurantId: 'rest-1',
        totalDecisions: 1,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        operations: [],
        failures: [],
      },
    });
    enqueueDualSyncJobMock.mockResolvedValue({
      id: 'job-1',
      restaurantId: 'rest-1',
      jobKind: 'publish_batch',
      status: 'queued',
    });
    confirmExactConsentAndIssueMock.mockResolvedValue({
      mode: 'immediate',
      bundleId: 'bundle-1',
      grantIds: ['grant-1'],
      outcomes: [{ groupId: 'profile', status: 'consumed', reasonCode: 'provider_succeeded' }],
    });
  });

  it('routes an exact confirmation through the locked atomic permit workflow', async () => {
    const preview = exactPreview();
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({
          confirmationVersion: 'gbp-exact-consent-v1',
          preview,
          acknowledged: true,
          riskAcknowledgements: [
            'external_write',
            'outcome_may_be_unknown',
            'partial_bundle_failure',
          ],
          mode: 'immediate',
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: SHA_A,
              pinnedGbpHash: SHA_B,
            },
          ],
          pinnedCoreSnapshotHash: SHA_A,
          pinnedGbpSnapshotHash: SHA_B,
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(confirmExactConsentAndIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceClient,
        actorUserId: 'user-1',
        mode: 'immediate',
        submittedPreview: preview,
        rebuild: expect.any(Function),
        withListingLock: expect.any(Function),
      }),
    );
    expect(runPublishMock).not.toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Cookie, Authorization');
  });

  it('rejects legacy FoodMenus export decisions before provider execution', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer',
              sectionKey: 'foodMenus',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
          pinnedCoreSnapshotHash: 'core-snapshot-hash',
          pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'GBP_EXACT_CONSENT_REQUIRED' });
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('does not enqueue a legacy Google export without atomic grants', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish?queue=1', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
          clientRequestId: 'request-1',
          pinnedCoreSnapshotHash: 'core-snapshot-hash',
          pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    expect(runPublishMock).not.toHaveBeenCalled();
    expect(defaultDualSyncPortsMock).not.toHaveBeenCalled();
    expect(createDurableDualSyncGoogleEditThrottleMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: 'GBP_EXACT_CONSENT_REQUIRED' });
  });

  it('rejects decisions that omit field-level pins', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(422);
    expect(runPublishMock).not.toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
  });

  it('returns 409 when another dual-sync write job holds the restaurant lock', async () => {
    runPublishMock.mockRejectedValueOnce({
      code: 'DUAL_SYNC_LOCK_HELD',
      message: 'Dual-sync is already running for restaurant rest-1.',
      activeLock: { id: 'lock-1', jobKind: 'google_refresh_manual' },
    });

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'import_from_google',
              pinnedCoreHash: null,
              pinnedGbpHash: null,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_LOCK_HELD',
      message: 'Another Google synchronization job is active.',
    });
  });

  it('returns 409 without queuing or publishing when restaurant sync is paused', async () => {
    const pausedError = Object.assign(new Error('Maintenance window.'), {
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
    });
    assertDualSyncRestaurantNotPausedMock.mockRejectedValueOnce(pausedError);
    isDualSyncRestaurantPausedErrorMock.mockImplementation((error) => error === pausedError);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish?queue=1', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'export_to_google',
              pinnedCoreHash: 'core-hash',
              pinnedGbpHash: 'gbp-hash',
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    expect(runPublishMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      message: 'Google synchronization is paused.',
    });
  });

  it('does not reflect or log raw internal publish errors', async () => {
    const secret = 'Bearer private-token https://provider.test/write?token=abc person@example.test';
    runPublishMock.mockRejectedValueOnce(new Error(secret));
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({
          decisions: [
            {
              fieldKey: 'profile.businessDescription',
              sectionKey: 'profile',
              action: 'import_from_google',
              pinnedCoreHash: null,
              pinnedGbpHash: null,
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({
      code: 'GBP_PUBLISH_FAILED',
      message: 'The exact Google write could not be completed.',
    });
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(loggerErrorMock).toHaveBeenCalledWith('Exact Google write failed.', {
      restaurantId: 'rest-1',
      failureKind: 'GBP_PUBLISH_FAILED',
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(secret);
  });

  it('preserves restaurant access checks before parsing or publishing', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(assertDualSyncRestaurantNotPausedMock).not.toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    expect(defaultDualSyncPortsMock).not.toHaveBeenCalled();
    expect(createDurableDualSyncGoogleEditThrottleMock).not.toHaveBeenCalled();
    expect(runPublishMock).not.toHaveBeenCalled();
  });

  it('preserves restaurant access checks before parsing or queuing', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish?queue=1', {
        method: 'POST',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(assertDualSyncRestaurantNotPausedMock).not.toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    expect(runPublishMock).not.toHaveBeenCalled();
  });
});
