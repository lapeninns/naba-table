import type { TransitionResult } from './actions';
import type { Database, Json, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type BookingLifecycleRow = Pick<
  Tables<'bookings'>,
  'id' | 'status' | 'checked_in_at' | 'checked_out_at'
>;

export type BookingStateTransitionPersistenceResult = {
  status: Tables<'bookings'>['status'];
  checkedInAt: string | null;
  checkedOutAt: string | null;
  updatedAt: string | null;
  changed: boolean;
};

type BookingStateTransitionRpcResult = {
  status: Tables<'bookings'>['status'];
  checked_in_at: string | null;
  checked_out_at: string | null;
  updated_at: string | null;
};

type BookingStateTransitionRpcArgs = {
  p_booking_id: string;
  p_status: Tables<'bookings'>['status'];
  p_checked_in_at: string | null;
  p_checked_out_at: string | null;
  p_updated_at: string;
  p_history_from: Tables<'bookings'>['status'];
  p_history_to: Tables<'bookings'>['status'];
  p_history_changed_by: string | null;
  p_history_changed_at: string;
  p_history_reason: string;
  p_history_metadata: Json;
};

type UntypedStateTransitionRpc = (
  fn: 'apply_booking_state_transition' | 'apply_booking_state_transition_and_clear_assignments',
  args: BookingStateTransitionRpcArgs,
) => Promise<{ data: BookingStateTransitionRpcResult[] | null; error: Error | null }>;

export async function applyBookingStateTransition(input: {
  supabase: DbClient;
  booking: BookingLifecycleRow;
  transition: TransitionResult;
  releaseAssignments?: boolean;
}): Promise<BookingStateTransitionPersistenceResult> {
  const { booking, transition, supabase, releaseAssignments = false } = input;

  if (transition.skipUpdate) {
    return {
      status: transition.response.status,
      checkedInAt: transition.response.checkedInAt ?? null,
      checkedOutAt: transition.response.checkedOutAt ?? null,
      updatedAt: transition.response.updatedAt ?? null,
      changed: false,
    };
  }

  const historyRecord = transition.history;
  if (!historyRecord) {
    throw new Error('Missing history payload for transition');
  }

  const targetStatus = (transition.updates.status ??
    booking.status) as Tables<'bookings'>['status'];
  const finalCheckedInAt =
    transition.updates.checked_in_at !== undefined
      ? (transition.updates.checked_in_at ?? null)
      : (booking.checked_in_at ?? null);
  const finalCheckedOutAt =
    transition.updates.checked_out_at !== undefined
      ? (transition.updates.checked_out_at ?? null)
      : (booking.checked_out_at ?? null);
  const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();
  const args = {
    p_booking_id: booking.id,
    p_status: targetStatus,
    p_checked_in_at: finalCheckedInAt,
    p_checked_out_at: finalCheckedOutAt,
    p_updated_at: finalUpdatedAt,
    p_history_from: (historyRecord.from_status ?? booking.status) as Tables<'bookings'>['status'],
    p_history_to: historyRecord.to_status,
    p_history_changed_by: historyRecord.changed_by ?? null,
    p_history_changed_at: historyRecord.changed_at ?? finalUpdatedAt,
    p_history_reason: historyRecord.reason ?? 'status_change',
    p_history_metadata: historyRecord.metadata ?? {},
  } satisfies BookingStateTransitionRpcArgs;

  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedStateTransitionRpc;
  const { data, error } = await rpc(
    releaseAssignments
      ? 'apply_booking_state_transition_and_clear_assignments'
      : 'apply_booking_state_transition',
    args,
  );

  if (error) {
    throw error;
  }

  const resultRow = data?.[0];
  return {
    status: resultRow?.status ?? targetStatus,
    checkedInAt: resultRow?.checked_in_at ?? finalCheckedInAt,
    checkedOutAt: resultRow?.checked_out_at ?? finalCheckedOutAt,
    updatedAt: resultRow?.updated_at ?? finalUpdatedAt,
    changed: true,
  };
}
