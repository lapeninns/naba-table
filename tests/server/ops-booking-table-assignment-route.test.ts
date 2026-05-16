import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const evaluateManualSelectionMock = vi.hoisted(() => vi.fn());
const assignTableToBookingMock = vi.hoisted(() => vi.fn());
const getBookingTableAssignmentsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/capacity', () => ({
  assignTableToBooking: assignTableToBookingMock,
  evaluateManualSelection: evaluateManualSelectionMock,
  getBookingTableAssignments: getBookingTableAssignmentsMock,
}));

vi.mock('@/server/capacity/holds', () => ({
  AssignTablesRpcError: class AssignTablesRpcError extends Error {
    code = 'ASSIGNMENT_VALIDATION';
    details = null;
    hint = null;
  },
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: vi.fn(),
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { POST } from '@/src/app/api/ops/bookings/[id]/tables/route';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

function makeRequest() {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/tables`, {
    method: 'POST',
    body: JSON.stringify({ tableId: TABLE_ID }),
  });
}

function makeContext() {
  return { params: Promise.resolve({ id: BOOKING_ID }) };
}

function makeSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: BOOKING_ID,
          restaurant_id: RESTAURANT_ID,
          booking_date: '2026-05-16',
        },
        error: null,
      })),
    })),
  };
}

describe('POST /api/ops/bookings/[id]/tables', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();
    evaluateManualSelectionMock.mockReset();
    assignTableToBookingMock.mockReset();
    getBookingTableAssignmentsMock.mockReset();

    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase());
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'manager' });
  });

  it('rejects failed manual validation before service-role assignment', async () => {
    evaluateManualSelectionMock.mockResolvedValue({
      ok: false,
      summary: {
        tableCount: 1,
        totalCapacity: 2,
        slack: -2,
        zoneId: null,
        tableNumbers: ['1'],
        partySize: 4,
      },
      checks: [
        {
          id: 'capacity',
          status: 'error',
          message: 'Selected tables do not have enough capacity.',
        },
      ],
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Selected tables cannot be assigned',
      code: 'ASSIGNMENT_VALIDATION',
      details: {
        checks: [
          {
            id: 'capacity',
            status: 'error',
          },
        ],
      },
    });
    expect(assignTableToBookingMock).not.toHaveBeenCalled();
  });

  it('uses manual validation as a pre-check without acquiring soft holds', async () => {
    const serviceClient = { service: true };
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    evaluateManualSelectionMock.mockResolvedValue({
      ok: true,
      summary: {
        tableCount: 1,
        totalCapacity: 4,
        slack: 0,
        zoneId: null,
        tableNumbers: ['1'],
        partySize: 4,
      },
      checks: [
        {
          id: 'capacity',
          status: 'ok',
          message: 'Selected tables have enough capacity.',
        },
      ],
    });
    assignTableToBookingMock.mockResolvedValue(undefined);
    getBookingTableAssignmentsMock.mockResolvedValue([
      {
        tableId: TABLE_ID,
        tableNumber: '1',
      },
    ]);

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    expect(evaluateManualSelectionMock).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      tableIds: [TABLE_ID],
      requireAdjacency: false,
      skipSoftHolds: true,
      client: serviceClient,
    });
    expect(assignTableToBookingMock).toHaveBeenCalledWith(
      BOOKING_ID,
      TABLE_ID,
      'user-1',
      serviceClient,
      { idempotencyKey: null },
    );
  });
});
