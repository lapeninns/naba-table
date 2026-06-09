import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isOpsRejectionAnalyticsEnabledMock = vi.hoisted(() => vi.fn());
const getRejectionAnalyticsMock = vi.hoisted(() => vi.fn());
const requireDashboardAccessMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/runtime-policy', () => ({
  isOpsRejectionAnalyticsEnabled: isOpsRejectionAnalyticsEnabledMock,
}));

vi.mock('@/server/ops/rejections', () => ({
  getRejectionAnalytics: getRejectionAnalyticsMock,
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

import { GET } from '@/src/app/api/ops/dashboard/rejections/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

describe('GET /api/ops/dashboard/rejections', () => {
  beforeEach(() => {
    isOpsRejectionAnalyticsEnabledMock.mockReset().mockReturnValue(true);
    getRejectionAnalyticsMock.mockReset().mockResolvedValue({ restaurantId: RESTAURANT_ID });
    requireDashboardAccessMock.mockReset().mockResolvedValue(undefined);
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    getServiceSupabaseClientMock.mockReset().mockReturnValue({ from: vi.fn() });
  });

  it('rejects oversized analytics ranges before service-role reads', async () => {
    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/dashboard/rejections?restaurantId=${RESTAURANT_ID}&from=1970-01-01T00:00:00.000Z&to=9999-12-31T23:59:59.000Z`,
      ),
    );

    expect(response.status).toBe(400);
    expect(requireDashboardAccessMock).not.toHaveBeenCalled();
    expect(getRejectionAnalyticsMock).not.toHaveBeenCalled();
  });

  it('rate limits bounded analytics requests before querying observability events', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many rejection analytics requests' }), {
        status: 429,
      }),
    );

    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/dashboard/rejections?restaurantId=${RESTAURANT_ID}&from=2026-05-24T00:00:00.000Z&to=2026-05-30T00:00:00.000Z`,
      ),
    );

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'ops-dashboard:rejections',
        tenantId: RESTAURANT_ID,
      }),
    );
    expect(getRejectionAnalyticsMock).not.toHaveBeenCalled();
  });
});
