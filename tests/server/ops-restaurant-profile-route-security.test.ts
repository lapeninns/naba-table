import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/restaurants', () => ({
  deleteRestaurant: vi.fn(),
  updateRestaurant: vi.fn(),
  updateRestaurantProfile: vi.fn(),
}));

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantBusinessDescription: vi.fn(),
  upsertRestaurantBusinessDescription: vi.fn(),
}));

vi.mock('@/server/restaurants/logo-url-compat', () => ({
  ensureLogoColumnOnRow: vi.fn((row) => row),
  isLogoUrlColumnMissing: vi.fn(() => false),
  logLogoColumnFallback: vi.fn(),
}));

vi.mock('@/server/restaurants/select-fields', () => ({
  restaurantSelectColumns: vi.fn(() => '*'),
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req, handler) => handler()),
}));

import { GET } from '@/src/app/api/ops/restaurants/[id]/route';

describe('ops restaurant profile route security', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireAdminMembershipMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();
  });

  it('requires an admin restaurant role before loading profile details', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'host@example.com' } },
          error: null,
        }),
      },
    });
    requireAdminMembershipMock.mockRejectedValue({ code: 'MEMBERSHIP_ROLE_DENIED' });

    const response = await GET(
      new NextRequest('https://app.nabatable.com/api/ops/restaurants/rest-1'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(403);
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'user-1',
      restaurantId: 'rest-1',
    });
    expect(requireMembershipForRestaurantMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
