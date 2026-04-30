/**
 * Phase 3 of the unified dual-sync engine.
 *
 * CRUD on `dual_sync_publish_operations`. One row per (publish_job_id,
 * field_key) is created at job start; status transitions follow the
 * orchestrator lifecycle: pending -> running -> succeeded | failed |
 * skipped | retrying.
 */

import { getDualSyncDbClient, type DualSyncPublishOperationRow } from '../db';
import {
  type DualSyncGoogleUpdateMask,
  type DualSyncPublishOperation,
  type DualSyncPublishOperationStatus,
  type DualSyncSectionKey,
  isDualSyncSectionKey,
} from '../types';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function rowToOperation(row: DualSyncPublishOperationRow): DualSyncPublishOperation {
  if (!isDualSyncSectionKey(row.section_key)) {
    throw new Error(
      `dual_sync_publish_operations: unexpected section_key ${row.section_key}`,
    );
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    publishJobId: row.publish_job_id,
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

export interface CreateOperationInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
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
    patch.external_response = input.externalResponse as Json;
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
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
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
  return { rollup, operations };
}
