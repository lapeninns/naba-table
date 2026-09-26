import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getManualAssignmentContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

// Domain behavior is covered by tests/server/capacity/manual-assignment-context-holds.test.ts;
// this suite pins the route boundary: auth, booking-tenant checks, serialization.
vi.mock('@/server/capacity/table-assignment/manual', () => ({
  getManualAssignmentContext: getManualAssignmentContextMock,
}));

import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';
import { GET } from '@/src/app/api/ops/bookings/[id]/manual-context/route';

const BOOKING_ID = 'ba760d72-617b-4fa7-bab2-9b198d398ef0';
const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';

function request(bookingId = BOOKING_ID) {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings/${bookingId}/manual-context`);
}

function routeContext(id = BOOKING_ID) {
  return { params: Promise.resolve({ id }) };
}

type Fixture = {
  user?: { id: string } | null;
  booking?: { restaurant_id: string | null } | null;
  bookingError?: { message: string } | null;
  membership?: { role: string } | null;
  membershipError?: { message: string } | null;
};

function buildSupabase(fixture: Fixture = {}) {
  const {
    user = { id: 'user-1' },
    booking = { restaurant_id: RESTAURANT_A },
    bookingError = null,
    membership = { role: 'host' },
    membershipError = null,
  } = fixture;

  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === 'bookings') {
          return { data: booking, error: bookingError };
        }
        if (table === 'restaurant_memberships') {
          return { data: membership, error: membershipError };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    return chain;
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from,
  };
}

beforeEach(() => {
  getRouteHandlerSupabaseClientMock.mockReset();
  getTenantServiceSupabaseClientMock.mockReset();
  getManualAssignmentContextMock.mockReset();
});

describe('GET /api/ops/bookings/[id]/manual-context', () => {
  it('rejects unauthenticated manual-context reads before booking lookups @p1 @api @security', async () => {
    const supabase = buildSupabase({ user: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getManualAssignmentContextMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the booking is missing or hidden by RLS for another tenant @p1 @api @security', async () => {
    const supabase = buildSupabase({ booking: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Booking not found',
      code: 'BOOKING_NOT_FOUND',
    });
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getManualAssignmentContextMock).not.toHaveBeenCalled();
  });

  it("rejects callers without membership in the booking's restaurant @p1 @api @security", async () => {
    const supabase = buildSupabase({ membership: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Access denied',
      code: 'ACCESS_DENIED',
    });
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(getManualAssignmentContextMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the booking lookup fails @p2 @api', async () => {
    const supabase = buildSupabase({ bookingError: { message: 'lookup failed' }, booking: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load booking',
      code: 'BOOKING_LOOKUP_FAILED',
    });
    expect(getManualAssignmentContextMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the membership lookup fails @p2 @api', async () => {
    const supabase = buildSupabase({
      membership: null,
      membershipError: { message: 'lookup failed' },
    });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to verify access',
      code: 'ACCESS_LOOKUP_FAILED',
    });
    expect(getManualAssignmentContextMock).not.toHaveBeenCalled();
  });

  it('serializes the manual assignment context via the tenant service client @p1 @api', async () => {
    const supabase = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    const serviceClient = { tag: 'tenant-service-client' };
    getTenantServiceSupabaseClientMock.mockReturnValue(serviceClient);
    const context = {
      booking: { id: BOOKING_ID, partySize: 2 },
      tables: [{ id: 'table-1', tableNumber: '1' }],
      holds: [],
      conflicts: [],
      assignments: [],
    };
    getManualAssignmentContextMock.mockResolvedValue(context);

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(context);
    // Reads go through the tenant-scoped service-role client for the booking's
    // restaurant — never a client scoped by caller-supplied input.
    expect(getTenantServiceSupabaseClientMock).toHaveBeenCalledWith(RESTAURANT_A);
    expect(getManualAssignmentContextMock).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      client: serviceClient,
    });
  });

  it('maps unexpected failures to a generic C1 500 without the raw error text @p2 @api', async () => {
    const supabase = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    getTenantServiceSupabaseClientMock.mockReturnValue({ tag: 'tenant-service-client' });
    getManualAssignmentContextMock.mockRejectedValue(
      new Error('relation "public.table_inventory" permission denied'),
    );

    const response = await GET(request(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('table_inventory');
  });

  it('keeps app-built 4xx manual selection errors @p2 @api', async () => {
    const supabase = buildSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    getTenantServiceSupabaseClientMock.mockReturnValue({ tag: 'tenant-service-client' });
    getManualAssignmentContextMock.mockRejectedValue(
      new ManualSelectionInputError('Booking not found', 'BOOKING_NOT_FOUND', 404),
    );

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
      message: 'Booking not found',
    });
  });
});
