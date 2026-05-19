import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignTableToBookingMock = vi.hoisted(() => vi.fn());
const ensureClientMock = vi.hoisted(() => vi.fn());
const loadBookingMock = vi.hoisted(() => vi.fn());
const loadTablesByIdsMock = vi.hoisted(() => vi.fn());
const loadRestaurantTimezoneMock = vi.hoisted(() => vi.fn());
const loadContextBookingsMock = vi.hoisted(() => vi.fn());
const loadAdjacencyMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity/table-assignment/assignment', () => ({
  assignTableToBooking: assignTableToBookingMock,
}));

vi.mock('@/server/capacity/table-assignment/supabase', () => ({
  ensureClient: ensureClientMock,
  loadBooking: loadBookingMock,
  loadTablesByIds: loadTablesByIdsMock,
  loadRestaurantTimezone: loadRestaurantTimezoneMock,
  loadContextBookings: loadContextBookingsMock,
  loadAdjacency: loadAdjacencyMock,
}));

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

vi.mock('@/lib/ops/table-assignment-policy', () => ({
  isTableAssignmentAllowed: vi.fn(() => true),
}));

vi.mock('@/server/feature-flags', () => ({
  getAllocatorAdjacencyMode: vi.fn(() => 'connected'),
}));

vi.mock('@/server/capacity/policy', () => ({
  getVenuePolicy: vi.fn(() => ({ timezone: 'Europe/London' })),
  ServiceOverrunError: class ServiceOverrunError extends Error {},
}));

vi.mock('@/server/capacity/table-rules', () => ({
  deriveTableRules: vi.fn(() => ({ canBeMerged: true })),
}));

vi.mock('@/server/capacity/adjacency', () => ({
  evaluateAdjacency: vi.fn(() => ({ connected: true })),
  isAdjacencySatisfied: vi.fn(() => true),
  summarizeAdjacencyStatus: vi.fn(() => 'connected'),
}));

vi.mock('@/server/capacity/table-assignment/availability', () => ({
  buildBusyMaps: vi.fn(() => new Map()),
  extractConflictsForTables: vi.fn(() => []),
}));

vi.mock('@/server/capacity/table-assignment/booking-window', () => ({
  computeBookingWindowWithFallback: vi.fn(() => ({
    window: {
      block: {
        start: '2026-07-01T18:00:00.000Z',
        end: '2026-07-01T19:30:00.000Z',
      },
    },
  })),
}));

vi.mock('@/server/capacity/table-assignment/utils', () => ({
  toIsoUtc: vi.fn((value: string) => value),
  summarizeSelection: vi.fn(() => ({
    tableCount: 1,
    totalCapacity: 4,
    partySize: 4,
    slack: 0,
    zoneId: 'zone-1',
  })),
}));

import { assignTablesDirectly } from '@/server/capacity/table-assignment/direct-assignment';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

function makeAssignmentClient() {
  let assignmentQuery = 0;

  return {
    from: vi.fn((table: string) => {
      if (table !== 'booking_table_assignments') {
        throw new Error(`Unexpected table ${table}`);
      }

      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) => {
          assignmentQuery += 1;
          const result =
            assignmentQuery === 1
              ? { data: [], error: null }
              : {
                  data: [
                    {
                      id: 'assignment-1',
                      booking_id: BOOKING_ID,
                      table_id: TABLE_ID,
                      assigned_at: '2026-07-01T10:00:00.000Z',
                      assigned_by: 'user-1',
                    },
                  ],
                  error: null,
                };

          return Promise.resolve(result).then(resolve, reject);
        },
      };

      return chain;
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          status: 'confirmed',
          checked_in_at: null,
          checked_out_at: null,
          updated_at: '2026-07-01T10:00:01.000Z',
        },
      ],
      error: null,
    }),
  };
}

describe('assignTablesDirectly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadBookingMock.mockResolvedValue({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      party_size: 4,
      booking_date: '2026-07-01',
      start_time: '18:00',
      start_at: '2026-07-01T18:00:00.000Z',
      end_at: '2026-07-01T19:30:00.000Z',
      status: 'pending',
      assigned_zone_id: null,
      booking_type: 'dinner',
      checked_in_at: null,
      checked_out_at: null,
      restaurants: { timezone: 'Europe/London' },
    });
    loadTablesByIdsMock.mockResolvedValue([
      {
        id: TABLE_ID,
        tableNumber: '12',
        capacity: 4,
        zoneId: 'zone-1',
        active: true,
        zoneActive: true,
        status: 'available',
        mobility: 'movable',
      },
    ]);
    loadRestaurantTimezoneMock.mockResolvedValue('Europe/London');
    loadContextBookingsMock.mockResolvedValue([]);
    loadAdjacencyMock.mockResolvedValue([]);
    getRestaurantTurnBandsMock.mockResolvedValue(null);
    assignTableToBookingMock.mockResolvedValue('assignment-1');
  });

  it('commits direct assignments through the atomic assignment helper', async () => {
    const client = makeAssignmentClient();
    ensureClientMock.mockReturnValue(client);

    const result = await assignTablesDirectly({
      bookingId: BOOKING_ID,
      tableIds: [TABLE_ID],
      idempotencyKey: 'idem-1',
      assignedBy: 'user-1',
      client: client as never,
    });

    expect(assignTableToBookingMock).toHaveBeenCalledWith(
      BOOKING_ID,
      [TABLE_ID],
      'user-1',
      client,
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        requireAdjacency: true,
      }),
    );
    expect(client.rpc).toHaveBeenCalledWith('apply_booking_state_transition', {
      p_booking_id: BOOKING_ID,
      p_status: 'confirmed',
      p_checked_in_at: null,
      p_checked_out_at: null,
      p_updated_at: expect.any(String),
      p_history_from: 'pending',
      p_history_to: 'confirmed',
      p_history_changed_by: 'user-1',
      p_history_changed_at: expect.any(String),
      p_history_reason: 'direct_table_assignment',
      p_history_metadata: {
        source: 'direct_assignment',
        tableIds: [TABLE_ID],
        idempotencyKey: 'idem-1',
      },
    });
    expect(client.from).toHaveBeenCalledWith('booking_table_assignments');
    expect(result.assignments).toEqual([
      {
        id: 'assignment-1',
        booking_id: BOOKING_ID,
        table_id: TABLE_ID,
        assigned_at: '2026-07-01T10:00:00.000Z',
        assigned_by: 'user-1',
      },
    ]);
    expect(result.booking.status).toBe('confirmed');
  });
});
