import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
const runPublishMock = vi.hoisted(() => vi.fn());
const defaultDualSyncPortsMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/flag', () => ({
  isDualSyncEnabled: isDualSyncEnabledMock,
}));

vi.mock('@/server/dual-sync/publish/orchestrator', () => ({
  runPublish: runPublishMock,
}));

vi.mock('@/server/dual-sync/publish/ports', () => ({
  defaultDualSyncPorts: defaultDualSyncPortsMock,
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
    isDualSyncEnabledMock.mockReset();
    runPublishMock.mockReset();
    defaultDualSyncPortsMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
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
      { ports },
    );
  });

  it('returns a clear unavailable response when dual-sync is disabled', async () => {
    isDualSyncEnabledMock.mockReturnValue(false);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/publish', {
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
    expect(runPublishMock).not.toHaveBeenCalled();
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
