import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTodayBookingChangesMock = vi.hoisted(() => vi.fn());
const requireDashboardAccessMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/ops/bookings', () => ({
  getTodayBookingChanges: getTodayBookingChangesMock,
}));

vi.mock('@/src/app/api/ops/dashboard/_shared', () => ({
  requireDashboardAccess: requireDashboardAccessMock,
  buildDashboardAccessErrorResponse: (_scope: string, _error: unknown) =>
    NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/ops/dashboard/changes/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

describe('ops dashboard changes route', () => {
  beforeEach(() => {
    getTodayBookingChangesMock.mockReset().mockResolvedValue({ changes: [] });
    requireDashboardAccessMock.mockReset().mockResolvedValue(undefined);
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    getServiceSupabaseClientMock.mockReset().mockReturnValue({ from: vi.fn() });
  });

  it('rejects unbounded change feed limits before querying service-role history', async () => {
    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/dashboard/changes?restaurantId=${RESTAURANT_ID}&limit=100000`,
      ),
    );

    expect(response.status).toBe(400);
    expect(getTodayBookingChangesMock).not.toHaveBeenCalled();
  });

  it('rate limits bounded change feed requests', async () => {
    await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/dashboard/changes?restaurantId=${RESTAURANT_ID}&limit=25`,
      ),
    );

    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'ops-dashboard:changes',
        tenantId: RESTAURANT_ID,
      }),
    );
    expect(getTodayBookingChangesMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({ limit: 25 }),
    );
  });
});
