/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Transactional snapshot runs. Callers wrap a GBP pull in three steps:
 *
 *   1. `openSnapshotRun(...)`        -> insert row with status='pending'
 *   2. perform live pull + canonicalisation
 *   3. `commitSnapshotRun(...)`      -> set status='succeeded' + hash/shape metadata
 *      OR
 *      `failSnapshotRun(...)`        -> set status='failed' + error fields
 *
 * Field-state recomputation reads from the row only when status='succeeded',
 * so a partial pull cannot leave field rows pointing at half-applied data.
 */

import { safePersistenceErrorCode } from '../publish/persistence-metadata';
import {
  DUAL_SYNC_PROVIDER,
  type DualSyncSnapshotRun,
  type DualSyncSnapshotRunKind,
} from '../types';

import type { DualSyncSnapshotRunRow } from '../db';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type SnapshotRunLike = Omit<DualSyncSnapshotRunRow, 'provider' | 'run_kind' | 'status'> & {
  readonly provider: string;
  readonly run_kind: string;
  readonly status: string;
};

const RUN_KINDS: ReadonlyArray<DualSyncSnapshotRunKind> = [
  'manual',
  'scheduled',
  'location_link',
  'core_write',
  'preflight',
];
const RUN_STATUSES: ReadonlyArray<DualSyncSnapshotRun['status']> = [
  'pending',
  'succeeded',
  'failed',
];

