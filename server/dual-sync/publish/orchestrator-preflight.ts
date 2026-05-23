import { mapGoogleProviderErrorToPublishFailure } from './google-errors';
import { createGoogleRequestLog } from './google-request-logs';
import { updateOperationGroupStatus } from './operations';

import type { DualSyncExportPreflightPort } from './preflight';
import type { DualSyncOperationFailure, DualSyncPublishGroup } from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunRequiredExportPreflightsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchId: string;
  readonly actorUserId: string | null;
  readonly planGroups: ReadonlyArray<DualSyncPublishGroup>;
  readonly operationGroupIdByKey: ReadonlyMap<string, string>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly exportPreflight: DualSyncExportPreflightPort;
}

export async function runRequiredExportPreflights(
  input: RunRequiredExportPreflightsInput,
): Promise<Map<string, DualSyncOperationFailure>> {
  const failedByFieldKey = new Map<string, DualSyncOperationFailure>();

  for (const group of input.planGroups) {
    if (group.direction !== 'export_to_google' || !group.requiresPreflight) continue;
    const operationGroupId = input.operationGroupIdByKey.get(group.groupId);
    if (!operationGroupId) continue;
    const startedAt = new Date().toISOString();
    const requestSummary = {
      groupId: group.groupId,
      sectionKey: group.sectionKey,
      writeGroup: group.writeGroup,
      googleUpdateMasks: group.googleUpdateMasks,
      fieldKeys: group.fields.map((field) => field.fieldKey),
    };
    await updateOperationGroupStatus({
      client: input.client,
      operationGroupId,
      status: 'running',
      preflightStatus: 'running',
      startedAt,
      requestSummary,
    });

    let result;
    try {
      result = await input.exportPreflight({
        client: input.client,
        restaurantId: input.restaurantId,
        publishBatchId: input.publishBatchId,
        group,
        coreSnapshot: input.coreSnapshot,
        gbpSnapshot: input.gbpSnapshot,
        actorUserId: input.actorUserId,
      });
    } catch (error) {
      result = {
        status: 'failed' as const,
        failure: mapGoogleProviderErrorToPublishFailure(error, 'Google export preflight failed.'),
        result: {
          thrown: true,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    await createGoogleRequestLog({
      client: input.client,
      restaurantId: input.restaurantId,
      publishBatchId: input.publishBatchId,
      operationGroupId,
      sectionKey: group.sectionKey,
      direction: group.direction,
      writeGroup: group.writeGroup,
      phase: 'preflight',
      status: result.status,
      googleMethod: group.writeGroup,
      googleUpdateMasks: group.googleUpdateMasks,
      requestSummary,
      responseSummary: result.result ?? null,
      errorCode: result.status === 'failed' ? result.failure.code : null,
      errorMessage: result.status === 'failed' ? result.failure.message : null,
    });

    if (result.status === 'failed') {
      await updateOperationGroupStatus({
        client: input.client,
        operationGroupId,
        status: 'failed',
        preflightStatus: 'failed',
        preflightResult: result.result ?? null,
        errorCode: result.failure.code,
        errorMessage: result.failure.message,
        finishedAt: new Date().toISOString(),
      });
      for (const decision of group.fields) {
        failedByFieldKey.set(decision.fieldKey, result.failure);
      }
      continue;
    }

    await updateOperationGroupStatus({
      client: input.client,
      operationGroupId,
      status: 'pending',
      preflightStatus: result.status,
      preflightResult: result.result ?? null,
      responseSummary: result.result ?? null,
    });
  }

  return failedByFieldKey;
}
