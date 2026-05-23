import { findPublishBatchByClientRequest, listOperationsForJob } from './operations';
import { buildSummary, policyFailure } from './orchestrator-domain';

import type { DualSyncPublishDecision, DualSyncPublishJobSummary } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

interface ResolveClientRequestReplayInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly clientRequestId?: string | null;
  readonly decisionHash: string;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
}

export async function resolveClientRequestReplay(
  input: ResolveClientRequestReplayInput,
): Promise<DualSyncPublishJobSummary | null> {
  if (!input.clientRequestId) return null;

  const existingBatch = await findPublishBatchByClientRequest({
    client: input.client,
    restaurantId: input.restaurantId,
    clientRequestId: input.clientRequestId,
  });
  if (!existingBatch) return null;

  if (existingBatch.decisionHash !== input.decisionHash) {
    const failure = policyFailure(
      'Client request id was already used for a different publish decision set.',
      'INVALID_DECISION',
    );
    return buildSummary({
      publishJobId: existingBatch.id,
      restaurantId: input.restaurantId,
      decisions: input.decisions,
      operations: [],
      failures: input.decisions.map((decision) => ({
        fieldKey: decision.fieldKey,
        failure,
      })),
    });
  }

  const operations = await listOperationsForJob({
    client: input.client,
    publishJobId: existingBatch.id,
  });
  return buildSummary({
    publishJobId: existingBatch.id,
    restaurantId: input.restaurantId,
    decisions: input.decisions,
    operations,
    failures: [],
  });
}
