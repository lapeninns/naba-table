/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Transactional snapshot runs. Callers wrap a GBP pull in three steps:
 *
 *   1. `openSnapshotRun(...)`        -> insert row with status='pending'
 *   2. perform live pull + canonicalisation
 *   3. `commitSnapshotRun(...)`      -> set status='succeeded' + canonical_snapshot
 *      OR
 *      `failSnapshotRun(...)`        -> set status='failed' + error fields
 *
 * Field-state recomputation reads from the row only when status='succeeded',
 * so a partial pull cannot leave field rows pointing at half-applied data.
 */

import { getDualSyncDbClient, type DualSyncSnapshotRunRow } from '../db';
import {
  DUAL_SYNC_PROVIDER,
  type DualSyncSnapshotRun,
  type DualSyncSnapshotRunKind,
} from '../types';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function rowToRun(row: DualSyncSnapshotRunRow): DualSyncSnapshotRun {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    runKind: row.run_kind,
    status: row.status,
    snapshotHash: row.snapshot_hash,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

export interface OpenSnapshotRunInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly runKind: DualSyncSnapshotRunKind;
}

export async function openSnapshotRun({
  client,
  restaurantId,
  runKind,
}: OpenSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_snapshot_runs')
    .insert({
      restaurant_id: restaurantId,
      provider: DUAL_SYNC_PROVIDER,
      run_kind: runKind,
      status: 'pending',
    } as never)
    .select('*')
    .single<DualSyncSnapshotRunRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_snapshot_runs insert returned no row');
  }
  return rowToRun(data);
}

export interface CommitSnapshotRunInput {
  readonly client: DbClient;
  readonly runId: string;
  readonly canonicalSnapshot: unknown;
  readonly snapshotHash: string;
  readonly rawPayload?: unknown;
}

export async function commitSnapshotRun({
  client,
  runId,
  canonicalSnapshot,
  snapshotHash,
  rawPayload,
}: CommitSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_snapshot_runs')
    .update({
      status: 'succeeded',
      canonical_snapshot: canonicalSnapshot as Json,
      snapshot_hash: snapshotHash,
      raw_payload: rawPayload === undefined ? null : (rawPayload as Json),
      finished_at: new Date().toISOString(),
    } as never)
    .eq('id', runId)
    .select('*')
    .single<DualSyncSnapshotRunRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_snapshot_runs commit failed for run ${runId}`);
  }
  return rowToRun(data);
}

export interface FailSnapshotRunInput {
  readonly client: DbClient;
  readonly runId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export async function failSnapshotRun({
  client,
  runId,
  errorCode,
  errorMessage,
}: FailSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_snapshot_runs')
    .update({
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    } as never)
    .eq('id', runId)
    .select('*')
    .single<DualSyncSnapshotRunRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_snapshot_runs fail failed for run ${runId}`);
  }
  return rowToRun(data);
}

export async function readLatestSucceededRun({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<DualSyncSnapshotRun | null> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_snapshot_runs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('status', 'succeeded')
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }
  const row = data?.[0];
  return row ? rowToRun(row as DualSyncSnapshotRunRow) : null;
}
