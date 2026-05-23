import { getDualSyncDbClient, type DualSyncPublishOperationRow } from '../db';
import {
  type DualSyncGoogleUpdateMask,
  type DualSyncPublishOperation,
  type DualSyncPublishOperationStatus,
  type DualSyncSectionKey,
} from '../types';
import { sanitizeGoogleAuditPayload } from './google-audit';
import { rowToOperation } from './operations-mappers';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface CreateOperationInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly publishBatchId?: string | null;
  readonly operationGroupId?: string | null;
  readonly sectionKey: DualSyncSectionKey;
  readonly fieldKey: string;
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly beforeCoreHash: string | null;
  readonly beforeGbpHash: string | null;
  readonly googleUpdateMask?: DualSyncGoogleUpdateMask | null;
}

export async function createOperation(
  input: CreateOperationInput,
): Promise<DualSyncPublishOperation> {
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_operations')
    .insert({
      restaurant_id: input.restaurantId,
      publish_job_id: input.publishJobId,
      publish_batch_id: input.publishBatchId ?? null,
      operation_group_id: input.operationGroupId ?? null,
      section_key: input.sectionKey,
      field_key: input.fieldKey,
      direction: input.direction,
      status: 'pending' satisfies DualSyncPublishOperationStatus,
      attempt_count: 0,
      before_core_hash: input.beforeCoreHash,
      before_gbp_hash: input.beforeGbpHash,
      google_update_mask: input.googleUpdateMask ?? null,
    } as never)
    .select('*')
    .single<DualSyncPublishOperationRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_publish_operations insert returned no row');
  }
  return rowToOperation(data);
}

export interface UpdateOperationStatusInput {
  readonly client: DbClient;
  readonly operationId: string;
  readonly status: DualSyncPublishOperationStatus;
  readonly afterCoreHash?: string | null;
  readonly afterGbpHash?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly externalResponse?: unknown;
  readonly attemptCount?: number;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export async function updateOperationStatus(
  input: UpdateOperationStatusInput,
): Promise<DualSyncPublishOperation> {
  const dual = getDualSyncDbClient(input.client);
  const patch: Partial<DualSyncPublishOperationRow> = {
    status: input.status,
  };
  if (input.afterCoreHash !== undefined) patch.after_core_hash = input.afterCoreHash;
  if (input.afterGbpHash !== undefined) patch.after_gbp_hash = input.afterGbpHash;
  if (input.errorCode !== undefined) patch.error_code = input.errorCode;
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
  if (input.externalResponse !== undefined)
    patch.external_response = sanitizeGoogleAuditPayload(input.externalResponse) as Json;
  if (input.attemptCount !== undefined) patch.attempt_count = input.attemptCount;
  if (input.startedAt !== undefined) patch.started_at = input.startedAt;
  if (input.finishedAt !== undefined) patch.finished_at = input.finishedAt;

  const { data, error } = await dual
    .from('dual_sync_publish_operations')
    .update(patch as never)
    .eq('id', input.operationId)
    .select('*')
    .single<DualSyncPublishOperationRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_publish_operations update failed for ${input.operationId}`);
  }
  return rowToOperation(data);
}

export interface ListOperationsForJobInput {
  readonly client: DbClient;
  readonly publishJobId: string;
}

export async function listOperationsForJob({
  client,
  publishJobId,
}: ListOperationsForJobInput): Promise<ReadonlyArray<DualSyncPublishOperation>> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_publish_operations')
    .select('*')
    .eq('publish_job_id', publishJobId)
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperation);
}

export interface ListRecentOperationsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  /** Hard cap on the number of rows returned. Defaults to 50, max 200. */
  readonly limit?: number;
  /** Optional ISO-8601 timestamp; rows with `created_at < since` are dropped. */
  readonly since?: string | null;
  /** Optional status filter. */
  readonly statuses?: ReadonlyArray<DualSyncPublishOperationStatus>;
  /** Optional direction filter. */
  readonly direction?: 'import_from_google' | 'export_to_google';
}

/**
 * Restaurant-scoped read of recent `dual_sync_publish_operations` rows
 * for the operations dashboard. Sorted newest-first.
 */
export async function listRecentOperationsForRestaurant(
  input: ListRecentOperationsInput,
): Promise<ReadonlyArray<DualSyncPublishOperation>> {
  const dual = getDualSyncDbClient(input.client);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  let query = dual
    .from('dual_sync_publish_operations')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (input.since) {
    query = query.gte('created_at', input.since);
  }
  if (input.statuses && input.statuses.length > 0) {
    query = query.in('status', input.statuses);
  }
  if (input.direction) {
    query = query.eq('direction', input.direction);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperation);
}
