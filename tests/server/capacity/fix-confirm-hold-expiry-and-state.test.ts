import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssignTablesRpcError, HoldNotFoundError } from '@/server/capacity/holds';

/**
 * Regression for confirmHoldAssignment gaps #4 and #5.
 *
 * #4 (hold expiry not validated at confirm): the confirm hold SELECT did not
 * include `expires_at`, and nothing checked whether the hold had already lapsed
 * its TTL. A confirm arriving after expiry would race a sweeper and fail with a
 * generic/silent HoldNotFound or allocation failure rather than a classified
 * "this hold expired" signal. The fix loads `expires_at` and throws a DISTINCT
 * HOLD_EXPIRED error before allocating.
 *
 * #5 (booking status mutated between quote and confirm): the freshly-read booking
 * status was never guarded, so an admin cancel/no-show/complete between quote and
 * confirm could let apply_booking_state_transition drive a terminal booking back
 * to `confirmed`. The fix aborts with a state-conflict error on terminal
 * non-confirmable states before any transition runs.
 */

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

// Keep the rest of the supabase helper module real, but control the entry points
// the confirm path uses: the client factory, the booking loader, and the hold
// metadata completeness check (so a well-formed-enough hold reaches the new
// expiry / state guards rather than tripping the metadata gate first).
vi.mock('@/server/capacity/table-assignment/supabase', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/server/capacity/table-assignment/supabase')>();
  return {
    ...actual,
    ensureClient: vi.fn(),
    loadBooking: vi.fn(),
    findMissingHoldMetadataFields: vi.fn().mockReturnValue([]),
  };
});

import { confirmHoldAssignment } from '@/server/capacity/table-assignment/assignment';
import { recordObservabilityEvent } from '@/server/observability';
import {
  ensureClient,
  findMissingHoldMetadataFields,
  loadBooking,
} from '@/server/capacity/table-assignment/supabase';

type HoldFixture = {
  id: string;
  bookingId: string | null;
  restaurantId: string | null;
  expiresAt: string | null;
  tableIds: string[];
};

/**
 * Minimal fake of the Supabase client that confirmHoldAssignment touches before
 * the guards under test. It serves the single-hold lookup
 * (`from('table_holds').select(...).eq('id', ...).maybeSingle()`) and records any
 * `.rpc(...)` calls so the test can assert no transition/confirm RPC ran.
 */
function createConfirmClient(hold: HoldFixture, rpcCalls: string[]) {
  const holdRow = {
    id: hold.id,
    restaurant_id: hold.restaurantId,
    zone_id: null,
    booking_id: hold.bookingId,
    metadata: { policyVersion: 'pv-1', requireAdjacency: false },
    expires_at: hold.expiresAt,
    table_hold_members: hold.tableIds.map((table_id) => ({ table_id })),
  };

  const holdBuilder: Record<string, unknown> = {};
  holdBuilder.select = () => holdBuilder;
  holdBuilder.eq = () => holdBuilder;
  holdBuilder.maybeSingle = async () => ({ data: holdRow, error: null });

  return {
    from: (table: string) => {
      if (table === 'table_holds') {
        return holdBuilder;
      }
      // No other table reads should occur before the guards fire; return an
      // inert, fully chainable builder so an unexpected read surfaces as an empty
      // result (cache miss) rather than a TypeError that could mask the assertion.
      const inert: Record<string, unknown> = {};
      const chain = () => inert;
      inert.select = chain;
      inert.eq = chain;
      inert.limit = chain;
      inert.maybeSingle = async () => ({ data: null, error: null });
      inert.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null });
      return inert;
    },
    rpc: vi.fn(async (name: string) => {
      rpcCalls.push(name);
      return { data: [], error: null };
    }),
  } as never;
}

