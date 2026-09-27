import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  access: vi.fn(),
  budget: vi.fn(),
  live: vi.fn(),
  readiness: vi.fn(),
  client: vi.fn(),
}));
vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: mocks.resolve,
  ensureRestaurantAdminAccess: mocks.access,
}));
vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: mocks.budget,
}));
vi.mock('@/server/google-business-profile/serviceLiveConnection', () => ({
  readGoogleBusinessProfileLiveConnection: mocks.live,
  readGoogleBusinessProfileRetentionStatus: mocks.readiness,
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: mocks.client }));
import { GET as liveGet } from '@/app/api/ops/restaurants/[id]/google-business-profile/live/route';
import { GET as readinessGet } from '@/app/api/ops/restaurants/[id]/google-business-profile/live/readiness/route';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

const invoke = (handler: typeof liveGet) =>
  handler(new NextRequest('https://example.test'), {
    params: Promise.resolve({ id: 'restaurant' }),
  });
describe.each([
  ['live', liveGet],
  ['readiness', readinessGet],
] as const)('GBP %s route', (_name, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue('restaurant');
    mocks.access.mockResolvedValue({ userId: 'admin' });
    mocks.budget.mockResolvedValue(null);
    mocks.client.mockReturnValue({ test: 'client' });
    mocks.live.mockResolvedValue({ status: 'verified' });
    mocks.readiness.mockResolvedValue({ status: 'blocked', reason: 'retention_not_ready' });
  });
  it('authorizes tenant admins and budgets the uncached read before using the service client', async () => {
    const response = await invoke(handler);
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith(
      'restaurant',
      expect.stringContaining('google-business-profile'),
    );
    expect(mocks.budget).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'restaurant', provider: 'google_business_profile' }),
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
  });
  it.each([401, 403])(
    'does not reach the provider or client when authorization returns %i',
    async (status) => {
      mocks.access.mockResolvedValue(NextResponse.json({ error: 'denied' }, { status }));
      const response = await invoke(handler);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.live).not.toHaveBeenCalled();
      expect(mocks.readiness).not.toHaveBeenCalled();
    },
  );
  it('honors the rate limit without fetching data', async () => {
    mocks.budget.mockResolvedValue(NextResponse.json({ error: 'rate limit' }, { status: 429 }));
    const response = await invoke(handler);
    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('rejects missing tenant ids before authentication or data access', async () => {
    mocks.resolve.mockResolvedValue(null);
    expect((await invoke(handler)).status).toBe(400);
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});

describe('live route errors', () => {
  it.each([
    [new Error('private token provider body'), 502, 'GBP_LIVE_CONNECTION_FAILED'],
    [
      new GoogleBusinessProfileError('private provider body', {
        code: 'GBP_LIVE_CONNECTION_CHANGED',
      }),
      409,
      'GBP_LIVE_CONNECTION_CHANGED',
    ],
    [
      new GoogleBusinessProfileError('private provider body', {
        kind: 'access_lost',
        upstreamStatus: 403,
      }),
      409,
      'GBP_REAUTH_REQUIRED',
    ],
  ] as const)('returns safe error metadata only', async (error, status, code) => {
    mocks.resolve.mockResolvedValue('restaurant');
    mocks.access.mockResolvedValue({ userId: 'admin' });
    mocks.budget.mockResolvedValue(null);
    mocks.live.mockRejectedValue(error);
    const response = await invoke(liveGet);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain('private');
  });
});
