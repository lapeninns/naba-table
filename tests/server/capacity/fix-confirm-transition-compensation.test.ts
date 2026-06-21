import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssignTablesRpcError } from '@/server/capacity/holds';

/**
 * Regression for confirm-fallback gap #1 (retry + compensation can destroy a
 * confirmed booking).
 *
 * The legacy (non-atomic RPC) confirm path transitions booking status via
 * apply_booking_state_transition, which matches on the booking's *original*
 * status and is therefore NOT idempotent. If a prior attempt committed but lost
 * its response, or a concurrent actor already advanced the booking, the retry
 * re-issues with the stale `p_history_from` and the RPC raises
 * booking_state_conflict (P0004). The pre-fix code then ran
 * unassign_tables_atomic unconditionally — ripping tables off a booking that was
 * in fact already confirmed.
 *
 * The fix re-reads the booking before compensating: it only unassigns when it
 * has POSITIVELY observed the booking is not at the target status, and otherwise
 * treats the transition as already-applied (or, on an unreadable re-read, leaves
 * the assignment intact rather than risk corrupting a confirmed booking).
 */

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

import { applyConfirmStatusTransition } from '@/server/capacity/table-assignment/assignment';
import { recordObservabilityEvent } from '@/server/observability';

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };
type RpcCall = { name: string; args: Record<string, unknown> };

function createClient(opts: {
  transition: RpcResult[]; // one entry per attempt (last entry repeats)
  reread: { data: { status: string } | null; error: { message: string } | null };
  unassign?: RpcResult | (() => never);
}) {
  const rpcCalls: RpcCall[] = [];
  let attempt = 0;

  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>): Promise<RpcResult> => {
      rpcCalls.push({ name, args });
      if (name === 'apply_booking_state_transition') {
        const idx = Math.min(attempt, opts.transition.length - 1);
        attempt += 1;
        return opts.transition[idx];
      }
      if (name === 'unassign_tables_atomic') {
        if (typeof opts.unassign === 'function') {
          return opts.unassign();
        }
        return opts.unassign ?? { data: null, error: null };
      }
      return { data: null, error: null };
    }),
    from: (_table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => opts.reread;
      return builder;
    },
  };

  return { client: client as never, rpcCalls };
}

function makeBooking() {
  return {
    id: 'booking-1',
    restaurant_id: 'restaurant-1',
    status: 'pending_allocation',
    checked_in_at: null,
    checked_out_at: null,
  } as never;
}

const TRANSITION = { targetStatus: 'confirmed', historyReason: 'auto_assign_confirm' } as never;