const RESTAURANT_ID = 'restaurant-1';
const BOOKING_ID = 'booking-1';
const HOLD_ID = 'hold-1';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // vitest.config sets mockReset:true, which wipes factory-time return values
  // before each test, so re-establish them here. Otherwise findMissingHoldMetadataFields
  // returns undefined (`.length` throws) and recordObservabilityEvent returns undefined
  // (`.catch` throws) before the guards under test can run.
  vi.mocked(findMissingHoldMetadataFields).mockReturnValue([]);
  vi.mocked(recordObservabilityEvent).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('confirmHoldAssignment hold-expiry guard (#4)', () => {
  it('throws a distinct HOLD_EXPIRED error when the hold TTL already lapsed', async () => {
    const rpcCalls: string[] = [];
    const expiredHold: HoldFixture = {
      id: HOLD_ID,
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      // 60s in the past => already swept-eligible / expired.
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      tableIds: ['table-a'],
    };
    const client = createConfirmClient(expiredHold, rpcCalls);
    vi.mocked(ensureClient).mockReturnValue(client);

    // The expiry guard must fire BEFORE loadBooking; if it does not, this stub
    // would let the flow continue and the assertions below would not hold.
    vi.mocked(loadBooking).mockResolvedValue({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'pending_allocation',
    } as never);

    let caught: unknown;
    try {
      await confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        client,
      });
      throw new Error('expected confirmHoldAssignment to reject on an expired hold');
    } catch (error) {
      caught = error;
    }

    // Distinct, classified error — NOT a silent HoldNotFound and NOT a generic
    // allocation failure.
    expect(caught).toBeInstanceOf(AssignTablesRpcError);
    expect(caught).not.toBeInstanceOf(HoldNotFoundError);
    expect((caught as AssignTablesRpcError).code).toBe('HOLD_EXPIRED');

    // Expiry is detected before the booking is even loaded or any RPC fires.
    expect(loadBooking).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it('lets a still-live hold pass the expiry gate (reaches loadBooking)', async () => {
    const rpcCalls: string[] = [];
    const liveHold: HoldFixture = {
      id: HOLD_ID,
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      tableIds: ['table-a'],
    };
    const client = createConfirmClient(liveHold, rpcCalls);
    vi.mocked(ensureClient).mockReturnValue(client);
    // Past the expiry gate the flow loads the booking; a terminal status then
    // short-circuits via the #5 state guard so we never drive into policy/window
    // machinery. The point here: a live hold is NOT classified HOLD_EXPIRED, and
    // the booking is loaded (proving we got past the expiry check).
    vi.mocked(loadBooking).mockResolvedValue({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'cancelled',
    } as never);

    let caught: unknown;
    try {
      await confirmHoldAssignment({ holdId: HOLD_ID, bookingId: BOOKING_ID, client });
    } catch (error) {
      caught = error;
    }

    expect((caught as AssignTablesRpcError | undefined)?.code).not.toBe('HOLD_EXPIRED');
    // It progressed past the expiry gate (booking was loaded).
    expect(loadBooking).toHaveBeenCalled();
  });
});

describe('confirmHoldAssignment booking-state guard (#5)', () => {
  it('rejects confirm on a cancelled booking and does not transition it to confirmed', async () => {
    const rpcCalls: string[] = [];
    const liveHold: HoldFixture = {
      id: HOLD_ID,
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      // Live hold so the expiry guard passes and we reach the state guard.
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      tableIds: ['table-a'],
    };
    const client = createConfirmClient(liveHold, rpcCalls);
    vi.mocked(ensureClient).mockReturnValue(client);

    // Admin cancelled the booking between quote and confirm.
    vi.mocked(loadBooking).mockResolvedValue({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'cancelled',
    } as never);

    let caught: unknown;
    try {
      await confirmHoldAssignment({
        holdId: HOLD_ID,
        bookingId: BOOKING_ID,
        client,
        transition: { targetStatus: 'confirmed', historyReason: 'auto_assign_confirm' },
      });
      throw new Error('expected confirmHoldAssignment to reject on a cancelled booking');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AssignTablesRpcError);
    expect((caught as AssignTablesRpcError).code).toBe('BOOKING_STATE_CONFLICT');

    // Critically: it never attempted the status transition or the confirm RPC,
    // so cancelled is NOT driven to confirmed.
    expect(rpcCalls).not.toContain('apply_booking_state_transition');
    expect(rpcCalls).not.toContain('confirm_hold_assignment_tx');
    expect(rpcCalls).toHaveLength(0);
  });

  it.each(['no_show', 'completed'])(
    'rejects confirm on a %s booking with a state-conflict error',
    async (terminalStatus) => {
      const rpcCalls: string[] = [];
      const liveHold: HoldFixture = {
        id: HOLD_ID,
        bookingId: BOOKING_ID,
        restaurantId: RESTAURANT_ID,
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        tableIds: ['table-a'],
      };
      const client = createConfirmClient(liveHold, rpcCalls);
      vi.mocked(ensureClient).mockReturnValue(client);
      vi.mocked(loadBooking).mockResolvedValue({
        id: BOOKING_ID,
        restaurant_id: RESTAURANT_ID,
        status: terminalStatus,
      } as never);

      await expect(
        confirmHoldAssignment({
          holdId: HOLD_ID,
          bookingId: BOOKING_ID,
          client,
          transition: { targetStatus: 'confirmed', historyReason: 'auto_assign_confirm' },
        }),
      ).rejects.toMatchObject({ code: 'BOOKING_STATE_CONFLICT' });

      expect(rpcCalls).toHaveLength(0);
    },
  );
});
