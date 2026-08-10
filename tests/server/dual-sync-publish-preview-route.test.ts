import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const buildPublishPlanMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const buildSupportedExactConsentPlanMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/publish/planner', () => ({
  buildPublishPlan: buildPublishPlanMock,
}));

vi.mock('@/server/dual-sync/publish/exact-consent', () => ({
  buildSupportedExactConsentPlan: buildSupportedExactConsentPlanMock,
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

import { ExactConsentUnsupportedPlanError } from '@/server/dual-sync/publish/exact-consent/adapter';
import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish/preview/route';

const serviceClient = { from: vi.fn() };
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function exactPreview() {
  const issuedAt = new Date(Date.now() + 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
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
        beforeDisplay: {
          core: { 'profile.businessDescription': 'Core before' },
          google: { 'profile.businessDescription': 'Google before' },
        },
        afterDisplay: {
          core: { 'profile.businessDescription': 'Core after' },
          google: { 'profile.businessDescription': 'Core after' },
        },
        beforeHashes: {
          core: { 'profile.businessDescription': SHA_A },
          google: { 'profile.businessDescription': SHA_B },
        },
        afterHashes: {
          core: { 'profile.businessDescription': SHA_B },
          google: { 'profile.businessDescription': SHA_A },
        },
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

describe('dual-sync publish preview route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    buildPublishPlanMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    buildSupportedExactConsentPlanMock.mockReset();
    loggerErrorMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    buildPublishPlanMock.mockResolvedValue({
      restaurantId: 'rest-1',
      coreSnapshotHash: 'core-snapshot-hash',
      gbpSnapshotHash: 'gbp-snapshot-hash',
      groups: [],
      rejected: [],
      warnings: [],
      acceptedCount: 0,
      rejectedCount: 0,
      ignoredCount: 0,
    });
    buildSupportedExactConsentPlanMock.mockResolvedValue({
      preview: exactPreview(),
    });
  });

  it('builds a read-only publish plan for valid decisions', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
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
          publishBatchId: 'batch-1',
          pinnedCoreSnapshotHash: 'core-snapshot-hash',
          pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(buildSupportedExactConsentPlanMock).toHaveBeenCalledWith({
      client: serviceClient,
      publish: {
        restaurantId: 'rest-1',
        actorUserId: 'user-1',
        clientRequestId: 'request-1',
        publishBatchId: 'batch-1',
        pinnedCoreSnapshotHash: 'core-snapshot-hash',
        pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        decisions: [
          {
            fieldKey: 'profile.businessDescription',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-hash',
            pinnedGbpHash: 'gbp-hash',
          },
        ],
      },
    });
    expect(buildPublishPlanMock).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Cookie, Authorization');
    await expect(response.clone().json()).resolves.toMatchObject({
      confirmationVersion: 'gbp-exact-consent-v1',
      planFingerprint: SHA_A,
    });
  });

  it('does not advertise an exact preview for an unsupported renderer', async () => {
    buildSupportedExactConsentPlanMock.mockRejectedValueOnce(
      new ExactConsentUnsupportedPlanError('This field group is unsupported.'),
    );
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
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
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(422);
    expect(buildSupportedExactConsentPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceClient,
        publish: expect.objectContaining({ restaurantId: 'rest-1' }),
      }),
    );
  });

  it('preserves restaurant access checks before parsing or planning', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
        method: 'POST',
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(buildPublishPlanMock).not.toHaveBeenCalled();
  });

  it('rejects decisions that omit field-level pins', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
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
    expect(buildPublishPlanMock).not.toHaveBeenCalled();
  });

  it('returns frontend-readable request errors', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
        method: 'POST',
        body: JSON.stringify({ decisions: [] }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Invalid request',
      error: 'Invalid request',
      code: 'DUAL_SYNC_INVALID_REQUEST',
    });
    expect(buildPublishPlanMock).not.toHaveBeenCalled();
  });

  it('returns a stable safe error without reflecting internal preview details', async () => {
    const secret = 'Bearer token-secret https://provider.test/path?token=abc guest@example.test';
    buildSupportedExactConsentPlanMock.mockRejectedValue(new Error(secret));

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
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

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({
      message: 'The exact Google write preview could not be built.',
      error: 'The exact Google write preview could not be built.',
      code: 'GBP_PREVIEW_FAILED',
    });
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(loggerErrorMock).toHaveBeenCalledWith('Exact Google write preview failed.', {
      restaurantId: 'rest-1',
      failureKind: 'GBP_PREVIEW_FAILED',
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(secret);
  });
});
