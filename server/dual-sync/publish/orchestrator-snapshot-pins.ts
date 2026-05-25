import { hashCanonicalJson } from '../hashing';
import { updatePublishBatchStatus } from './operations';
import { buildSummary } from './orchestrator-domain';
import { recomputeAllStates } from '../state/recompute';

import type {
  DualSyncOperationFailure,
  DualSyncPublishDecision,
  DualSyncPublishJobSummary,
} from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

interface RejectStaleSnapshotPinsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly publishBatchId: string;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly pinnedCoreSnapshotHash?: string | null;
  readonly pinnedGbpSnapshotHash?: string | null;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}

function failureForStaleSnapshot(snapshotKind: 'core' | 'gbp'): DualSyncOperationFailure {
  if (snapshotKind === 'core') {
    return {
      code: 'CORE_DRIFT',
      message: 'Core snapshot moved since the operator viewed the diff.',
      retryable: false,
    };
  }
  return {
    code: 'GBP_DRIFT',
    message: 'Google snapshot moved since the operator viewed the diff.',
    retryable: false,
  };
}

async function rejectWithFailure(
  input: RejectStaleSnapshotPinsInput,
  failure: DualSyncOperationFailure,
): Promise<DualSyncPublishJobSummary> {
  await updatePublishBatchStatus({
    client: input.client,
    publishBatchId: input.publishBatchId,
    status: 'stale',
    errorCode: failure.code,
    errorMessage: failure.message,
    finishedAt: new Date().toISOString(),
  });
  await recomputeAllStates({
    client: input.client,
    restaurantId: input.restaurantId,
    coreSnapshot: input.coreSnapshot,
    gbpSnapshot: input.gbpSnapshot,
  });
  return buildSummary({
    publishJobId: input.publishJobId,
    restaurantId: input.restaurantId,
    decisions: input.decisions,
    operations: [],
    failures: input.decisions.map((decision) => ({ fieldKey: decision.fieldKey, failure })),
  });
}

export async function rejectStaleSnapshotPins(
  input: RejectStaleSnapshotPinsInput,
): Promise<DualSyncPublishJobSummary | null> {
  if (input.pinnedCoreSnapshotHash !== undefined && input.pinnedCoreSnapshotHash !== null) {
    const currentCoreHash = hashCanonicalJson(input.coreSnapshot);
    if (currentCoreHash !== input.pinnedCoreSnapshotHash) {
      return rejectWithFailure(input, failureForStaleSnapshot('core'));
    }
  }
  if (input.pinnedGbpSnapshotHash !== undefined && input.pinnedGbpSnapshotHash !== null) {
    const currentGbpHash = hashCanonicalJson(input.gbpSnapshot);
    if (currentGbpHash !== input.pinnedGbpSnapshotHash) {
      return rejectWithFailure(input, failureForStaleSnapshot('gbp'));
    }
  }
  return null;
}
