import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quoteTablesMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/engine', () => ({
  quoteTables: quoteTablesMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

import { POST } from '@/src/app/api/staff/auto/quote/route';

const USER_ID = '4f56a7b9-3ea8-4bc3-a539-508df4d9ebbb';
const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const CSRF_COOKIE_NAME = 'sr-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN = 'staff-auto-quote-csrf-token';

function csrfHeaders(): Headers {
  return new Headers({
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function buildRouteClient() {
  const bookingMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: BOOKING_ID, restaurant_id: RESTAURANT_ID }, error: null });
  const bookingEq = vi.fn().mockReturnValue({ maybeSingle: bookingMaybeSingle });
  const bookingSelect = vi.fn().mockReturnValue({ eq: bookingEq });

  const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: { role: 'host' }, error: null });
  const membershipEqUser = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
  const membershipEqRestaurant = vi.fn().mockReturnValue({ eq: membershipEqUser });
  const membershipSelect = vi.fn().mockReturnValue({ eq: membershipEqRestaurant });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID, email: 'host@example.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'bookings') {
        return { select: bookingSelect };
      }
      if (table === 'restaurant_memberships') {
        return { select: membershipSelect };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('staff auto-quote route security', () => {
  beforeEach(() => {
    quoteTablesMock.mockReset();
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue(buildRouteClient());
    getTenantServiceSupabaseClientMock.mockReset().mockReturnValue({ service: true });
  });

  it('rate limits before creating service-role table holds', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many auto-quote requests' }), { status: 429 }),
    );

    const response = await POST(
      new NextRequest('https://app.nabatable.com/api/staff/auto/quote', {
        method: 'POST',
        headers: csrfHeaders(),
        body: JSON.stringify({ bookingId: BOOKING_ID }),
      }),
    );

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'staff:auto-quote',
        tenantId: RESTAURANT_ID,
        userId: USER_ID,
      }),
    );
    expect(requireApiRateLimitMock.mock.calls[0]?.[0]).not.toHaveProperty('parts');
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(quoteTablesMock).not.toHaveBeenCalled();
  });
});
