import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getDualSyncRuntimeControlsMock = vi.hoisted(() => vi.fn());
const getDualSyncDecisionDisabledReasonMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const readNabatableSnapshotMock = vi.hoisted(() => vi.fn());
const readGoogleSnapshotMock = vi.hoisted(() => vi.fn());
const listFieldStatesMock = vi.hoisted(() => vi.fn());
const listOpenOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const readLatestSucceededRunMock = vi.hoisted(() => vi.fn());
const buildRegistryMock = vi.hoisted(() => vi.fn());
const resolveFieldCapabilityMock = vi.hoisted(() => vi.fn());
const hashCanonicalJsonMock = vi.hoisted(() => vi.fn());
const refreshFromGoogleMock = vi.hoisted(() => vi.fn());
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());
const enqueueDualSyncJobMock = vi.hoisted(() => vi.fn());
const getDualSyncRestaurantControlMock = vi.hoisted(() => vi.fn());
const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const isDualSyncRestaurantPausedErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/runtime-controls', () => ({
  getDualSyncRuntimeControls: getDualSyncRuntimeControlsMock,
  getDualSyncDecisionDisabledReason: getDualSyncDecisionDisabledReasonMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/dual-sync/snapshots/nabatable', () => ({
  readNabatableSnapshot: readNabatableSnapshotMock,
}));

vi.mock('@/server/dual-sync/snapshots/google', () => ({
  readGoogleSnapshot: readGoogleSnapshotMock,
}));

vi.mock('@/server/dual-sync/state/read', () => ({
  listFieldStates: listFieldStatesMock,
}));

vi.mock('@/server/dual-sync/outbound/candidates', () => ({
  listOpenOutboundCandidates: listOpenOutboundCandidatesMock,
}));

vi.mock('@/server/dual-sync/snapshots/runs', () => ({
  readLatestSucceededRun: readLatestSucceededRunMock,
}));

vi.mock('@/server/dual-sync/registry', () => ({
  buildRegistry: buildRegistryMock,
  resolveFieldCapability: resolveFieldCapabilityMock,
}));

vi.mock('@/server/dual-sync/hashing', () => ({
  hashCanonicalJson: hashCanonicalJsonMock,
}));

vi.mock('@/server/dual-sync/refresh', () => ({
  refreshFromGoogle: refreshFromGoogleMock,
}));

vi.mock('@/server/dual-sync/queue', () => ({
  enqueueDualSyncJob: enqueueDualSyncJobMock,
}));

vi.mock('@/server/dual-sync/controls', () => ({
  DUAL_SYNC_RESTAURANT_PAUSED_CODE: 'DUAL_SYNC_RESTAURANT_PAUSED',
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
  getDualSyncRestaurantControl: getDualSyncRestaurantControlMock,
  isDualSyncRestaurantPausedError: isDualSyncRestaurantPausedErrorMock,
}));

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));

