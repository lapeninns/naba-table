import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
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

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/flag', () => ({
  isDualSyncEnabled: isDualSyncEnabledMock,
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

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));

import { GET as stateGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/state/route';
import { POST as refreshPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/refresh/route';

const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };
const serviceClient = { from: vi.fn() };

describe('dual-sync state and refresh routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncEnabledMock.mockReset();
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

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    readNabatableSnapshotMock.mockResolvedValue({});
    readGoogleSnapshotMock.mockResolvedValue({});
    listFieldStatesMock.mockResolvedValue([]);
    listOpenOutboundCandidatesMock.mockResolvedValue([]);
    readLatestSucceededRunMock.mockResolvedValue(null);
    buildRegistryMock.mockReturnValue([]);
    hashCanonicalJsonMock.mockReturnValue('hash');
    requireProviderRefreshBudgetMock.mockResolvedValue(null);
    refreshFromGoogleMock.mockResolvedValue({
      snapshotRun: { id: 'run-1' },
      foodMenusRefresh: null,
      recompute: { transitions: [], evaluatedFieldKeys: [] },
    });
  });

  it('returns a clear unavailable response before access checks on state', async () => {
    isDualSyncEnabledMock.mockReturnValue(false);

    const response = await stateGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/state'),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Dual-sync is not enabled for this deployment.',
      error: 'Dual-sync is not enabled for this deployment.',
      code: 'DUAL_SYNC_UNAVAILABLE',
    });
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
  });

  it('returns a clear unavailable response before access checks on refresh', async () => {
    isDualSyncEnabledMock.mockReturnValue(false);

    const response = await refreshPOST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/refresh', {
        method: 'POST',
      }),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Dual-sync is not enabled for this deployment.',
      error: 'Dual-sync is not enabled for this deployment.',
      code: 'DUAL_SYNC_UNAVAILABLE',
    });
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
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
});
