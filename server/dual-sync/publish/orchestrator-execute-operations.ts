import { mapGoogleProviderErrorToPublishFailure } from './google-errors';
import { createGoogleRequestLog } from './google-request-logs';
import { reserveGoogleEditBudget, type DualSyncGoogleEditThrottle } from './google-safety';
import { updateOperationGroupStatus, updateOperationStatus } from './operations';
import { isExport, isImport } from './orchestrator-domain';
import { markFailed, markInSync } from '../state/write';

import type { PreparedPublishDecision } from './orchestrator-prepare-decisions';
import type { DualSyncOrchestratorPorts } from './ports';
import type {
  DualSyncOperationContext,
  DualSyncOperationFailure,
  DualSyncOperationResult,
} from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface ExecutePreparedPublishOperationsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly publishBatchId: string;
  readonly actorUserId: string | null;
  readonly prepared: ReadonlyArray<PreparedPublishDecision>;
  readonly prebuiltResults: ReadonlyMap<string, DualSyncOperationResult>;
  readonly ports: DualSyncOrchestratorPorts;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly googleEditThrottle?: DualSyncGoogleEditThrottle;
  readonly failures: ReadonlyArray<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
}

export async function executePreparedPublishOperations(
  input: ExecutePreparedPublishOperationsInput,
): Promise<{
  readonly failures: Array<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
}> {
  const failures = [...input.failures];
  const runningOperationGroups = new Set<string>();

  for (const item of input.prepared) {
    const { decision, beforeCoreHash, beforeGbpHash, operation } = item;
    const startedAt = new Date().toISOString();
    if (item.operationGroupId && !runningOperationGroups.has(item.operationGroupId)) {
      runningOperationGroups.add(item.operationGroupId);
      await updateOperationGroupStatus({
        client: input.client,
        operationGroupId: item.operationGroupId,
        status: 'running',
        startedAt,
      });
    }
    await updateOperationStatus({
      client: input.client,
      operationId: operation.id,
      status: 'running',
      attemptCount: 1,
      startedAt,
    });

    let result: DualSyncOperationResult;
    const prebuilt = input.prebuiltResults.get(decision.fieldKey);
    if (prebuilt && isExport(decision.action)) {
      result = prebuilt;
    } else {
      try {
        const ctx: DualSyncOperationContext = {
          client: input.client,
          restaurantId: input.restaurantId,
          publishJobId: input.publishJobId,
          decision,
          coreSnapshot: input.coreSnapshot,
          gbpSnapshot: input.gbpSnapshot,
          actorUserId: input.actorUserId,
        };
        if (isImport(decision.action)) {
          result = await input.ports.applyImportToCore(ctx);
        } else if (isExport(decision.action)) {
          const throttleFailure = await reserveGoogleEditBudget({
            throttle: input.googleEditThrottle,
            restaurantId: input.restaurantId,
            writeGroup: item.operationGroupId ?? decision.sectionKey,
          });
          result = throttleFailure
            ? { status: 'failed', failure: throttleFailure }
            : await input.ports.applyExportToGoogle(ctx);
        } else {
          result = { status: 'skipped' };
        }
      } catch (error) {
        result = {
          status: 'failed',
          failure: mapGoogleProviderErrorToPublishFailure(error, 'Dual-sync publish port failed.'),
        };
      }
    }

    const finishedAt = new Date().toISOString();
    await updateOperationStatus({
      client: input.client,
      operationId: operation.id,
      status: result.status,
      afterCoreHash: result.afterCoreHash,
      afterGbpHash: result.afterGbpHash,
      externalResponse: result.externalResponse,
      errorCode: result.failure?.code ?? null,
      errorMessage: result.failure?.message ?? null,
      finishedAt,
    });

    if (isExport(decision.action)) {
      await createGoogleRequestLog({
        client: input.client,
        restaurantId: input.restaurantId,
        publishBatchId: input.publishBatchId,
        operationGroupId: item.operationGroupId,
        publishOperationId: operation.id,
        publishJobId: input.publishJobId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
        direction: item.direction,
        writeGroup: item.writeGroup,
        phase: result.status === 'failed' ? 'provider_error' : 'provider_write',
        status: result.status,
        googleMethod: item.writeGroup ?? decision.sectionKey,
        googleUpdateMasks: item.googleUpdateMask ? [item.googleUpdateMask] : [],
        requestSummary: {
          sectionKey: decision.sectionKey,
          fieldKey: decision.fieldKey,
          writeGroup: item.writeGroup,
          googleUpdateMask: item.googleUpdateMask,
          beforeCoreHash,
          beforeGbpHash,
        },
        responseSummary: result.externalResponse ?? null,
        errorCode: result.failure?.code ?? null,
        errorMessage: result.failure?.message ?? null,
      });
    }

    if (result.status === 'succeeded') {
      const newCanonicalHash =
        decision.action === 'import_from_google' ? beforeGbpHash : beforeCoreHash;
      await markInSync({
        client: input.client,
        restaurantId: input.restaurantId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
        inSyncHash: newCanonicalHash,
      });
    } else if (result.status === 'failed') {
      await markFailed({
        client: input.client,
        restaurantId: input.restaurantId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
        direction: isImport(decision.action) ? 'import' : 'export',
      });
      if (result.failure) {
        failures.push({ fieldKey: decision.fieldKey, failure: result.failure });
      }
    }
  }

  return { failures };
}
