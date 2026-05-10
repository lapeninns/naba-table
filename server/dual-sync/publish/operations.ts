/**
 * Phase 3 of the unified dual-sync engine.
 *
 * CRUD on `dual_sync_publish_operations`. One row per (publish_job_id,
 * field_key) is created at job start; status transitions follow the
 * orchestrator lifecycle: pending -> running -> succeeded | failed |
 * skipped | retrying.
 */

import {
  getDualSyncDbClient,
  type DualSyncPublishBatchRow,
  type DualSyncPublishOperationGroupRow,
  type DualSyncPublishOperationRow,
} from '../db';
import {
  type DualSyncGoogleUpdateMask,
  type DualSyncPublishBatch,
  type DualSyncPublishBatchStatus,
  type DualSyncPublishOperationGroup,
  type DualSyncPublishOperationGroupStatus,
  type DualSyncPublishOperation,
  type DualSyncPublishOperationStatus,
  type DualSyncSectionKey,
  isDualSyncSectionKey,
} from '../types';
import { sanitizeGoogleAuditPayload } from './google-audit';

import type { DualSyncPublishGroup } from './types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function rowToBatch(row: DualSyncPublishBatchRow): DualSyncPublishBatch {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    clientRequestId: row.client_request_id,
    actorUserId: row.actor_user_id,
    status: row.status,
    decisionHash: row.decision_hash,
    pinnedCoreSnapshotHash: row.pinned_core_snapshot_hash,
    pinnedGbpSnapshotHash: row.pinned_gbp_snapshot_hash,
    coreSnapshotHash: row.core_snapshot_hash,
    gbpSnapshotHash: row.gbp_snapshot_hash,
    fieldPolicyVersionId: row.field_policy_version_id,
    fieldPolicyHash: row.field_policy_hash,
    acceptedCount: row.accepted_count,
    rejectedCount: row.rejected_count,
    ignoredCount: row.ignored_count,
    planSummary: row.plan_summary ?? {},
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOperationGroup(row: DualSyncPublishOperationGroupRow): DualSyncPublishOperationGroup {
  if (!isDualSyncSectionKey(row.section_key)) {
    throw new Error(
      `dual_sync_publish_operation_groups: unexpected section_key ${row.section_key}`,
    );
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    publishBatchId: row.publish_batch_id,
    groupKey: row.group_key,
    sectionKey: row.section_key,
    direction: row.direction,
    writeGroup: row.write_group,
    status: row.status,
    riskLevel: row.risk_level,
    requiresPreflight: row.requires_preflight,
    requiresManualConfirmation: row.requires_manual_confirmation,
    destructiveWritePossible: row.destructive_write_possible,
    googleUpdateMasks: row.google_update_masks as DualSyncGoogleUpdateMask[],
    decisionCount: row.decision_count,
    preflightStatus: row.preflight_status,
    preflightResult: row.preflight_result ?? null,
    requestSummary: row.request_summary ?? null,
    responseSummary: row.response_summary ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOperation(row: DualSyncPublishOperationRow): DualSyncPublishOperation {
  if (!isDualSyncSectionKey(row.section_key)) {
    throw new Error(`dual_sync_publish_operations: unexpected section_key ${row.section_key}`);
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    publishJobId: row.publish_job_id,
    publishBatchId: row.publish_batch_id ?? null,
    operationGroupId: row.operation_group_id ?? null,
    sectionKey: row.section_key,
    fieldKey: row.field_key,
    direction: row.direction,
    status: row.status,
    attemptCount: row.attempt_count,
    beforeCoreHash: row.before_core_hash,
    beforeGbpHash: row.before_gbp_hash,
    afterCoreHash: row.after_core_hash,
    afterGbpHash: row.after_gbp_hash,
    googleUpdateMask: (row.google_update_mask as DualSyncGoogleUpdateMask | null) ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    externalResponse: row.external_response ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
      plan_summary: (input.planSummary ?? {}) as Json,
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
  if (input.errorCode !== undefined) patch.error_code = input.errorCode;
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
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

export interface CreateOperationGroupsForPlanInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchId: string;
  readonly groups: ReadonlyArray<DualSyncPublishGroup>;
}

export async function createOperationGroupsForPlan(
  input: CreateOperationGroupsForPlanInput,
): Promise<ReadonlyArray<DualSyncPublishOperationGroup>> {
  if (input.groups.length === 0) return [];
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .insert(
      input.groups.map((group) => ({
        restaurant_id: input.restaurantId,
        publish_batch_id: input.publishBatchId,
        group_key: group.groupId,
        section_key: group.sectionKey,
        direction: group.direction,
        write_group: group.writeGroup,
        status: 'pending' satisfies DualSyncPublishOperationGroupStatus,
        risk_level: group.riskLevel,
        requires_preflight: group.requiresPreflight,
        requires_manual_confirmation: group.requiresManualConfirmation,
        destructive_write_possible: group.destructiveWritePossible,
        google_update_masks: [...group.googleUpdateMasks],
        decision_count: group.fields.length,
      })) as never,
    )
    .select('*');
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperationGroup);
}

export interface UpdateOperationGroupStatusInput {
  readonly client: DbClient;
  readonly operationGroupId: string;
  readonly status: DualSyncPublishOperationGroupStatus;
  readonly preflightStatus?: string | null;
  readonly preflightResult?: unknown;
  readonly requestSummary?: unknown;
  readonly responseSummary?: unknown;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export async function updateOperationGroupStatus(
  input: UpdateOperationGroupStatusInput,
): Promise<DualSyncPublishOperationGroup> {
  const dual = getDualSyncDbClient(input.client);
  const patch: Partial<DualSyncPublishOperationGroupRow> = {
    status: input.status,
  };
  if (input.preflightStatus !== undefined) patch.preflight_status = input.preflightStatus;
  if (input.preflightResult !== undefined)
    patch.preflight_result = sanitizeGoogleAuditPayload(input.preflightResult) as Json;
  if (input.requestSummary !== undefined)
    patch.request_summary = sanitizeGoogleAuditPayload(input.requestSummary) as Json;
  if (input.responseSummary !== undefined)
    patch.response_summary = sanitizeGoogleAuditPayload(input.responseSummary) as Json;
  if (input.errorCode !== undefined) patch.error_code = input.errorCode;
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
  if (input.startedAt !== undefined) patch.started_at = input.startedAt;
  if (input.finishedAt !== undefined) patch.finished_at = input.finishedAt;

  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .update(patch as never)
    .eq('id', input.operationGroupId)
    .select('*')
    .single<DualSyncPublishOperationGroupRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(
      `dual_sync_publish_operation_groups update failed for ${input.operationGroupId}`,
    );
  }
  return rowToOperationGroup(data);
}

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

// ---------------------------------------------------------------------------
// Publish-job rollups
// ---------------------------------------------------------------------------

export interface DualSyncPublishJobRollup {
  readonly publishJobId: string;
  readonly restaurantId: string;
  /** Earliest `created_at` across the job's operations. */
  readonly startedAt: string;
  /**
   * Latest `finished_at` across the job's operations, or `null` if any
   * operation is still pending / running.
   */
  readonly finishedAt: string | null;
  readonly totalOperations: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  /** Other statuses (`pending`, `running`, `retrying`). */
  readonly otherCount: number;
  /** De-duped list of section keys touched by the job. */
  readonly sections: ReadonlyArray<DualSyncSectionKey>;
  /** De-duped list of error codes from failed operations. */
  readonly errorCodes: ReadonlyArray<string>;
  /** Direction breakdown — convenience for the UI. */
  readonly importCount: number;
  readonly exportCount: number;
}

/**
 * Group a flat list of operations by `publishJobId` and return one
 * rollup per job. Output is ordered by `startedAt` descending.
 *
 * The caller is responsible for fetching enough history to capture
 * complete jobs — partial jobs (where some operations are outside the
 * fetched window) will rollup with whatever rows are present.
 */
export function summarizeOperationsByJob(
  operations: ReadonlyArray<DualSyncPublishOperation>,
): ReadonlyArray<DualSyncPublishJobRollup> {
  const byJob = new Map<string, DualSyncPublishOperation[]>();
  for (const op of operations) {
    const arr = byJob.get(op.publishJobId) ?? [];
    arr.push(op);
    byJob.set(op.publishJobId, arr);
  }

  const rollups: DualSyncPublishJobRollup[] = [];
  for (const [jobId, ops] of byJob.entries()) {
    if (ops.length === 0) continue;
    let startedAt = ops[0]!.createdAt;
    let finishedAtCandidate: string | null = ops[0]!.finishedAt;
    let allFinished = ops[0]!.finishedAt !== null;
    let succeededCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let otherCount = 0;
    let importCount = 0;
    let exportCount = 0;
    const sectionSet = new Set<DualSyncSectionKey>();
    const errorCodeSet = new Set<string>();

    for (const op of ops) {
      if (op.createdAt < startedAt) startedAt = op.createdAt;
      if (op.finishedAt === null) {
        allFinished = false;
      } else if (finishedAtCandidate === null || op.finishedAt > finishedAtCandidate) {
        finishedAtCandidate = op.finishedAt;
      }
      switch (op.status) {
        case 'succeeded':
          succeededCount += 1;
          break;
        case 'failed':
          failedCount += 1;
          if (op.errorCode) errorCodeSet.add(op.errorCode);
          break;
        case 'skipped':
          skippedCount += 1;
          break;
        default:
          otherCount += 1;
      }
      if (op.direction === 'import_from_google') importCount += 1;
      else exportCount += 1;
      sectionSet.add(op.sectionKey);
    }

    rollups.push({
      publishJobId: jobId,
      restaurantId: ops[0]!.restaurantId,
      startedAt,
      finishedAt: allFinished ? finishedAtCandidate : null,
      totalOperations: ops.length,
      succeededCount,
      failedCount,
      skippedCount,
      otherCount,
      sections: Array.from(sectionSet),
      errorCodes: Array.from(errorCodeSet),
      importCount,
      exportCount,
    });
  }

  return rollups.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export interface ListRecentPublishJobsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  /** Cap on the number of underlying operation rows fetched. Defaults to 200. */
  readonly operationLimit?: number;
  /** Cap on the number of jobs returned. Defaults to 25, max 100. */
  readonly jobLimit?: number;
  /** Optional ISO-8601 lower bound on `created_at`. */
  readonly since?: string | null;
}

/**
 * Read recent operations and group them into job-level rollups, capped
 * at `jobLimit`.
 */
export async function listRecentPublishJobsForRestaurant(
  input: ListRecentPublishJobsInput,
): Promise<ReadonlyArray<DualSyncPublishJobRollup>> {
  const operations = await listRecentOperationsForRestaurant({
    client: input.client,
    restaurantId: input.restaurantId,
    limit: Math.min(Math.max(input.operationLimit ?? 200, 1), 200),
    since: input.since ?? null,
  });
  const rollups = summarizeOperationsByJob(operations);
  const jobLimit = Math.min(Math.max(input.jobLimit ?? 25, 1), 100);
  return rollups.slice(0, jobLimit);
}

export interface GetPublishJobDetailInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
}

export interface DualSyncPublishJobDetail {
  readonly rollup: DualSyncPublishJobRollup;
  readonly batch: DualSyncPublishBatch | null;
  readonly operationGroups: ReadonlyArray<DualSyncPublishOperationGroup>;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
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

export interface ListOperationGroupsByBatchIdsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchIds: ReadonlyArray<string>;
}

export async function listOperationGroupsByBatchIds(
  input: ListOperationGroupsByBatchIdsInput,
): Promise<ReadonlyArray<DualSyncPublishOperationGroup>> {
  const ids = Array.from(new Set(input.publishBatchIds.filter((id) => id.length > 0)));
  if (ids.length === 0) return [];
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .in('publish_batch_id', ids)
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperationGroup);
}

