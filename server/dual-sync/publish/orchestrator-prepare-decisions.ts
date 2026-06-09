import { createOperation } from './operations';
import { evaluatePublishDecision } from './orchestrator-prepare-decisions-domain';
import { markIgnored } from '../state/write';

import type { buildRegistry } from '../registry';
import type { DualSyncRuntimeControls } from '../runtime-controls';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncGoogleUpdateMask, DualSyncPublishOperation } from '../types';
import type { DualSyncOperationFailure, DualSyncPublishDecision } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type PreparedPublishDecision = {
  readonly decision: DualSyncPublishDecision;
  readonly beforeCoreHash: string | null;
  readonly beforeGbpHash: string | null;
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly operation: DualSyncPublishOperation;
  readonly operationGroupId: string | null;
  readonly writeGroup: string | null;
  readonly googleUpdateMask: DualSyncGoogleUpdateMask | null;
};

export interface PreparePublishDecisionsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly publishBatchId: string;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly preflightFailures: ReadonlyMap<string, DualSyncOperationFailure>;
  readonly operationGroupIdByKey: ReadonlyMap<string, string>;
  readonly runtimeControls: DualSyncRuntimeControls;
  readonly actorUserId: string | null;
}

export async function preparePublishDecisions(input: PreparePublishDecisionsInput): Promise<{
  readonly prepared: PreparedPublishDecision[];
  readonly failures: Array<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
}> {
  const failures: Array<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }> = [];
  const prepared: PreparedPublishDecision[] = [];

  for (const decision of input.decisions) {
    const evaluation = evaluatePublishDecision({
      decision,
      registry: input.registry,
      coreSnapshot: input.coreSnapshot,
      gbpSnapshot: input.gbpSnapshot,
      preflightFailure: input.preflightFailures.get(decision.fieldKey),
      runtimeControls: input.runtimeControls,
      actorUserId: input.actorUserId,
    });
    if (evaluation.status === 'failed') {
      failures.push({
        fieldKey: evaluation.fieldKey,
        failure: evaluation.failure,
      });
      continue;
    }
    if (evaluation.status === 'ignored') {
      await markIgnored({
        client: input.client,
        restaurantId: input.restaurantId,
        sectionKey: evaluation.decision.sectionKey,
        fieldKey: evaluation.decision.fieldKey,
      });
      continue;
    }

    const operationGroupId =
      input.operationGroupIdByKey.get(evaluation.operationGroupKey ?? '') ?? null;
    const operation = await createOperation({
      client: input.client,
      restaurantId: input.restaurantId,
      publishJobId: input.publishJobId,
      publishBatchId: input.publishBatchId,
      operationGroupId,
      sectionKey: evaluation.decision.sectionKey,
      fieldKey: evaluation.decision.fieldKey,
      direction: evaluation.direction,
      beforeCoreHash: evaluation.beforeCoreHash,
      beforeGbpHash: evaluation.beforeGbpHash,
      googleUpdateMask: evaluation.googleUpdateMask,
    });

    prepared.push({
      decision: evaluation.decision,
      beforeCoreHash: evaluation.beforeCoreHash,
      beforeGbpHash: evaluation.beforeGbpHash,
      direction: evaluation.direction,
      operation,
      operationGroupId,
      writeGroup: evaluation.writeGroup,
      googleUpdateMask: evaluation.googleUpdateMask,
    });
  }

  return { prepared, failures };
}
