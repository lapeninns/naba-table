import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock('@/server/restaurants/businessContext', () => ({
  getRestaurantBusinessContext: vi.fn(),
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

import { PUT } from '@/src/app/api/ops/restaurants/[id]/business-context/route';

describe('restaurant business-context CSRF protection', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireAdminMembershipMock.mockReset();
    updateRestaurantBusinessContextMock.mockReset();
  });

  it('rejects missing CSRF on PUT before parsing the request body', async () => {
    const request = new NextRequest(
      'https://app.nabatable.com/api/ops/restaurants/rest-1/business-context',
      {
        method: 'PUT',
        body: JSON.stringify({
          businessDetails: {
            isServiceAreaBusiness: false,
          },
        }),
      },
    );
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await PUT(request, { params: Promise.resolve({ id: 'rest-1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
  });
});
