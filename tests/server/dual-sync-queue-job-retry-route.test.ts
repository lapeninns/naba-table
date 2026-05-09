import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const isDualSyncEnabledMock = vi.hoisted(() => vi.fn());
const retryDualSyncJobMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/flag', () => ({
  isDualSyncEnabled: isDualSyncEnabledMock,
}));

vi.mock('@/server/dual-sync/queue', () => ({
  retryDualSyncJob: retryDualSyncJobMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/jobs/[jobId]/retry/route';

const serviceClient = { from: vi.fn() };

describe('dual-sync queue job retry route', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    isDualSyncEnabledMock.mockReset();
    retryDualSyncJobMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    isDualSyncEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    retryDualSyncJobMock.mockResolvedValue({
      id: 'job-1',
      restaurantId: 'rest-1',
      jobKind: 'publish_batch',
      status: 'queued',
    });
  });

  it('requeues a terminal queue job for the scoped restaurant', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/jobs/job-1/retry', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'rest-1', jobId: 'job-1' }) },
    );

    expect(response.status).toBe(200);
    expect(retryDualSyncJobMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      jobId: 'job-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      job: { id: 'job-1', status: 'queued' },
    });
  });

  it('returns 404 when the job is not retryable for the restaurant', async () => {
    retryDualSyncJobMock.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/jobs/job-1/retry', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'rest-1', jobId: 'job-1' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_JOB_NOT_RETRYABLE',
    });
  });

  it('preserves access checks before retrying', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/jobs/job-1/retry', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'rest-1', jobId: 'job-1' }) },
    );

    expect(response.status).toBe(403);
    expect(retryDualSyncJobMock).not.toHaveBeenCalled();
  });
});
