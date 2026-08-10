import { getDualSyncDbClient, type DualSyncPublishBatchRow } from '../db';
import { type DualSyncPublishBatch, type DualSyncPublishBatchStatus } from '../types';
import { rowToBatch } from './operations-mappers';
import { metadataOnlySummary, safePersistenceErrorCode } from './persistence-metadata';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface CreatePublishBatchInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly clientRequestId?: string | null;
  readonly actorUserId: string | null;
  readonly decisionHash: string;
  readonly pinnedCoreSnapshotHash?: string | null;
  readonly pinnedGbpSnapshotHash?: string | null;
  readonly coreSnapshotHash?: string | null;
  readonly gbpSnapshotHash?: string | null;
  readonly fieldPolicyVersionId?: string | null;
  readonly fieldPolicyHash?: string | null;
  readonly acceptedCount?: number;
  readonly rejectedCount?: number;
  readonly ignoredCount?: number;
  readonly planSummary?: unknown;
}

export async function createPublishBatch(
  input: CreatePublishBatchInput,
): Promise<DualSyncPublishBatch> {
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_batches')
    .insert({
      restaurant_id: input.restaurantId,
      client_request_id: input.clientRequestId ?? null,
      actor_user_id: input.actorUserId,
      status: 'pending' satisfies DualSyncPublishBatchStatus,
      decision_hash: input.decisionHash,
      pinned_core_snapshot_hash: input.pinnedCoreSnapshotHash ?? null,
      pinned_gbp_snapshot_hash: input.pinnedGbpSnapshotHash ?? null,
      core_snapshot_hash: input.coreSnapshotHash ?? null,
      gbp_snapshot_hash: input.gbpSnapshotHash ?? null,
      field_policy_version_id: input.fieldPolicyVersionId ?? null,
      field_policy_hash: input.fieldPolicyHash ?? null,
      accepted_count: input.acceptedCount ?? 0,
      rejected_count: input.rejectedCount ?? 0,
      ignored_count: input.ignoredCount ?? 0,
      plan_summary: metadataOnlySummary(input.planSummary ?? {}),
    } as never)
    .select('*')
    .single<DualSyncPublishBatchRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_publish_batches insert returned no row');
  }
  return rowToBatch(data);
}

export interface FindPublishBatchByClientRequestInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly clientRequestId: string;
}

export async function findPublishBatchByClientRequest({
  client,
  restaurantId,
  clientRequestId,
}: FindPublishBatchByClientRequestInput): Promise<DualSyncPublishBatch | null> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_publish_batches')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle<DualSyncPublishBatchRow>();
  if (error) {
    throw error;
  }
  return data ? rowToBatch(data) : null;
}

export interface UpdatePublishBatchStatusInput {
  readonly client: DbClient;
  readonly publishBatchId: string;
  readonly status: DualSyncPublishBatchStatus;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export async function updatePublishBatchStatus(
  input: UpdatePublishBatchStatusInput,
): Promise<DualSyncPublishBatch> {
  const dual = getDualSyncDbClient(input.client);
  const patch: Partial<DualSyncPublishBatchRow> = {
    status: input.status,
  };
  if (input.errorCode !== undefined) patch.error_code = safePersistenceErrorCode(input.errorCode);
  if (input.errorMessage !== undefined) patch.error_message = null;
  if (input.startedAt !== undefined) patch.started_at = input.startedAt;
  if (input.finishedAt !== undefined) patch.finished_at = input.finishedAt;

  const { data, error } = await dual
    .from('dual_sync_publish_batches')
    .update(patch as never)
    .eq('id', input.publishBatchId)
    .select('*')
    .single<DualSyncPublishBatchRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_publish_batches update failed for ${input.publishBatchId}`);
  }
  return rowToBatch(data);
}

export interface ListPublishBatchesByIdsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchIds: ReadonlyArray<string>;
}

export async function listPublishBatchesByIds(
  input: ListPublishBatchesByIdsInput,
): Promise<ReadonlyArray<DualSyncPublishBatch>> {
  const ids = Array.from(new Set(input.publishBatchIds.filter((id) => id.length > 0)));
  if (ids.length === 0) return [];
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_batches')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .in('id', ids);
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToBatch);
}