import { POST as refreshPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/refresh/route';
import { GET as stateGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/state/route';

const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };
const serviceClient = { from: vi.fn() };

describe('dual-sync state and refresh routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    getDualSyncRuntimeControlsMock.mockReset();
    getDualSyncDecisionDisabledReasonMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    readNabatableSnapshotMock.mockReset();
    readGoogleSnapshotMock.mockReset();
    listFieldStatesMock.mockReset();
    listOpenOutboundCandidatesMock.mockReset();
    readLatestSucceededRunMock.mockReset();
    buildRegistryMock.mockReset();
    resolveFieldCapabilityMock.mockReset();
    hashCanonicalJsonMock.mockReset();
    refreshFromGoogleMock.mockReset();
    requireProviderRefreshBudgetMock.mockReset();
    enqueueDualSyncJobMock.mockReset();
    getDualSyncRestaurantControlMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockReset();
    isDualSyncRestaurantPausedErrorMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getDualSyncRuntimeControlsMock.mockReturnValue({
      importEnabled: true,
      exportEnabled: true,
      autoCandidatesEnabled: true,
      highRiskExportsEnabled: true,
      menuSyncEnabled: true,
      attributesSyncEnabled: true,
      scheduledRefreshEnabled: true,
    });
    getDualSyncDecisionDisabledReasonMock.mockReturnValue(null);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    readNabatableSnapshotMock.mockResolvedValue({});
    readGoogleSnapshotMock.mockResolvedValue({});
    listFieldStatesMock.mockResolvedValue([]);
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
    readLatestSucceededRunMock.mockResolvedValue(null);
    buildRegistryMock.mockReturnValue([]);
    hashCanonicalJsonMock.mockReturnValue('hash');
    requireProviderRefreshBudgetMock.mockResolvedValue(null);
    getDualSyncRestaurantControlMock.mockResolvedValue({
      restaurantId: 'rest-1',
      provider: 'google_business_profile',
      syncPaused: false,
      pauseReason: null,
      pausedByUserId: null,
      pausedAt: null,
      resumedAt: null,
      createdAt: null,
      updatedAt: null,
    });
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(undefined);
    isDualSyncRestaurantPausedErrorMock.mockReturnValue(false);
    refreshFromGoogleMock.mockResolvedValue({
      snapshotRun: { id: 'run-1' },
      foodMenusRefresh: null,
      recompute: { transitions: [], evaluatedFieldKeys: [] },
    });
    enqueueDualSyncJobMock.mockResolvedValue({
      id: 'job-1',
      restaurantId: 'rest-1',
      jobKind: 'google_refresh_manual',
      status: 'queued',
    });
  });

  it('preserves restaurant access checks before loading state', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await stateGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/state'),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('adds runtime-control blocked reasons to field capabilities in state', async () => {
    buildRegistryMock.mockReturnValue([
      {
        fieldKey: 'profile.name',
        sectionKey: 'profile',
        kind: 'profile',
        label: 'Business name',
        helpText: null,
        conflictPolicy: 'manual',
        deletePolicy: 'manual',
        importable: true,
        exportable: true,
        sortOrder: 0,
        policy: {
          fieldKey: 'profile.name',
          sectionKey: 'profile',
          authority: 'bidirectional_manual',
          riskLevel: 'critical',
          importable: true,
          exportable: true,
          requiresManualReview: true,
          googleWriteGroup: 'location.profile',
          semanticComparator: 'text',
          canonicalizer: 'canonicalizeText',
          destructiveWritePossible: true,
        },
        normalizeCoreValue: vi.fn((value) => value),
        normalizeGbpValue: vi.fn((value) => value),
        canonicalizeCoreValue: vi.fn((value) => value),
        canonicalizeGbpValue: vi.fn((value) => value),
      },
    ]);
    readNabatableSnapshotMock.mockResolvedValue({
      profile: { name: 'Core name' },
      businessContext: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
      operatingHours: { weekly: [] },
      servicePeriods: { periods: [] },
      foodMenus: { items: [] },
    });
    readGoogleSnapshotMock.mockResolvedValue({
      profile: { name: 'Google name' },
      businessContext: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
      operatingHours: { weekly: [] },
      servicePeriods: { periods: [] },
      foodMenus: { items: [] },
    });
    resolveFieldCapabilityMock.mockReturnValue({
      canImport: true,
      canExport: true,
      canIgnore: true,
      blockedReasons: [],
    });
    getDualSyncDecisionDisabledReasonMock.mockImplementation((input) =>
      input.action === 'export_to_google'
        ? 'High-risk Google exports are disabled for this deployment.'
        : null,
    );

    const response = await stateGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/state'),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fields: [
        {
          fieldKey: 'profile.name',
          capability: {
            canImport: true,
            canExport: false,
            blockedReasons: ['High-risk Google exports are disabled for this deployment.'],
          },
        },
      ],
      outboundQueue: { autoExportable: 0 },
      control: {
        syncPaused: false,
      },
    });
  });

  it('preserves restaurant access checks before refreshing from Google', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(requireProviderRefreshBudgetMock).not.toHaveBeenCalled();
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
  });

  it('returns frontend-readable state load errors', async () => {
    listFieldStatesMock.mockRejectedValue(new Error('state table unavailable'));

    const response = await stateGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/state'),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message: 'state table unavailable',
      error: 'state table unavailable',
      code: 'DUAL_SYNC_STATE_ERROR',
    });
  });

  it('returns frontend-readable refresh errors', async () => {
    refreshFromGoogleMock.mockRejectedValue(new Error('provider unavailable'));

    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message: 'provider unavailable',
      error: 'provider unavailable',
      code: 'DUAL_SYNC_REFRESH_ERROR',
    });
  });

  it('returns 409 when refresh overlaps another write-affecting sync job', async () => {
    refreshFromGoogleMock.mockRejectedValueOnce({
      code: 'DUAL_SYNC_LOCK_HELD',
      message: 'Dual-sync is already running for restaurant rest-1.',
      activeLock: { id: 'lock-1', jobKind: 'publish_batch' },
    });

    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Dual-sync is already running for restaurant rest-1.',
      code: 'DUAL_SYNC_LOCK_HELD',
      activeLock: { id: 'lock-1', jobKind: 'publish_batch' },
    });
  });

  it('can enqueue a durable refresh job instead of refreshing inline', async () => {
    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh?queue=1', {
        method: 'POST',
        headers: { 'idempotency-key': 'refresh-request-1' },
      }),
      routeContext,
    );

    expect(response.status).toBe(202);
    expect(requireProviderRefreshBudgetMock).toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceClient,
        restaurantId: 'rest-1',
        jobKind: 'google_refresh_manual',
        idempotencyKey: 'refresh-request-1',
        payload: {
          actorUserId: 'user-1',
          skipPull: false,
        },
      }),
    );
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      queued: true,
      job: { id: 'job-1', status: 'queued' },
    });
  });

  it('returns 409 when refresh is paused for the restaurant', async () => {
    const pausedError = Object.assign(new Error('Maintenance window.'), {
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
    });
    assertDualSyncRestaurantNotPausedMock.mockRejectedValueOnce(pausedError);
    isDualSyncRestaurantPausedErrorMock.mockImplementation((error) => error === pausedError);

    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(409);
    expect(refreshFromGoogleMock).not.toHaveBeenCalled();
    expect(enqueueDualSyncJobMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      message: 'Maintenance window.',
    });
  });
});
