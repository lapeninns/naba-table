import { describe, expect, it, vi } from 'vitest';

import { applyBookingStateTransition } from '@/server/ops/booking-lifecycle/persistence';

import type { TransitionResult } from '@/server/ops/booking-lifecycle/actions';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const BOOKING = {
  id: 'booking-1',
  status: 'confirmed',
  checked_in_at: null,
  checked_out_at: null,
} satisfies Pick<Tables<'bookings'>, 'id' | 'status' | 'checked_in_at' | 'checked_out_at'>;

const CHECKED_IN_AT = '2026-05-16T19:01:00.000Z';
const UPDATED_AT = '2026-05-16T19:01:01.000Z';

const CHECK_IN_TRANSITION = {
  skipUpdate: false,
  updates: {
    status: 'checked_in',
    checked_in_at: CHECKED_IN_AT,
    checked_out_at: null,
    updated_at: UPDATED_AT,
  },
  history: {
    booking_id: BOOKING.id,
    from_status: 'confirmed',
    to_status: 'checked_in',
    changed_by: 'user-1',
    changed_at: UPDATED_AT,
    reason: null,
    metadata: {
      action: 'check-in',
      performedAt: CHECKED_IN_AT,
    },
  },
  response: {
    status: 'checked_in',
    checkedInAt: CHECKED_IN_AT,
    checkedOutAt: null,
    updatedAt: UPDATED_AT,
  },
} satisfies TransitionResult;

function createSupabaseWithContextSensitiveRpc() {
  const rpc = vi.fn(function (
    this: { rest: { marker: string } },
    fn: string,
    args: Record<string, unknown>,
  ) {
    const marker = this.rest.marker;
    return Promise.resolve({
      data: [
        {
          status: args.p_status,
          checked_in_at: args.p_checked_in_at,
          checked_out_at: args.p_checked_out_at,
          updated_at: args.p_updated_at,
          marker,
        },
      ],
      error: null,
    });
  });

  return {
    supabase: {
      rest: { marker: 'bound-client' },
      rpc,
    } as unknown as DbClient,
    rpc,
  };
}

describe('applyBookingStateTransition', () => {
  it('preserves the Supabase client binding when calling lifecycle RPCs', async () => {
    const { supabase, rpc } = createSupabaseWithContextSensitiveRpc();

    const result = await applyBookingStateTransition({
      supabase,
      booking: BOOKING,
      transition: CHECK_IN_TRANSITION,
    });

    expect(result).toEqual({
      status: 'checked_in',
      checkedInAt: CHECKED_IN_AT,
      checkedOutAt: null,
      updatedAt: UPDATED_AT,
      changed: true,
    });
    expect(rpc).toHaveBeenCalledWith(
      'apply_booking_state_transition',
      expect.objectContaining({
        p_booking_id: BOOKING.id,
        p_status: 'checked_in',
        p_checked_in_at: CHECKED_IN_AT,
        p_checked_out_at: null,
        p_updated_at: UPDATED_AT,
        p_history_from: 'confirmed',
        p_history_to: 'checked_in',
        p_history_changed_by: 'user-1',
        p_history_changed_at: UPDATED_AT,
        p_history_reason: 'status_change',
        p_history_metadata: CHECK_IN_TRANSITION.history.metadata,
      }),
    );
  });

  it('uses the assignment-clearing lifecycle RPC when releaseAssignments is requested', async () => {
    const { supabase, rpc } = createSupabaseWithContextSensitiveRpc();

    await applyBookingStateTransition({
      supabase,
      booking: BOOKING,
      transition: CHECK_IN_TRANSITION,
      releaseAssignments: true,
    });

    expect(rpc).toHaveBeenCalledWith(
      'apply_booking_state_transition_and_clear_assignments',
      expect.any(Object),
    );
  });
});
