import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';

const confirmHoldMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/engine', () => ({
  confirmHold: confirmHoldMock,
}));

vi.mock('@/server/capacity/holds', () => ({
  AssignTablesRpcError: class AssignTablesRpcError extends Error {
    code?: string | null;
    details?: string | null;
    hint?: string | null;

    constructor(error: {
      message: string;
      code?: string | null;
      details?: string | null;
      hint?: string | null;
    }) {
      super(error.message);
      this.name = 'AssignTablesRpcError';
      this.code = error.code ?? null;
      this.details = error.details ?? null;
      this.hint = error.hint ?? null;
    }
  },
  HoldNotFoundError: class HoldNotFoundError extends Error {},
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

import { AssignTablesRpcError } from '@/server/capacity/holds';
import { POST } from '@/src/app/api/staff/auto/confirm/route';

const USER_ID = '4f56a7b9-3ea8-4bc3-a539-508df4d9ebbb';
const RESTAURANT_ID = '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111';
const HOLD_ID = '994a7b07-6046-4a79-a391-e2784c78f2c4';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const CSRF_TOKEN = 'staff-auto-confirm-csrf-token';

function csrfHeaders(): Headers {
  return new Headers({
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  });
}

function createMaybeSingleQuery(response: { data: unknown; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
  return query;
}

function buildRouteClient({
  booking = { id: BOOKING_ID },
}: {
  booking?: { id: string } | null;
} = {}) {
  const holdQuery = createMaybeSingleQuery({
    data: { id: HOLD_ID, restaurant_id: RESTAURANT_ID },
    error: null,
  });
  const membershipQuery = createMaybeSingleQuery({
    data: { role: 'host' },
    error: null,
  });
  const bookingQuery = createMaybeSingleQuery({
    data: booking,
    error: null,
  });

  return {
    queries: { holdQuery, membershipQuery, bookingQuery },
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID, email: 'host@example.com' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'table_holds') return holdQuery;
        if (table === 'restaurant_memberships') return membershipQuery;
        if (table === 'bookings') return bookingQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

function buildRequest() {
  return new NextRequest('https://app.nabatable.com/api/staff/auto/confirm', {
    method: 'POST',
    headers: csrfHeaders(),
    body: JSON.stringify({
      holdId: HOLD_ID,
      bookingId: BOOKING_ID,
      idempotencyKey: 'confirm-once',
    }),
  });
}

describe('staff auto-confirm route security', () => {
  beforeEach(() => {
    confirmHoldMock.mockReset().mockResolvedValue([{ id: 'assignment-1' }]);
    getTenantServiceSupabaseClientMock.mockReset().mockReturnValue({ service: true });
  });

  it('requires the booking to belong to the authorized hold restaurant before confirming', async () => {
    const { client, queries } = buildRouteClient({ booking: null });
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue(client);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Booking not found' });
    expect(queries.bookingQuery.eq).toHaveBeenCalledWith('id', BOOKING_ID);
    expect(queries.bookingQuery.eq).toHaveBeenCalledWith('restaurant_id', RESTAURANT_ID);
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(confirmHoldMock).not.toHaveBeenCalled();
  });

  it('collapses hold/booking tenant mismatch errors to the same generic not found response', async () => {
    const { client } = buildRouteClient();
    getRouteHandlerSupabaseClientMock.mockReset().mockResolvedValue(client);
    confirmHoldMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'Hold and booking belong to different restaurants',
        code: 'HOLD_RESTAURANT_MISMATCH',
        details: JSON.stringify({
          holdRestaurantId: RESTAURANT_ID,
          bookingRestaurantId: 'other-restaurant',
        }),
      }),
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Booking not found' });
  });
});
