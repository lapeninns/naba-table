import { findPublishBatchByClientRequest, listOperationsForJob } from './operations';
import { buildSummary, policyFailure } from './orchestrator-domain';

import type {
  DualSyncOperationFailure,
  DualSyncOperationFailureCode,
  DualSyncPublishDecision,
  DualSyncPublishJobSummary,
} from './types';
import type { DualSyncPublishOperation } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const KNOWN_FAILURE_CODES: ReadonlySet<DualSyncOperationFailureCode> = new Set([
  'CORE_DRIFT',
  'GBP_DRIFT',
  'PORT_FAILURE',
  'INVALID_DECISION',
  'UNSUPPORTED_FIELD',
  'QUOTA_LIMITED',
  'REAUTH_REQUIRED',
  'LOCATION_ACCESS_LOST',
  'GOOGLE_VALIDATION_FAILED',
  'SYNC_PAUSED',
  'EXTERNAL_API_TIMEOUT',
  'EXTERNAL_API_ERROR',
  'UNKNOWN',
]);

const RETRYABLE_FAILURE_CODES: ReadonlySet<DualSyncOperationFailureCode> = new Set([
  'QUOTA_LIMITED',
  'EXTERNAL_API_TIMEOUT',
  'EXTERNAL_API_ERROR',
]);

function isKnownFailureCode(code: string | null): code is DualSyncOperationFailureCode {
  return code !== null && KNOWN_FAILURE_CODES.has(code as DualSyncOperationFailureCode);
}

function storedOperationFailure(
  operation: DualSyncPublishOperation,
): DualSyncOperationFailure | null {
  switch (operation.status) {
    case 'succeeded':
    case 'skipped':
      return null;
    case 'failed': {
      const code = isKnownFailureCode(operation.errorCode) ? operation.errorCode : 'UNKNOWN';
      // Stored provider text is not replayed: the live path already reported it once.
      return {
        code,
        message: 'Publish operation failed.',
        retryable: RETRYABLE_FAILURE_CODES.has(code),
      };
    }
    case 'pending':
    case 'running':
    case 'retrying':
      return {
        code: 'UNKNOWN',
        message: 'Publish operation is still in progress.',
        retryable: true,
      };
  }
}

/**
 * A replay has no in-memory failure list, so it is rebuilt from the stored operations: a failed
 * or unfinished operation, or a non-ignored decision with no operation at all (it failed before
 * an operation row was written, or the first request is still initialising), is a failure. A
 * replay must never read as plain success when the original batch was not.
 */
export function replayFailuresFromOperations(
  decisions: ReadonlyArray<DualSyncPublishDecision>,
  operations: ReadonlyArray<DualSyncPublishOperation>,
): Array<{ readonly fieldKey: string; readonly failure: DualSyncOperationFailure }> {
  const failures: Array<{ readonly fieldKey: string; readonly failure: DualSyncOperationFailure }> =
    [];
  for (const decision of decisions) {
    if (decision.action === 'ignore') continue;
    const fieldOperations = operations.filter(
      (operation) => operation.fieldKey === decision.fieldKey,
    );
    if (fieldOperations.length === 0) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: {
          code: 'UNKNOWN',
          message: 'Publish outcome is not available for this field.',
          retryable: true,
        },
      });
      continue;
    }
    const failure = fieldOperations
      .map(storedOperationFailure)
      .find((candidate): candidate is DualSyncOperationFailure => candidate !== null);
    if (failure) failures.push({ fieldKey: decision.fieldKey, failure });
  }
  return failures;
}

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
    failures: replayFailuresFromOperations(input.decisions, operations),
  });
}