function rowToRun(row: SnapshotRunLike): DualSyncSnapshotRun {
  const runKind = RUN_KINDS.find((value) => value === row.run_kind);
  const status = RUN_STATUSES.find((value) => value === row.status);
  if (row.provider !== DUAL_SYNC_PROVIDER || !runKind || !status) {
    throw new Error('Invalid dual-sync snapshot run row.');
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: DUAL_SYNC_PROVIDER,
    runKind,
    status,
    snapshotHash: row.snapshot_hash,
    errorCode: row.error_code,
    errorMessage: null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

export interface OpenSnapshotRunInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly runKind: DualSyncSnapshotRunKind;
  readonly googleFence?: GoogleContentFence;
  readonly startedAt?: string;
  readonly runId?: string;
}

export async function openSnapshotRun({
  client,
  restaurantId,
  runKind,
  googleFence,
  startedAt = new Date().toISOString(),
  runId = crypto.randomUUID(),
}: OpenSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  if (!googleFence || googleFence.restaurantId !== restaurantId) {
    throw new Error('Google snapshot run requires an exact connection fence.');
  }
  const { data, error } = await client.rpc('begin_gbp_dual_sync_snapshot_run_v1', {
    p_restaurant_id: restaurantId,
    p_external_profile_row_id: googleFence.externalProfileRowId,
    p_external_account_id: googleFence.accountId,
    p_external_profile_id: googleFence.profileId,
    p_external_location_id: googleFence.locationId,
    p_connection_generation: googleFence.connectionGeneration,
    p_consent_epoch: googleFence.consentEpoch,
    p_run_id: runId,
    p_run_kind: runKind,
    p_started_at: startedAt,
  });
  if (error) throw error;
  if (!data) throw new Error('Atomic Google snapshot begin returned no row.');
  return rowToRun(data);
}

export interface CommitSnapshotRunInput {
  readonly client: DbClient;
  readonly runId: string;
  readonly canonicalSnapshot: unknown;
  readonly snapshotHash: string;
  readonly rawPayload?: Json;
  readonly googleFence?: GoogleContentFence;
  readonly observedAt?: string;
  readonly runKind?: DualSyncSnapshotRunKind;
}

export type GoogleContentFence = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly accountId: string;
  readonly profileId: string;
  readonly locationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

export async function resolveGoogleContentFence({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<GoogleContentFence> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select(
      'id, external_account_id, external_profile_id, external_location_id, connection_generation, consent_epoch',
    )
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('connection_status', 'linked')
    .maybeSingle();
  if (
    error ||
    !data ||
    !data.external_account_id ||
    !data.external_profile_id ||
    !data.external_location_id ||
    data.connection_generation <= 0 ||
    data.consent_epoch <= 0
  ) {
    throw new Error('Current Google snapshot connection fence is unavailable.');
  }
  return {
    restaurantId,
    externalProfileRowId: data.id,
    accountId: data.external_account_id,
    profileId: data.external_profile_id,
    locationId: data.external_location_id,
    connectionGeneration: data.connection_generation,
    consentEpoch: data.consent_epoch,
  };
}

export async function commitSnapshotRun({
  client,
  runId,
  rawPayload,
  googleFence,
  observedAt,
  runKind,
}: CommitSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  if (!googleFence || !observedAt || !runKind || rawPayload === undefined) {
    throw new Error('Fresh Google snapshot content requires an exact lineage fence.');
  }
  if (!Number.isFinite(new Date(observedAt).getTime())) {
    throw new Error('Fresh Google snapshot observation time is invalid.');
  }
  const { data, error } = await client.rpc('persist_gbp_dual_sync_snapshot_run_v1', {
    p_restaurant_id: googleFence.restaurantId,
    p_external_profile_row_id: googleFence.externalProfileRowId,
    p_external_account_id: googleFence.accountId,
    p_external_profile_id: googleFence.profileId,
    p_external_location_id: googleFence.locationId,
    p_connection_generation: googleFence.connectionGeneration,
    p_consent_epoch: googleFence.consentEpoch,
    p_run_id: runId,
    p_run_kind: runKind,
    p_raw_payload: rawPayload,
    p_observed_at: observedAt,
  });
  if (error) throw error;
  if (!data) throw new Error('Atomic Google snapshot persistence returned no row.');
  return rowToRun(data);
}

export interface FailSnapshotRunInput {
  readonly client: DbClient;
  readonly runId: string;
  readonly restaurantId?: string;
  readonly googleFence?: GoogleContentFence;
  readonly runKind?: DualSyncSnapshotRunKind;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export async function failSnapshotRun({
  client,
  runId,
  restaurantId,
  googleFence,
  runKind,
  errorCode,
}: FailSnapshotRunInput): Promise<DualSyncSnapshotRun> {
  if (!restaurantId || !googleFence || !runKind || googleFence.restaurantId !== restaurantId) {
    throw new Error('Google snapshot failure requires an exact connection fence.');
  }
  const { data, error } = await client.rpc('fail_gbp_dual_sync_snapshot_run_v1', {
    p_restaurant_id: restaurantId,
    p_external_profile_row_id: googleFence.externalProfileRowId,
    p_external_account_id: googleFence.accountId,
    p_external_profile_id: googleFence.profileId,
    p_external_location_id: googleFence.locationId,
    p_connection_generation: googleFence.connectionGeneration,
    p_consent_epoch: googleFence.consentEpoch,
    p_run_id: runId,
    p_run_kind: runKind,
    p_error_code: safePersistenceErrorCode(errorCode) ?? 'DUAL_SYNC_SNAPSHOT_FAILED',
    p_finished_at: new Date().toISOString(),
  });
  if (error) throw error;
  if (!data) throw new Error('Atomic Google snapshot failure returned no row.');
  return rowToRun(data);
}

export async function readLatestSucceededRun({
  client,
  googleFence,
  runKind,
  now = new Date().toISOString(),
}: {
  readonly client: DbClient;
  readonly googleFence?: GoogleContentFence;
  readonly restaurantId?: string;
  readonly runKind?: DualSyncSnapshotRunKind;
  readonly now?: string;
}): Promise<DualSyncSnapshotRun | null> {
  if (!googleFence) return null;
  const { data, error } = await client.rpc('get_current_gbp_dual_sync_snapshot_runs_v1', {
    p_restaurant_id: googleFence.restaurantId,
    p_external_profile_row_id: googleFence.externalProfileRowId,
    p_external_account_id: googleFence.accountId,
    p_external_profile_id: googleFence.profileId,
    p_external_location_id: googleFence.locationId,
    p_connection_generation: googleFence.connectionGeneration,
    p_consent_epoch: googleFence.consentEpoch,
    p_run_kind: runKind ?? null,
    p_now: now,
  });
  if (error) throw error;
  const row = data?.[0];
  return row ? rowToRun(row) : null;
}
