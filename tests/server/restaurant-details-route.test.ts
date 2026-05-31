import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const getRestaurantDetailsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantDetails: getRestaurantDetailsMock,
  updateRestaurantDetails: updateRestaurantDetailsMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  syncRestaurantProfileWithGoogleBusinessProfile: vi.fn(),
}));

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {
    code = 'PASSWORD_CONFIRMATION_FAILED';
    status = 403;
  },
  verifyUserPasswordConfirmation: vi.fn(),
}));

import { POST, PUT } from '@/src/app/api/ops/restaurants/[id]/details/route';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../lib/security/csrf';

const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const CSRF_TOKEN = 'restaurant-details-csrf-token';

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function csrfHeaders() {
  return {
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  };
}

function jsonRequest(path: string, body: unknown, method = 'PUT') {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method,
    body: JSON.stringify(body),
    headers: csrfHeaders(),
  });
}

describe('ops restaurant details route', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireAdminMembershipMock.mockReset();
    updateRestaurantDetailsMock.mockReset();
    getRestaurantDetailsMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'owner@example.com' } },
          error: null,
        }),
      },
    });
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    updateRestaurantDetailsMock.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      timezone: 'Europe/London',
    });
  });

  it('preserves omitted nullable fields during partial updates', async () => {
    const response = await PUT(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/details`, {
        timezone: 'Europe/London',
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      timezone: 'Europe/London',
    });
  });

  it('keeps explicit nulls as clear requests', async () => {
    const response = await PUT(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/details`, {
        timezone: 'Europe/London',
        phone: null,
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      timezone: 'Europe/London',
      contactPhone: null,
    });
  });

  it.each([
    ['PUT', PUT],
    ['POST', POST],
  ] as const)(
    'rejects missing CSRF on %s before parsing the request body',
    async (method, handler) => {
      const request = new NextRequest(
        `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/details`,
        {
          method,
          body: JSON.stringify({ timezone: 'Europe/London', password: 'password-1' }),
        },
      );
      const jsonSpy = vi.spyOn(request, 'json');

      const response = await handler(request, routeContext());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('CSRF_INVALID');
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
      expect(updateRestaurantDetailsMock).not.toHaveBeenCalled();
    },
  );
});