/**
 * Fetch the full operation list for one publish job along with its
 * rollup. Returns `null` when the job is not found for the restaurant
 * (the operations table is restaurant-scoped, so a job belonging to a
 * different tenant is treated as not-found).
 */
export async function getPublishJobDetailForRestaurant(
  input: GetPublishJobDetailInput,
): Promise<DualSyncPublishJobDetail | null> {
  const operations = await listOperationsForJob({
    client: input.client,
    publishJobId: input.publishJobId,
  });
  if (operations.length === 0) return null;
  // Defence in depth: if any op belongs to a different tenant we treat
  // the request as not-found rather than leaking another restaurant's
  // operation history.
  const wrongTenant = operations.some((op) => op.restaurantId !== input.restaurantId);
  if (wrongTenant) return null;
  const [rollup] = summarizeOperationsByJob(operations);
  if (!rollup) return null;
  const publishBatchIds = operations
    .map((operation) => operation.publishBatchId)
    .filter((id): id is string => id !== null);
  const operationGroupIds = new Set(
    operations
      .map((operation) => operation.operationGroupId)
      .filter((id): id is string => id !== null),
  );
  const [batches, allGroups] = await Promise.all([
    listPublishBatchesByIds({
      client: input.client,
      restaurantId: input.restaurantId,
      publishBatchIds,
    }),
    listOperationGroupsByBatchIds({
      client: input.client,
      restaurantId: input.restaurantId,
      publishBatchIds,
    }),
  ]);
  const operationGroups = allGroups.filter((group) => operationGroupIds.has(group.id));
  return { rollup, batch: batches[0] ?? null, operationGroups, operations };
}
