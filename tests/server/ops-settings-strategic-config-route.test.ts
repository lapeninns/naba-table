import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const getStrategicConfigSnapshotMock = vi.hoisted(() => vi.fn());
const clearStrategicCachesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/capacity/strategic-config', () => ({
  getStrategicConfigSnapshot: getStrategicConfigSnapshotMock,
}));

vi.mock('@/server/capacity/strategic-maintenance', () => ({
  clearStrategicCaches: clearStrategicCachesMock,
}));

import { GET, POST } from '@/src/app/api/ops/settings/strategic-config/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function getRequest(query: string) {
  return new NextRequest(`https://app.nabatable.com/api/ops/settings/strategic-config${query}`);
}

function postRequest(body: unknown) {
  return new NextRequest('https://app.nabatable.com/api/ops/settings/strategic-config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockSupabase(user: { id: string } | null, error: { status?: number } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
    },
  };
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
  requireMembershipForRestaurantMock.mockReset();
  requireAdminMembershipMock.mockReset();
  getStrategicConfigSnapshotMock.mockReset();
  clearStrategicCachesMock.mockReset();
});

describe('GET /api/ops/settings/strategic-config', () => {
  it('rejects non-uuid restaurantId query before any auth work @p1 @api @contract', async () => {
    const response = await GET(getRequest('?restaurantId=not-a-uuid'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid query' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(getStrategicConfigSnapshotMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated reads before loading strategic config @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase(null));

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
    expect(getStrategicConfigSnapshotMock).not.toHaveBeenCalled();
  });

  it('maps supabase auth lookup failures to 401 @p2 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      mockSupabase(null, { status: 401 }),
    );

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    expect(getStrategicConfigSnapshotMock).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant reads when membership validation fails @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-1' }));
    requireMembershipForRestaurantMock.mockRejectedValue(new Error('membership denied'));

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: 'user-1',
      restaurantId: RESTAURANT_ID,
    });
    expect(getStrategicConfigSnapshotMock).not.toHaveBeenCalled();
  });

  it('returns the strategic config snapshot for members @p1 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-2' }));
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    getStrategicConfigSnapshotMock.mockReturnValue({
      source: 'db',
      scarcityWeight: 22,
      demandMultiplierOverride: 1.5,
      futureConflictPenalty: 100,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      restaurantId: RESTAURANT_ID,
      source: 'db',
      weights: {
        scarcity: 22,
        demandMultiplier: 1.5,
        futureConflictPenalty: 100,
      },
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(getStrategicConfigSnapshotMock).toHaveBeenCalledWith({ restaurantId: RESTAURANT_ID });
  });

  it('returns 500 when the strategic config snapshot throws @p2 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-2' }));
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'owner' });
    getStrategicConfigSnapshotMock.mockImplementation(() => {
      throw new Error('config unavailable');
    });

    const response = await GET(getRequest(`?restaurantId=${RESTAURANT_ID}`));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to load strategic settings',
    });
  });
});

describe('POST /api/ops/settings/strategic-config', () => {
  const validPayload = {
    restaurantId: RESTAURANT_ID,
    weights: { scarcity: 25 },
  };

  it('rejects malformed JSON bodies before auth work @p1 @api @contract', async () => {
    const response = await POST(postRequest('{not-json'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(clearStrategicCachesMock).not.toHaveBeenCalled();
  });

  it('rejects out-of-range weight payloads @p1 @api @contract', async () => {
    const response = await POST(
      postRequest({ restaurantId: RESTAURANT_ID, weights: { scarcity: 5000 } }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' });
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(clearStrategicCachesMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated writes before clearing caches @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase(null));

    const response = await POST(postRequest(validPayload));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(clearStrategicCachesMock).not.toHaveBeenCalled();
  });

  it('rejects non-admin members before clearing caches @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'user-3' }));
    requireAdminMembershipMock.mockRejectedValue(new Error('role denied'));

    const response = await POST(postRequest(validPayload));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'user-3',
      restaurantId: RESTAURANT_ID,
    });
    expect(clearStrategicCachesMock).not.toHaveBeenCalled();
  });

  it('clears strategic caches then reports writes as unsupported for admins @p1 @api', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockSupabase({ id: 'admin-1' }));
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });

    const response = await POST(postRequest(validPayload));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error:
        'Strategic configuration is now defined in code/env. Deploy a change to update weights.',
    });
    expect(clearStrategicCachesMock).toHaveBeenCalledTimes(1);
  });
});
