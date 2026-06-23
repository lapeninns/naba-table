import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GuardErrorMock = vi.hoisted(
  () =>
    class GuardError extends Error {
      status: number;
      code: string;
      details?: unknown;

      constructor(params: { status: number; code: string; message: string; details?: unknown }) {
        super(params.message);
        this.name = 'GuardError';
        this.status = params.status;
        this.code = params.code;
        this.details = params.details;
      }
    },
);
const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const withPlatformAdminAuthorizationMock = vi.hoisted(() => vi.fn());
const fetchAllOccasionsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => ({
  GuardError: GuardErrorMock,
  listUserRestaurantMemberships: listUserRestaurantMembershipsMock,
  requireSession: requireSessionMock,
  withPlatformAdminAuthorization: withPlatformAdminAuthorizationMock,
}));

vi.mock('@/server/occasions/admin', () => ({
  fetchAllOccasions: fetchAllOccasionsMock,
  insertAudit: vi.fn(),
  toAdminOccasion: vi.fn((occasion) => occasion),
}));

vi.mock('@/server/auth/supabase-auth-errors', () => ({
  mapSupabaseAuthError: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
  getServiceSupabaseClient: vi.fn(),
}));

import { GET, POST } from '@/src/app/api/ops/occasions/route';

describe('ops occasions route security', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    listUserRestaurantMembershipsMock.mockReset();
    withPlatformAdminAuthorizationMock.mockReset();
    fetchAllOccasionsMock.mockReset();
  });

  it('lists the occasion catalog for authenticated restaurant members', async () => {
    requireSessionMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'owner@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([{ restaurant_id: 'restaurant-1' }]);
    fetchAllOccasionsMock.mockResolvedValue([{ key: 'dinner', label: 'Dinner' }]);

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ occasions: [{ key: 'dinner', label: 'Dinner' }] });
    expect(withPlatformAdminAuthorizationMock).not.toHaveBeenCalled();
    expect(fetchAllOccasionsMock).toHaveBeenCalledOnce();
  });

  it('rejects occasion catalog reads from authenticated users without a restaurant membership', async () => {
    requireSessionMock.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'owner@example.com' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([]);

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });

  it('maps session guard failures before listing the occasion catalog', async () => {
    requireSessionMock.mockRejectedValue(
      new GuardErrorMock({
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      }),
    );

    const response = await GET(new NextRequest('https://app.nabatable.com/api/ops/occasions'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
    });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });

  it('keeps platform admin authorization required for occasion mutations', async () => {
    withPlatformAdminAuthorizationMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Platform administrator access required' }), {
        status: 403,
      }),
    });

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/ops/occasions', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect(withPlatformAdminAuthorizationMock).toHaveBeenCalledWith(expect.any(NextRequest), {
      csrf: true,
    });
    expect(fetchAllOccasionsMock).not.toHaveBeenCalled();
  });
});
