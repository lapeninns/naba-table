import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
const listRecentDualSyncJobsMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/flag', () => ({
  isDualSyncEnabled: isDualSyncEnabledMock,
}));

vi.mock('@/server/dual-sync/queue', () => ({
  listRecentDualSyncJobs: listRecentDualSyncJobsMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/jobs/route';

const serviceClient = { from: vi.fn() };
const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };

describe('dual-sync queue jobs route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncEnabledMock.mockReset();
    listRecentDualSyncJobsMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    listRecentDualSyncJobsMock.mockResolvedValue([
      {
        id: 'job-1',
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        status: 'retrying',
      },
    ]);
  });

  it('lists recent durable queue jobs with status and limit filters', async () => {
    const response = await GET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/jobs?status=queued,retrying,unknown&limit=250',
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(listRecentDualSyncJobsMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      limit: 250,
      statuses: ['queued', 'retrying'],
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      jobs: [{ id: 'job-1', status: 'retrying' }],
    });
  });

  it('preserves access checks before queue reads', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/jobs'),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(listRecentDualSyncJobsMock).not.toHaveBeenCalled();
  });
});
