import { mapGoogleProviderErrorToPublishFailure } from './google-errors';
import { reserveGoogleEditBudget, type DualSyncGoogleEditThrottle } from './google-safety';
import { findFieldConfig } from '../registry';

import type { DualSyncOrchestratorPorts } from './ports';
import type {
  DualSyncBatchExportResult,
  DualSyncOperationResult,
  DualSyncPublishDecision,
} from './types';
import type { buildRegistry } from '../registry';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncSectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunBatchExportPortsInput {
  readonly ports: DualSyncOrchestratorPorts;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly client: DbClient;
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly actorUserId: string | null;
  readonly googleEditThrottle?: DualSyncGoogleEditThrottle;
}

/**
 * Group consecutive `export_to_google` decisions by `sectionKey` and
 * offer each group as a single batch to the optional
 * `applyExportBatchToGoogle` port. Returns a map keyed by `fieldKey`
 * with the per-field operation results so the main per-decision loop
 * can reuse them and skip the per-field port call.
 *
 * Drift checks and operation-row creation happen before this helper is
 * called, so the batch port only receives validated decisions with
 * pending audit rows already opened.
 */
export async function runBatchExportPorts(
  input: RunBatchExportPortsInput,
): Promise<Map<string, DualSyncOperationResult>> {
  const out = new Map<string, DualSyncOperationResult>();
  const batchPort = input.ports.applyExportBatchToGoogle;
  if (!batchPort) return out;

  const groups: Array<{
    readonly sectionKey: DualSyncSectionKey;
    readonly decisions: DualSyncPublishDecision[];
  }> = [];
  for (const decision of input.decisions) {
    if (decision.action !== 'export_to_google') continue;
    if (!findFieldConfig(input.registry, decision.fieldKey)) continue;
    const last = groups[groups.length - 1];
    if (last && last.sectionKey === decision.sectionKey) {
      last.decisions.push(decision);
    } else {
      groups.push({ sectionKey: decision.sectionKey, decisions: [decision] });
    }
  }

  for (const group of groups) {
    if (group.decisions.length < 2) continue;
    let batchResult: DualSyncBatchExportResult;
    try {
      const throttleFailure = await reserveGoogleEditBudget({
        throttle: input.googleEditThrottle,
        restaurantId: input.restaurantId,
        writeGroup: group.sectionKey,
      });
      if (throttleFailure) {
        for (const decision of group.decisions) {
          out.set(decision.fieldKey, {
            status: 'failed',
            failure: throttleFailure,
          });
        }
        continue;
      }
      batchResult = await batchPort({
        client: input.client,
        restaurantId: input.restaurantId,
        publishJobId: input.publishJobId,
        sectionKey: group.sectionKey,
        decisions: group.decisions,
        coreSnapshot: input.coreSnapshot,
        gbpSnapshot: input.gbpSnapshot,
        actorUserId: input.actorUserId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const decision of group.decisions) {
        out.set(decision.fieldKey, {
          status: 'failed',
          failure: mapGoogleProviderErrorToPublishFailure(error, `Batch export failed: ${message}`),
        });
      }
      continue;
    }
    if (!batchResult.supported) continue;
    for (const decision of group.decisions) {
      const perField = batchResult.perField[decision.fieldKey];
      if (perField) {
        out.set(decision.fieldKey, perField);
      } else {
        out.set(decision.fieldKey, {
          status: 'failed',
          failure: {
            code: 'PORT_FAILURE',
            message: `Batch export did not return a result for ${decision.fieldKey}.`,
            retryable: false,
          },
        });
      }
    }
  }

  return out;
}
