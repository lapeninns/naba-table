import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const runPublishMock = vi.hoisted(() => vi.fn());
const defaultDualSyncPortsMock = vi.hoisted(() => vi.fn());
const enqueueDualSyncJobMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const isDualSyncRestaurantPausedErrorMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/dual-sync/queue', () => ({
  enqueueDualSyncJob: enqueueDualSyncJobMock,
}));

vi.mock('@/server/dual-sync/controls', () => ({
  DUAL_SYNC_RESTAURANT_PAUSED_CODE: 'DUAL_SYNC_RESTAURANT_PAUSED',
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
  isDualSyncRestaurantPausedError: isDualSyncRestaurantPausedErrorMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish/route';

const serviceClient = { from: vi.fn() };
const ports = {
  applyImportToCore: vi.fn(),
  applyExportToGoogle: vi.fn(),
};

describe('dual-sync publish route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    runPublishMock.mockReset();
    defaultDualSyncPortsMock.mockReset();
    enqueueDualSyncJobMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockReset();
    isDualSyncRestaurantPausedErrorMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(undefined);
    isDualSyncRestaurantPausedErrorMock.mockReturnValue(false);
    defaultDualSyncPortsMock.mockReturnValue(ports);
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
  });

  it('accepts FoodMenus publish decisions from the shared section registry', async () => {
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

    expect(response.status).toBe(200);
    expect(runPublishMock).toHaveBeenCalledWith(
      serviceClient,
      {
        restaurantId: 'rest-1',
        actorUserId: 'user-1',
        clientRequestId: null,
        publishBatchId: null,
        pinnedCoreSnapshotHash: 'core-snapshot-hash',
        pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        decisions: [
          {
            fieldKey: 'foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer',
            sectionKey: 'foodMenus',
            action: 'export_to_google',
            pinnedCoreHash: 'core-hash',
            pinnedGbpHash: 'gbp-hash',
          },
        ],
      },
      expect.objectContaining({ ports }),
    );
  });

  it('can enqueue a durable publish job instead of executing inline', async () => {
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

    expect(response.status).toBe(202);
    expect(enqueueDualSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceClient,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        idempotencyKey: 'request-1',
        payload: expect.objectContaining({
          actorUserId: 'user-1',
          clientRequestId: 'request-1',
          pinnedCoreSnapshotHash: 'core-snapshot-hash',
          pinnedGbpSnapshotHash: 'gbp-snapshot-hash',
        }),
      }),
    );
    expect(runPublishMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      queued: true,
      job: { id: 'job-1', status: 'queued' },
    });
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
      message: 'Dual-sync is already running for restaurant rest-1.',
      activeLock: { id: 'lock-1', jobKind: 'google_refresh_manual' },
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
      message: 'Maintenance window.',
    });
  });

  it('preserves restaurant access checks before parsing or publishing', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
        method: 'POST',
        body: JSON.stringify({ decisions: [] }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(runPublishMock).not.toHaveBeenCalled();
  });
});
