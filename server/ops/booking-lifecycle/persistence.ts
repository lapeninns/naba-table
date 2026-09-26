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

export type TableRestorationStatus = 'restored' | 'not_needed' | 'unavailable' | 'unknown';

export type UndoNoShowPersistenceResult = BookingStateTransitionPersistenceResult & {
  tableRestoration: {
    status: TableRestorationStatus;
    tableIds: string[];
  };
};

const TABLE_RESTORATION_STATUSES: readonly TableRestorationStatus[] = [
  'restored',
  'not_needed',
  'unavailable',
  'unknown',
];

function toTableRestorationStatus(value: unknown): TableRestorationStatus {
  return TABLE_RESTORATION_STATUSES.find((status) => status === value) ?? 'unknown';
}

/**
 * Undo a no-show in one transaction (`undo_booking_no_show`): compare-and-set no_show ->
 * the prepared status, then re-assign the tables the no-show released when they are all
 * still free. Throws the raw RPC error; callers classify it with `./rpcErrors`.
 */
export async function applyUndoNoShowTransition(input: {
  supabase: DbClient;
  booking: BookingLifecycleRow & { restaurant_id: string };
  transition: TransitionResult;
  sourceHistoryId: number;
}): Promise<UndoNoShowPersistenceResult> {
  const { booking, transition, supabase, sourceHistoryId } = input;
  const historyRecord = transition.history;
  if (transition.skipUpdate || !historyRecord) {
    throw new Error('Undo no-show requires a state change with a history payload');
  }

  const targetStatus = (transition.updates.status ??
    booking.status) as Tables<'bookings'>['status'];
  const updatedAt = transition.updates.updated_at ?? new Date().toISOString();
  const checkedInAt = transition.updates.checked_in_at ?? null;
  const checkedOutAt = transition.updates.checked_out_at ?? null;

  const { data, error } = await supabase.rpc('undo_booking_no_show', {
    p_booking_id: booking.id,
    p_restaurant_id: booking.restaurant_id,
    p_source_history_id: sourceHistoryId,
    p_status: targetStatus,
    p_checked_in_at: checkedInAt,
    p_checked_out_at: checkedOutAt,
    p_updated_at: updatedAt,
    p_history_changed_by: historyRecord.changed_by ?? null,
    p_history_changed_at: historyRecord.changed_at ?? updatedAt,
    p_history_reason: historyRecord.reason ?? 'status_change',
    p_history_metadata: historyRecord.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  const row = data?.[0];
  const restorationStatus = toTableRestorationStatus(row?.table_restoration);
  return {
    status: row?.status ?? targetStatus,
    checkedInAt: row ? row.checked_in_at : checkedInAt,
    checkedOutAt: row ? row.checked_out_at : checkedOutAt,
    updatedAt: row?.updated_at ?? updatedAt,
    changed: true,
    tableRestoration: {
      status: restorationStatus,
      tableIds:
        restorationStatus === 'unknown' || restorationStatus === 'not_needed'
          ? []
          : (row?.released_table_ids ?? []),
    },
  };
}
