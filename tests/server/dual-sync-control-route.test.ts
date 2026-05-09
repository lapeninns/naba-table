import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getDualSyncRestaurantControlMock = vi.hoisted(() => vi.fn());
const setDualSyncRestaurantPausedMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/server/dual-sync/controls', () => ({
  DUAL_SYNC_RESTAURANT_PAUSED_CODE: 'DUAL_SYNC_RESTAURANT_PAUSED',
  getDualSyncRestaurantControl: getDualSyncRestaurantControlMock,
  setDualSyncRestaurantPaused: setDualSyncRestaurantPausedMock,
}));

import { GET, PATCH } from '@/src/app/api/ops/restaurants/[id]/dual-sync/control/route';

const serviceClient = { from: vi.fn() };
const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };

function control(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: 'rest-1',
    provider: 'google_business_profile',
    syncPaused: false,
    pauseReason: null,
    pausedByUserId: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('dual-sync control route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncEnabledMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    getDualSyncRestaurantControlMock.mockReset();
    setDualSyncRestaurantPausedMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    getDualSyncRestaurantControlMock.mockResolvedValue(control());
    setDualSyncRestaurantPausedMock.mockResolvedValue(
      control({
        syncPaused: true,
        pauseReason: 'Maintenance window.',
        pausedByUserId: 'user-1',
      }),
    );
  });

  it('returns restaurant control state for an authorized admin', async () => {
    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/control'),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(getDualSyncRestaurantControlMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      control: { syncPaused: false },
    });
  });

  it('pauses restaurant sync with the acting admin id', async () => {
    const response = await PATCH(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/control', {
        method: 'PATCH',
        body: JSON.stringify({ syncPaused: true, reason: 'Maintenance window.' }),
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(setDualSyncRestaurantPausedMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      paused: true,
      reason: 'Maintenance window.',
      actorUserId: 'user-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      control: {
        syncPaused: true,
        pauseReason: 'Maintenance window.',
      },
    });
  });

  it('preserves restaurant access checks before loading or updating control', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await PATCH(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/control', {
        method: 'PATCH',
        body: JSON.stringify({ syncPaused: true }),
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(getDualSyncRestaurantControlMock).not.toHaveBeenCalled();
    expect(setDualSyncRestaurantPausedMock).not.toHaveBeenCalled();
  });

  it('returns a clear unavailable response before access checks', async () => {
    isDualSyncEnabledMock.mockReturnValue(false);

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/control'),
      routeContext,
    );

    expect(response.status).toBe(404);
    expect(ensureRestaurantAdminAccessMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_UNAVAILABLE',
    });
  });

  it('rejects invalid control payloads', async () => {
    const response = await PATCH(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/control', {
        method: 'PATCH',
        body: JSON.stringify({ syncPaused: 'yes' }),
      }),
      routeContext,
    );

    expect(response.status).toBe(422);
    expect(setDualSyncRestaurantPausedMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_INVALID_REQUEST',
    });
  });
});
