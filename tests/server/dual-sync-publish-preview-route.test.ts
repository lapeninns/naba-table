import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
const buildPublishPlanMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/flag', () => ({
  isDualSyncEnabled: isDualSyncEnabledMock,
}));

vi.mock('@/server/dual-sync/publish/planner', () => ({
  buildPublishPlan: buildPublishPlanMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish/preview/route';

const serviceClient = { from: vi.fn() };

describe('dual-sync publish preview route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncEnabledMock.mockReset();
    buildPublishPlanMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
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
    expect(buildPublishPlanMock).toHaveBeenCalledWith(serviceClient, {
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
    });
  });

  it('returns a clear unavailable response before access checks', async () => {
    isDualSyncEnabledMock.mockReturnValue(false);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
        method: 'POST',
        body: JSON.stringify({ decisions: [] }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Dual-sync is not enabled for this deployment.',
      error: 'Dual-sync is not enabled for this deployment.',
      code: 'DUAL_SYNC_UNAVAILABLE',
    });
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
    expect(buildPublishPlanMock).not.toHaveBeenCalled();
  });

  it('preserves restaurant access checks before parsing or planning', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish/preview', {
        method: 'POST',
        body: JSON.stringify({ decisions: [] }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
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

  it('returns frontend-readable planner errors', async () => {
    buildPublishPlanMock.mockRejectedValue(new Error('snapshot unavailable'));

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

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      message: 'snapshot unavailable',
      error: 'snapshot unavailable',
      code: 'DUAL_SYNC_PUBLISH_PREVIEW_ERROR',
    });
  });
});