function countRpc(calls: RpcCall[], name: string): number {
  return calls.filter((c) => c.name === name).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // vitest.config sets mockReset:true, which wipes factory return values.
  vi.mocked(recordObservabilityEvent).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyConfirmStatusTransition compensation safety (#1)', () => {
  it('treats P0004 as already-applied when the booking is observed at the target — no unassign, no throw', async () => {
    const { client, rpcCalls } = createClient({
      transition: [{ data: null, error: { code: 'P0004', message: 'booking_state_conflict' } }],
      reread: { data: { status: 'confirmed' }, error: null },
    });
    const booking = makeBooking();

    await expect(
      applyConfirmStatusTransition({
        supabase: client,
        booking,
        transition: TRANSITION,
        normalizedTableIds: ['table-a'],
        holdId: 'hold-1',
      }),
    ).resolves.toBeUndefined();

    // The booking was already confirmed: we must NOT strip its tables.
    expect(countRpc(rpcCalls, 'unassign_tables_atomic')).toBe(0);
    // P0004 is non-retryable, so exactly one transition attempt.
    expect(countRpc(rpcCalls, 'apply_booking_state_transition')).toBe(1);
    // booking is reconciled to the observed/target status.
    expect((booking as { status: string }).status).toBe('confirmed');
  });

  it('compensates only when the booking is positively observed NOT at the target', async () => {
    const { client, rpcCalls } = createClient({
      transition: [{ data: null, error: { code: 'P0004', message: 'booking_state_conflict' } }],
      // A concurrent actor moved the booking somewhere else (e.g. cancelled).
      reread: { data: { status: 'cancelled' }, error: null },
    });
    const booking = makeBooking();

    await expect(
      applyConfirmStatusTransition({
        supabase: client,
        booking,
        transition: TRANSITION,
        normalizedTableIds: ['table-a', 'table-b'],
        holdId: 'hold-1',
      }),
    ).rejects.toBeInstanceOf(AssignTablesRpcError);

    // Genuine conflict: tables are rolled back from the non-target booking.
    expect(countRpc(rpcCalls, 'unassign_tables_atomic')).toBe(1);
    const unassign = rpcCalls.find((c) => c.name === 'unassign_tables_atomic');
    expect(unassign?.args).toMatchObject({
      p_booking_id: 'booking-1',
      p_table_ids: ['table-a', 'table-b'],
    });
  });

  it('does NOT compensate when the re-read fails — never risks unassigning a possibly-confirmed booking', async () => {
    const { client, rpcCalls } = createClient({
      transition: [{ data: null, error: { code: '57014', message: 'statement timeout' } }],
      reread: { data: null, error: { message: 'connection reset' } },
    });
    const booking = makeBooking();

    await expect(
      applyConfirmStatusTransition({
        supabase: client,
        booking,
        transition: TRANSITION,
        normalizedTableIds: ['table-a'],
        holdId: 'hold-1',
      }),
    ).rejects.toBeInstanceOf(AssignTablesRpcError);

    // Re-read inconclusive => leave the assignment in place (recoverable state)
    // rather than unassign a booking that might be confirmed.
    expect(countRpc(rpcCalls, 'unassign_tables_atomic')).toBe(0);
  });

  it('retries transient (no-code) errors up to the bound, then succeeds if the booking landed at target', async () => {
    const networkErr: RpcResult = { data: null, error: { message: 'socket hang up' } };
    const { client, rpcCalls } = createClient({
      transition: [networkErr], // repeats for every attempt
      reread: { data: { status: 'confirmed' }, error: null },
    });
    const booking = makeBooking();

    await expect(
      applyConfirmStatusTransition({
        supabase: client,
        booking,
        transition: TRANSITION,
        normalizedTableIds: ['table-a'],
        holdId: 'hold-1',
      }),
    ).resolves.toBeUndefined();

    // No PG code => transient => retried up to the bound (3 attempts total).
    expect(countRpc(rpcCalls, 'apply_booking_state_transition')).toBe(3);
    expect(countRpc(rpcCalls, 'unassign_tables_atomic')).toBe(0);
    expect((booking as { status: string }).status).toBe('confirmed');
  });

  it('applies a clean transition without re-read or compensation on success', async () => {
    const { client, rpcCalls } = createClient({
      transition: [
        {
          data: [
            {
              status: 'confirmed',
              checked_in_at: null,
              checked_out_at: null,
              updated_at: '2026-06-21T00:00:00.000Z',
            },
          ],
          error: null,
        },
      ],
      reread: { data: { status: 'pending_allocation' }, error: null }, // must NOT be consulted
    });
    const booking = makeBooking();

    await applyConfirmStatusTransition({
      supabase: client,
      booking,
      transition: TRANSITION,
      normalizedTableIds: ['table-a'],
      holdId: 'hold-1',
    });

    expect(countRpc(rpcCalls, 'apply_booking_state_transition')).toBe(1);
    expect(countRpc(rpcCalls, 'unassign_tables_atomic')).toBe(0);
    expect((booking as { status: string }).status).toBe('confirmed');
  });

  it('no-ops when the booking is already at the target status', async () => {
    const { client, rpcCalls } = createClient({
      transition: [{ data: null, error: { code: 'P0004' } }],
      reread: { data: { status: 'confirmed' }, error: null },
    });
    const booking = makeBooking();
    (booking as { status: string }).status = 'confirmed';

    await applyConfirmStatusTransition({
      supabase: client,
      booking,
      transition: TRANSITION,
      normalizedTableIds: ['table-a'],
      holdId: 'hold-1',
    });

    // Already at target: no RPC at all.
    expect(rpcCalls).toHaveLength(0);
  });
});
