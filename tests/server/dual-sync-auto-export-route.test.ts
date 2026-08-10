import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncAutoCandidatesEnabledMock = vi.hoisted(() => vi.fn());
const runAutoExportForRestaurantMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const assertDualSyncRestaurantNotPausedMock = vi.hoisted(() => vi.fn());
const isDualSyncRestaurantPausedErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/runtime-controls', () => ({
  isDualSyncAutoCandidatesEnabled: isDualSyncAutoCandidatesEnabledMock,
}));

vi.mock('@/server/dual-sync/scheduling/auto-export', () => ({
  runAutoExportForRestaurant: runAutoExportForRestaurantMock,
}));

vi.mock('@/server/dual-sync/controls', () => ({
  DUAL_SYNC_RESTAURANT_PAUSED_CODE: 'DUAL_SYNC_RESTAURANT_PAUSED',
  assertDualSyncRestaurantNotPaused: assertDualSyncRestaurantNotPausedMock,
  isDualSyncRestaurantPausedError: isDualSyncRestaurantPausedErrorMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route';

const serviceClient = { from: vi.fn() };

describe('dual-sync auto-export route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncAutoCandidatesEnabledMock.mockReset();
    runAutoExportForRestaurantMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    assertDualSyncRestaurantNotPausedMock.mockReset();
    isDualSyncRestaurantPausedErrorMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncAutoCandidatesEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    assertDualSyncRestaurantNotPausedMock.mockResolvedValue(undefined);
    isDualSyncRestaurantPausedErrorMock.mockReturnValue(false);
    runAutoExportForRestaurantMock.mockResolvedValue({
      restaurantId: 'rest-1',
      candidatesConsidered: 0,
      decisionsExecuted: 0,
      publishResult: null,
      skipped: [],
    });
  });

  it('does not enqueue a durable auto-export job because candidate discovery is synchronous', async () => {
    const response = await POST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/auto-export?queue=1',
        {
          method: 'POST',
          headers: { 'idempotency-key': 'auto-export-1' },
          body: JSON.stringify({ maxCandidates: 25 }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(runAutoExportForRestaurantMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      maxCandidates: 25,
      actorUserId: 'user-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      decisionsExecuted: 0,
    });
  });

  it('preserves restaurant access checks before queuing', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/auto-export?queue=1',
        {
          method: 'POST',
          body: JSON.stringify({ maxCandidates: 25 }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(runAutoExportForRestaurantMock).not.toHaveBeenCalled();
  });

  it('blocks auto-candidate export when the runtime control is disabled', async () => {
    isDualSyncAutoCandidatesEnabledMock.mockReturnValue(false);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/auto-export', {
        method: 'POST',
        body: JSON.stringify({ maxCandidates: 25 }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_AUTO_CANDIDATES_DISABLED',
      message: 'Dual-sync auto-candidate export is disabled for this deployment.',
    });
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
    expect(runAutoExportForRestaurantMock).not.toHaveBeenCalled();
  });

  it('returns 409 without queuing or running when restaurant sync is paused', async () => {
    const pausedError = Object.assign(new Error('Maintenance window.'), {
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
    });
    assertDualSyncRestaurantNotPausedMock.mockRejectedValueOnce(pausedError);
    isDualSyncRestaurantPausedErrorMock.mockImplementation((error) => error === pausedError);

    const response = await POST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/auto-export?queue=1',
        {
          method: 'POST',
          body: JSON.stringify({ maxCandidates: 25 }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    expect(runAutoExportForRestaurantMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      message: 'Maintenance window.',
    });
  });
});
