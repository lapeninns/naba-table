import { createOperationGroupsForPlan, createPublishBatch } from './operations';
import { buildPublishPlan } from './planner';

import type { DualSyncRunPublishInput, DualSyncPublishPlan } from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncPublishBatch, DualSyncPublishOperationGroup } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

interface InitializePublishBatchInput {
  readonly client: DbClient;
  readonly input: DualSyncRunPublishInput;
  readonly decisionHash: string;
  readonly fieldPolicyVersionId: string;
  readonly fieldPolicyHash: string | null;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}

interface InitializePublishBatchResult {
  readonly plan: DualSyncPublishPlan;
  readonly publishBatch: DualSyncPublishBatch;
  readonly publishJobId: string;
  readonly operationGroups: ReadonlyArray<DualSyncPublishOperationGroup>;
  readonly operationGroupIdByKey: ReadonlyMap<string, string>;
}

export async function initializePublishBatch(
  input: InitializePublishBatchInput,
): Promise<InitializePublishBatchResult> {
  const { client, input: publishInput } = input;
  const { restaurantId } = publishInput;
  const plan = await buildPublishPlan(client, publishInput, {
    readCoreSnapshot: async () => input.coreSnapshot,
    readGbpSnapshot: async () => input.gbpSnapshot,
  });
  const publishBatch = await createPublishBatch({
    client,
    restaurantId,
    clientRequestId: publishInput.clientRequestId ?? null,
    actorUserId: publishInput.actorUserId,
    decisionHash: input.decisionHash,
    pinnedCoreSnapshotHash: publishInput.pinnedCoreSnapshotHash ?? null,
    pinnedGbpSnapshotHash: publishInput.pinnedGbpSnapshotHash ?? null,
    coreSnapshotHash: plan.coreSnapshotHash,
    gbpSnapshotHash: plan.gbpSnapshotHash,
    fieldPolicyVersionId: input.fieldPolicyVersionId,
    fieldPolicyHash: input.fieldPolicyHash,
    acceptedCount: plan.acceptedCount,
    rejectedCount: plan.rejectedCount,
    ignoredCount: plan.ignoredCount,
    planSummary: {
      groups: plan.groups,
      rejected: plan.rejected,
      warnings: plan.warnings,
    },
  });
  const operationGroups = await createOperationGroupsForPlan({
    client,
    restaurantId,
    publishBatchId: publishBatch.id,
    groups: plan.groups,
  });

  return {
    plan,
    publishBatch,
    publishJobId: publishBatch.id,
    operationGroups,
    operationGroupIdByKey: new Map(
      operationGroups.map((group) => [group.groupKey, group.id] as const),
    ),
  };
}
