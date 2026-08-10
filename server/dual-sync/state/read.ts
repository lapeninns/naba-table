/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Field-state read helpers. Returns persisted rows from
 * `public.dual_sync_field_states` mapped to the canonical
 * `DualSyncFieldStateRecord` shape. UI hooks and preflight callers should
 * be the only consumers.
 */

import { getDualSyncDbClient, type DualSyncFieldStateRow } from '../db';
import { metadataOnlyRecord } from '../publish/persistence-metadata';
import {
  DUAL_SYNC_PROVIDER,
  type DualSyncFieldStateSectionKey,
  isDualSyncFieldState,
  isDualSyncSectionKey,
  type DualSyncFieldStateRecord,
} from '../types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function isDualSyncFieldStateSectionKey(value: unknown): value is DualSyncFieldStateSectionKey {
  return value === 'core_only' || isDualSyncSectionKey(value);
}

export interface ListFieldStatesInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey?: string;
}

function rowToRecord(row: DualSyncFieldStateRow): DualSyncFieldStateRecord {
  if (!isDualSyncFieldStateSectionKey(row.section_key)) {
    throw new Error(`dual_sync_field_states: unexpected section_key ${row.section_key}`);
  }
  if (!isDualSyncFieldState(row.state)) {
    throw new Error(`dual_sync_field_states: unexpected state ${row.state}`);
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    sectionKey: row.section_key,
    fieldKey: row.field_key,
    state: row.state,
    coreValueHash: row.core_value_hash,
    gbpValueHash: row.gbp_value_hash,
    lastInSyncHash: row.last_in_sync_hash,
    lastCoreChangeAt: row.last_core_change_at,
    lastGbpChangeAt: row.last_gbp_change_at,
    lastInSyncAt: row.last_in_sync_at,
    lastSnapshotRunId: row.last_snapshot_run_id,
    metadata: metadataOnlyRecord(row.metadata ?? {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFieldStates({
  client,
  restaurantId,
  sectionKey,
}: ListFieldStatesInput): Promise<ReadonlyArray<DualSyncFieldStateRecord>> {
  const dual = getDualSyncDbClient(client);
  let query = dual
    .from('dual_sync_field_states')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .order('section_key', { ascending: true })
    .order('field_key', { ascending: true });

  if (sectionKey) {
    query = query.eq('section_key', sectionKey);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToRecord);
}

export async function readFieldState({
  client,
  restaurantId,
  fieldKey,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly fieldKey: string;
}): Promise<DualSyncFieldStateRecord | null> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_field_states')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('field_key', fieldKey)
    .maybeSingle<DualSyncFieldStateRow>();
  if (error) {
    throw error;
  }
  return data ? rowToRecord(data) : null;
}
