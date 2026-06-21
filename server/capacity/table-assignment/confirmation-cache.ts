import { applyAbortSignal, type DbClient } from './supabase';

import type { TableAssignmentMember } from './types';

export type LoadCachedConfirmationParams = {
  supabase: DbClient;
  bookingId: string;
  holdId: string;
  restaurantId: string;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
};

export async function loadCachedConfirmationResult(
  params: LoadCachedConfirmationParams,
): Promise<TableAssignmentMember[] | null> {
  const { supabase, bookingId, holdId, restaurantId, idempotencyKey, signal } = params;
  let confirmationQuery = applyAbortSignal(
    supabase
      .from('booking_confirmation_results')
      .select('idempotency_key')
      .eq('booking_id', bookingId)
      .eq('hold_id', holdId)
      .eq('restaurant_id', restaurantId)
      .limit(1),
    signal,
  );

  if (idempotencyKey) {
    confirmationQuery = confirmationQuery.eq('idempotency_key', idempotencyKey);
  }

  const { data: confirmation, error: confirmationError } = await confirmationQuery.maybeSingle();
  if (confirmationError || !confirmation) {
    return null;
  }

  const cachedKey = confirmation.idempotency_key;
  // Idempotency guard: only serve a cached confirmation when its key matches the
  // request key. When the request omits a key, do NOT serve a row that was keyed
  // with a different non-null key (treat as a cache miss) so confirmations with
  // distinct keys never share assignments.
  const requestKey = idempotencyKey ?? null;
  if ((cachedKey ?? null) !== requestKey) {
    return null;
  }
  const assignmentsQuery = applyAbortSignal(
    supabase
      .from('booking_table_assignments')
      .select('id, table_id, start_at, end_at, merge_group_id')
      .eq('booking_id', bookingId)
      .eq('hold_id', holdId)
      .eq('restaurant_id', restaurantId)
      .eq('idempotency_key', cachedKey),
    signal,
  );
  const { data: rows, error: assignmentsError } = await assignmentsQuery;
  if (assignmentsError || !Array.isArray(rows) || rows.length === 0) {
    console.warn('[capacity.confirm] confirmation cache missing assignments', {
      bookingId,
      holdId,
      idempotencyKey: cachedKey,
      error: assignmentsError?.message ?? assignmentsError ?? null,
    });
    return null;
  }

  return rows.map((row) => ({
    tableId: row.table_id,
    assignmentId: row.id ?? '',
    startAt: row.start_at ?? '',
    endAt: row.end_at ?? '',
    mergeGroupId: row.merge_group_id ?? null,
  }));
}
