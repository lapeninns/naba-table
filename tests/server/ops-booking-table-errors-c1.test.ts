import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * C1 error mapping for DELETE /tables/{tableId} and POST|DELETE /assign-tables: no Postgres
 * message, details or hint may reach the client.
 */

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const unassignTableFromBookingMock = vi.hoisted(() => vi.fn());
const getBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());
const assignTablesDirectlyMock = vi.hoisted(() => vi.fn());
const unassignTablesDirectMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/capacity', () => ({
  unassignTableFromBooking: unassignTableFromBookingMock,
  getBookingTableAssignments: getBookingTableAssignmentsMock,
}));

vi.mock('@/server/capacity/table-assignment/direct-assignment', async () => {
  class DirectAssignmentError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: number = 400,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = 'DirectAssignmentError';
    }
  }
  return {
    DirectAssignmentError,
    assignTablesDirectly: assignTablesDirectlyMock,
    unassignTablesDirect: unassignTablesDirectMock,
  };
});

vi.mock('@/server/jobs/booking-side-effects', () => ({
  enqueueBookingUpdatedSideEffects: vi.fn(),
  safeBookingPayload: vi.fn((booking: unknown) => booking),
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: vi.fn(),
}));

vi.mock('@/lib/posthog/server', () => ({
  captureRestaurantServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { AssignTablesRpcError } from '@/server/capacity/holds';
import { DirectAssignmentError } from '@/server/capacity/table-assignment/direct-assignment';
import {
  DELETE as deleteAssignTables,
  POST as postAssignTables,
} from '@/src/app/api/ops/bookings/[id]/assign-tables/route';
import { DELETE as deleteTable } from '@/src/app/api/ops/bookings/[id]/tables/[tableId]/route';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

function routeSupabase() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: BOOKING_ID,
        restaurant_id: RESTAURANT_ID,
        booking_date: '2026-09-26',
        role: 'host',
      },
      error: null,
    })),
  };
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: vi.fn(() => query),
  };
}

function expectNoDbText(body: unknown, ...fragments: string[]) {
  const serialized = JSON.stringify(body);
  for (const fragment of fragments) {
    expect(serialized).not.toContain(fragment);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  getRouteHandlerSupabaseClientMock.mockResolvedValue(routeSupabase());
  getServiceSupabaseClientMock.mockReturnValue({ service: true });
  getTenantServiceSupabaseClientMock.mockReturnValue({
    from: vi.fn(() => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      };
      return q;
    }),
  });
  requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
});

describe('DELETE /api/ops/bookings/[id]/tables/[tableId]', () => {
  function request() {
    return new NextRequest(
      `https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/tables/${TABLE_ID}`,
      { method: 'DELETE' },
    );
  }
  const context = { params: Promise.resolve({ id: BOOKING_ID, tableId: TABLE_ID }) };

  it('maps an RPC failure to 409 ASSIGNMENT_CONFLICT without the Postgres message', async () => {
    unassignTableFromBookingMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'Failed to unassign table: could not obtain lock on row in relation "bookings"',
        code: '55P03',
        details: 'row locked',
        hint: 'retry',
      }),
    );

    const response = await deleteTable(request(), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: 'ASSIGNMENT_CONFLICT' });
    expectNoDbText(body, 'could not obtain lock', 'row locked', 'relation');
  });

  it('maps a missing booking (P0002) to 404', async () => {
    unassignTableFromBookingMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'Failed to unassign table: Booking x not found',
        code: 'P0002',
        details: null,
        hint: null,
      }),
    );

    const response = await deleteTable(request(), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'BOOKING_NOT_FOUND' });
  });

  it('maps an unexpected failure to a generic 500', async () => {
    unassignTableFromBookingMock.mockRejectedValue(new TypeError('fetch failed: ECONNRESET'));

    const response = await deleteTable(request(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expectNoDbText(body, 'ECONNRESET');
  });
});

describe('POST|DELETE /api/ops/bookings/[id]/assign-tables', () => {
  function request(method: 'POST' | 'DELETE', body: unknown) {
    return new NextRequest(
      `https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/assign-tables`,
      { method, body: JSON.stringify(body) },
    );
  }
  const context = { params: Promise.resolve({ id: BOOKING_ID }) };
  const assignBody = { tableIds: [TABLE_ID], idempotencyKey: 'assign-1' };

  it('drops Postgres details/hint from atomic-RPC conflicts and uses a generic message', async () => {
    assignTablesDirectlyMock.mockRejectedValue(
      new DirectAssignmentError('allocations_no_overlap', 'ASSIGNMENT_CONFLICT', 409, {
        details: 'Resource 2222 overlaps requested window for booking 1111',
        hint: 'Release tables first',
      }),
    );

    const response = await postAssignTables(request('POST', assignBody), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: 'ASSIGNMENT_CONFLICT' });
    expect(body).not.toHaveProperty('details');
    expectNoDbText(body, 'allocations_no_overlap', 'overlaps requested window', 'Release tables');
  });

  it('keeps app-built validation checks and conflicts', async () => {
    assignTablesDirectlyMock.mockRejectedValue(
      new DirectAssignmentError(
        "Selected tables (2 seats) don't meet party size (4)",
        'CAPACITY',
        422,
        {
          checks: [{ id: 'capacity', passed: false, message: 'too small' }],
          conflicts: [],
        },
      ),
    );

    const response = await postAssignTables(request('POST', assignBody), context);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CAPACITY',
      details: { checks: [{ id: 'capacity', passed: false }], conflicts: [] },
    });
  });

  it('maps 5xx assignment errors to a generic 500', async () => {
    assignTablesDirectlyMock.mockRejectedValue(
      new DirectAssignmentError(
        'Failed to load created assignments: permission denied for table booking_table_assignments',
        'ASSIGNMENT_SYNC_FAILED',
        500,
      ),
    );

    const response = await postAssignTables(request('POST', assignBody), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expectNoDbText(body, 'permission denied');
  });

  it('returns C1 field errors for an invalid body', async () => {
    const response = await postAssignTables(request('POST', { tableIds: [] }), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields).toHaveProperty('tableIds');
  });

  it('maps unassign DB failures to a generic 500', async () => {
    unassignTablesDirectMock.mockRejectedValue(
      new DirectAssignmentError(
        'Failed to remove assignments: deadlock detected',
        'DELETE_FAILED',
        500,
      ),
    );

    const response = await deleteAssignTables(request('DELETE', { tableIds: [TABLE_ID] }), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expectNoDbText(body, 'deadlock');
  });
});
