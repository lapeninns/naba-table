/**
 * Phase 3 of the unified dual-sync engine.
 *
 * Compatibility facade for publish persistence and job-detail reads.
 */

import {
  createPublishBatch,
  findPublishBatchByClientRequest,
  listPublishBatchesByIds,
  updatePublishBatchStatus,
} from './operations-batches';
import {
  createOperationGroupsForPlan,
  listOperationGroupsByBatchIds,
  updateOperationGroupStatus,
} from './operations-groups';
import { summarizeOperationsByJob } from './operations-rollups';
import {
  createOperation,
  listOperationsForJob,
  listRecentOperationsForRestaurant,
  updateOperationStatus,
} from './operations-rows';

import type {
  CreatePublishBatchInput,
  FindPublishBatchByClientRequestInput,
  ListPublishBatchesByIdsInput,
  UpdatePublishBatchStatusInput,
} from './operations-batches';
import type {
  CreateOperationGroupsForPlanInput,
  ListOperationGroupsByBatchIdsInput,
  UpdateOperationGroupStatusInput,
} from './operations-groups';
import type { DualSyncPublishJobDetail, DualSyncPublishJobRollup } from './operations-rollups';
import type {
  CreateOperationInput,
  ListOperationsForJobInput,
  ListRecentOperationsInput,
  UpdateOperationStatusInput,
} from './operations-rows';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export {
  createOperation,
  createOperationGroupsForPlan,
  createPublishBatch,
  findPublishBatchByClientRequest,
  listOperationGroupsByBatchIds,
  listOperationsForJob,
  listPublishBatchesByIds,
  listRecentOperationsForRestaurant,
  summarizeOperationsByJob,
  updateOperationGroupStatus,
  updateOperationStatus,
  updatePublishBatchStatus,
};
export type {
  CreateOperationInput,
  CreateOperationGroupsForPlanInput,
  CreatePublishBatchInput,
  DualSyncPublishJobDetail,
  DualSyncPublishJobRollup,
  FindPublishBatchByClientRequestInput,
  ListOperationGroupsByBatchIdsInput,
  ListOperationsForJobInput,
  ListPublishBatchesByIdsInput,
  ListRecentOperationsInput,
  UpdateOperationStatusInput,
  UpdateOperationGroupStatusInput,
  UpdatePublishBatchStatusInput,
};

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
