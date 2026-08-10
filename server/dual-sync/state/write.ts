/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Field-state write helpers. Centralises every transition into
 * `dual_sync_field_states` so callers (Core writers, GBP refresh,
 * publish orchestrator) cannot accidentally write inconsistent rows.
 *
 * The functions here perform service-role upserts via the typed adapter
 * in `./db.ts`. They are deliberately thin: state derivation lives in
 * `compute.ts`, hashing lives in `../hashing.ts`, and policy/conflict
 * decisions live in the registry.
 */

import { getDualSyncDbClient, type DualSyncFieldStateRow } from '../db';
import { metadataOnlySummary } from '../publish/persistence-metadata';
import { DUAL_SYNC_PROVIDER, type DualSyncFieldState, type DualSyncSectionKey } from '../types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface UpsertFieldStateInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
  readonly state: DualSyncFieldState;
  readonly coreValueHash?: string | null;
  readonly gbpValueHash?: string | null;
  readonly lastInSyncHash?: string | null;
  readonly lastInSyncAt?: string | null;
  readonly lastCoreChangeAt?: string | null;
  readonly lastGbpChangeAt?: string | null;
  readonly lastSnapshotRunId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export async function upsertFieldState(
  input: UpsertFieldStateInput,
): Promise<DualSyncFieldStateRow> {
  const dual = getDualSyncDbClient(input.client);
  const payload: Partial<DualSyncFieldStateRow> &
    Pick<DualSyncFieldStateRow, 'restaurant_id' | 'section_key' | 'field_key'> = {
    restaurant_id: input.restaurantId,
    provider: DUAL_SYNC_PROVIDER,
    section_key: input.sectionKey,
    field_key: input.fieldKey,
    state: input.state,
  };
  if (input.coreValueHash !== undefined) payload.core_value_hash = input.coreValueHash;
  if (input.gbpValueHash !== undefined) payload.gbp_value_hash = input.gbpValueHash;
  if (input.lastInSyncHash !== undefined) payload.last_in_sync_hash = input.lastInSyncHash;
  if (input.lastInSyncAt !== undefined) payload.last_in_sync_at = input.lastInSyncAt;
  if (input.lastCoreChangeAt !== undefined) payload.last_core_change_at = input.lastCoreChangeAt;
  if (input.lastGbpChangeAt !== undefined) payload.last_gbp_change_at = input.lastGbpChangeAt;
  if (input.lastSnapshotRunId !== undefined) payload.last_snapshot_run_id = input.lastSnapshotRunId;
  if (input.metadata !== undefined) payload.metadata = metadataOnlySummary(input.metadata);

  const { data, error } = await dual
    .from('dual_sync_field_states')
    .upsert(payload as never, { onConflict: 'restaurant_id,provider,field_key' })
    .select('*')
    .single<DualSyncFieldStateRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_field_states upsert returned no row');
  }
  return data;
}

export async function markCoreDirty({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
  coreValueHash,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
  readonly coreValueHash: string | null;
}): Promise<DualSyncFieldStateRow> {
  return upsertFieldState({
    client,
    restaurantId,
    sectionKey,
    fieldKey,
    state: 'core_dirty',
    coreValueHash,
    lastCoreChangeAt: new Date().toISOString(),
  });
}

export async function markIgnored({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
}): Promise<DualSyncFieldStateRow> {
  return upsertFieldState({
    client,
    restaurantId,
    sectionKey,
    fieldKey,
    state: 'ignored',
  });
}

export async function markPending({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
  direction,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
  readonly direction: 'import' | 'export';
}): Promise<DualSyncFieldStateRow> {
  return upsertFieldState({
    client,
    restaurantId,
    sectionKey,
    fieldKey,
    state: direction === 'import' ? 'pending_import' : 'pending_export',
  });
}

export async function markFailed({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
  direction,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
  readonly direction: 'import' | 'export';
}): Promise<DualSyncFieldStateRow> {
  return upsertFieldState({
    client,
    restaurantId,
    sectionKey,
    fieldKey,
    state: direction === 'import' ? 'import_failed' : 'export_failed',
  });
}

export async function markInSync({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
  inSyncHash,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey | 'core_only';
  readonly fieldKey: string;
  readonly inSyncHash: string | null;
}): Promise<DualSyncFieldStateRow> {
  return upsertFieldState({
    client,
    restaurantId,
    sectionKey,
    fieldKey,
    state: 'in_sync',
    coreValueHash: inSyncHash,
    gbpValueHash: inSyncHash,
    lastInSyncHash: inSyncHash,
    lastInSyncAt: new Date().toISOString(),
  });
}
