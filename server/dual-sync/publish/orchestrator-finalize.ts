import {
  listOperationsForJob,
  updateOperationGroupStatus,
  updatePublishBatchStatus,
} from './operations';
import {
  batchStatusForSummary,
  buildSummary,
  operationGroupExecutionSummary,
  operationGroupStatusForOperations,
} from './orchestrator-domain';
import { listOpenOutboundCandidates, resolveOutboundCandidate } from '../outbound/candidates';
import { recomputeAllStates } from '../state/recompute';

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncPublishOperationGroup } from '../types';
import type {
  DualSyncOperationFailure,
  DualSyncPublishJobSummary,
  DualSyncRunPublishInput,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface FinalizePublishInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly publishBatchId: string;
  readonly input: DualSyncRunPublishInput;
  readonly operationGroups: ReadonlyArray<DualSyncPublishOperationGroup>;
  readonly failures: ReadonlyArray<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
  readonly readCoreSnapshot: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
  readonly readGbpSnapshot: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
}

export async function finalizePublish(input: FinalizePublishInput): Promise<{
  readonly summary: DualSyncPublishJobSummary;
}> {
  const operations = await listOperationsForJob({
    client: input.client,
    publishJobId: input.publishJobId,
  });

  for (const group of input.operationGroups) {
    const groupOperations = operations.filter((op) => op.operationGroupId === group.id);
    const groupFailure =
      groupOperations.length === 0
        ? input.failures.find((failure) =>
            input.input.decisions.some(
              (decision) =>
                decision.fieldKey === failure.fieldKey &&
                group.groupKey.startsWith(`${decision.action}:${decision.sectionKey}:`),
            ),
          )
        : null;
    const groupStatus = groupFailure
      ? 'failed'
      : operationGroupStatusForOperations(groupOperations);
    const firstFailure = groupOperations.find((op) => op.status === 'failed');
    await updateOperationGroupStatus({
      client: input.client,
      operationGroupId: group.id,
      status: groupStatus,
      responseSummary: operationGroupExecutionSummary(groupOperations),
      errorCode: firstFailure?.errorCode ?? groupFailure?.failure.code ?? null,
      errorMessage: firstFailure?.errorMessage ?? groupFailure?.failure.message ?? null,
      finishedAt:
        groupStatus === 'running' || groupStatus === 'retrying' ? null : new Date().toISOString(),
    });
  }

  const succeeded = operations.filter((op) => op.status === 'succeeded');
  if (succeeded.length > 0) {
    const openCandidates = await listOpenOutboundCandidates({
      client: input.client,
      restaurantId: input.restaurantId,
    });
    const succeededFieldKeys = new Set(succeeded.map((op) => op.fieldKey));
    for (const candidate of openCandidates) {
      if (succeededFieldKeys.has(candidate.fieldKey)) {
        await resolveOutboundCandidate({
          client: input.client,
          id: candidate.id,
          nextStatus: 'resolved',
        });
      }
    }
  }

  const [finalCoreSnapshot, finalGbpSnapshot] = await Promise.all([
    input.readCoreSnapshot({ client: input.client, restaurantId: input.restaurantId }),
    input.readGbpSnapshot({ client: input.client, restaurantId: input.restaurantId }),
  ]);
  await recomputeAllStates({
    client: input.client,
    restaurantId: input.restaurantId,
    coreSnapshot: finalCoreSnapshot,
    gbpSnapshot: finalGbpSnapshot,
  });

  await updatePublishBatchStatus({
    client: input.client,
    publishBatchId: input.publishBatchId,
    status: batchStatusForSummary({ operations, failures: input.failures }),
    finishedAt: new Date().toISOString(),
  });

  return {
    summary: buildSummary({
      publishJobId: input.publishJobId,
      restaurantId: input.restaurantId,
      decisions: input.input.decisions,
      operations,
      failures: input.failures,
    }),
  };
}
