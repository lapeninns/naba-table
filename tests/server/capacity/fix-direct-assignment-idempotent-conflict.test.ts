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

vi.mock('@/server/runtime-policy', () => ({
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

import { AssignTablesRpcError } from '@/server/capacity/holds';
import { assignTablesDirectly } from '@/server/capacity/table-assignment/direct-assignment';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';

const WINNER_ROW = {
  id: 'assignment-winner',
  booking_id: BOOKING_ID,
  table_id: TABLE_ID,
  assigned_at: '2026-07-01T10:00:00.000Z',
  assigned_by: 'user-other',
};

/**
 * Builds a Supabase-ish client whose booking_table_assignments reads return a
 * scripted sequence of results. Each entry corresponds to one full
 * select(...).eq/in(...) query (resolved via the thenable).
 */
function makeScriptedClient(readResults: Array<{ data: unknown; error: unknown }>) {
  let readIndex = 0;

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
          const result = readResults[readIndex] ?? { data: [], error: null };
          readIndex += 1;
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

describe('assignTablesDirectly idempotent conflict recovery (#15)', () => {
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
  });

  it('returns the idempotent result (not a raw 409) when a concurrent same-key request wins the race', async () => {
    // Read #1 = up-front idempotency check (empty: both racers passed it).
    // Read #2 = post-conflict recovery read (winner's row is now present).
    const client = makeScriptedClient([
      { data: [], error: null },
      { data: [WINNER_ROW], error: null },
    ]);
    ensureClientMock.mockReturnValue(client);

    // The commit loses the (booking_id, table_id) unique constraint.
    assignTableToBookingMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'duplicate key value violates unique constraint',
        code: 'ASSIGNMENT_CONFLICT',
        details: null,
        hint: null,
      }),
    );

    const result = await assignTablesDirectly({
      bookingId: BOOKING_ID,
      tableIds: [TABLE_ID],
      idempotencyKey: 'idem-shared',
      assignedBy: 'user-1',
      client: client as never,
    });

    expect(result.success).toBe(true);
    expect(result.assignments).toEqual([
      {
        id: 'assignment-winner',
        booking_id: BOOKING_ID,
        table_id: TABLE_ID,
        assigned_at: '2026-07-01T10:00:00.000Z',
        assigned_by: 'user-other',
      },
    ]);
  });

  it('still surfaces a 409 when the conflict is NOT from a same-key sibling (no recovered rows)', async () => {
    // Read #1 = idempotency check (empty). Read #2 = recovery read (still empty:
    // the conflict came from a different booking/window, not our key).
    const client = makeScriptedClient([
      { data: [], error: null },
      { data: [], error: null },
    ]);
    ensureClientMock.mockReturnValue(client);

    assignTableToBookingMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'assignment conflict with another booking',
        code: 'ASSIGNMENT_CONFLICT',
        details: null,
        hint: null,
      }),
    );

    await expect(
      assignTablesDirectly({
        bookingId: BOOKING_ID,
        tableIds: [TABLE_ID],
        idempotencyKey: 'idem-unique',
        assignedBy: 'user-1',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      code: 'ASSIGNMENT_CONFLICT',
      status: 409,
    });
  });

  it('fails closed: a recovery-read DB error surfaces an error, never a fabricated success', async () => {
    // Read #1 = idempotency check (empty). Read #2 = recovery read errors.
    const client = makeScriptedClient([
      { data: [], error: null },
      { data: null, error: { message: 'connection reset' } },
    ]);
    ensureClientMock.mockReturnValue(client);

    assignTableToBookingMock.mockRejectedValue(
      new AssignTablesRpcError({
        message: 'duplicate key value violates unique constraint',
        code: 'ASSIGNMENT_CONFLICT',
        details: null,
        hint: null,
      }),
    );

    await expect(
      assignTablesDirectly({
        bookingId: BOOKING_ID,
        tableIds: [TABLE_ID],
        idempotencyKey: 'idem-shared',
        assignedBy: 'user-1',
        client: client as never,
      }),
    ).rejects.toMatchObject({
      code: 'ASSIGNMENT_SYNC_FAILED',
    });
  });
});

describe('assignTablesDirectly idempotency key table-set guard (#2)', () => {
  const OTHER_TABLE_ID = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    vi.clearAllMocks();
    loadBookingMock.mockResolvedValue({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      party_size: 4,
      status: 'pending',
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
  });

  it('rejects a same-key replay that requests a DIFFERENT table set with a 409, without re-assigning', async () => {
    // Up-front idempotency read returns rows for TABLE_ID; the caller now asks for
    // a different table under the SAME key. Returning the old rows as success
    // would emit an inconsistent body and silently drop the requested assignment.
    const client = makeScriptedClient([{ data: [WINNER_ROW], error: null }]);
    ensureClientMock.mockReturnValue(client);

    await expect(
      assignTablesDirectly({
        bookingId: BOOKING_ID,
        tableIds: [OTHER_TABLE_ID],
        idempotencyKey: 'idem-shared',
        assignedBy: 'user-1',
        client: client as never,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT', status: 409 });

    // Must NOT silently drop the request or attempt a (conflicting) commit.
    expect(assignTableToBookingMock).not.toHaveBeenCalled();
  });

  it('returns the idempotent result when the same key replays the SAME table set', async () => {
    const client = makeScriptedClient([{ data: [WINNER_ROW], error: null }]);
    ensureClientMock.mockReturnValue(client);

    const result = await assignTablesDirectly({
      bookingId: BOOKING_ID,
      tableIds: [TABLE_ID],
      idempotencyKey: 'idem-shared',
      assignedBy: 'user-1',
      client: client as never,
    });

    expect(result.success).toBe(true);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].table_id).toBe(TABLE_ID);
    // Up-front idempotency hit short-circuits the commit path.
    expect(assignTableToBookingMock).not.toHaveBeenCalled();
  });
});
