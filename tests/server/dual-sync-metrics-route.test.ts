import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const loadDualSyncOperationalMetricsMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/observability', () => ({
  loadDualSyncOperationalMetrics: loadDualSyncOperationalMetricsMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/metrics/route';

const serviceClient = { from: vi.fn() };

describe('dual-sync metrics route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    loadDualSyncOperationalMetricsMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    loadDualSyncOperationalMetricsMock.mockResolvedValue({
      restaurantId: 'rest-1',
      queueBacklog: 2,
      deadLetterJobs: 1,
      alerts: [{ code: 'DEAD_LETTER_JOBS', severity: 'critical', count: 1 }],
    });
  });

  it('returns tenant-scoped metrics with bounded query options', async () => {
    const response = await GET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/metrics?windowHours=6&limit=20',
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(loadDualSyncOperationalMetricsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: serviceClient,
        restaurantId: 'rest-1',
        windowMs: 6 * 60 * 60 * 1000,
        limit: 20,
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      queueBacklog: 2,
      deadLetterJobs: 1,
    });
  });

  it('preserves restaurant access checks', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/metrics'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(loadDualSyncOperationalMetricsMock).not.toHaveBeenCalled();
  });
});
