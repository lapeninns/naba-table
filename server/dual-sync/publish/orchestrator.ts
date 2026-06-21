/**
 * Phase 3 of the unified dual-sync engine.
 *
 * Per-field publish orchestrator.
 *
 * Inputs : { restaurantId, decisions[], pinned snapshot hashes? }
 * Outputs: { publishJobId, operations[], summary, failures[] }
 *
 * Lifecycle for one decision:
 *   1. optionally pull a fresh Google mirror inside the publish lock, then
 *      read current Core + Google canonical snapshots.
 *   2. drift-check the decision against pinned hashes; reject with
 *      `CORE_DRIFT` / `GBP_DRIFT` if anything moved.
 *   3. create a `dual_sync_publish_operations` row (status=pending).
 *   4. transition to `running`, invoke the matching port, transition to
 *      the resulting status (succeeded / failed / skipped).
 *   5. on success, mark the field state `in_sync` and resolve any open
 *      outbound candidate.
 *   6. on failure, mark the field state `import_failed` /
 *      `export_failed` so the UI can surface a retry affordance.
 *
 * After every decision is processed the orchestrator runs a final
 * `recomputeAllStates` pass so any residual drift is reflected in the
 * state machine.
 */

import { initializePublishBatch } from './orchestrator-batch-initialization';
import { runPublishExecutionPhase } from './orchestrator-execution-phase';
import { resolveClientRequestReplay } from './orchestrator-idempotency';
import { preparePublishRuntimeContext } from './orchestrator-runtime-context';
import { rejectStaleSnapshotPins } from './orchestrator-snapshot-pins';
import { NOOP_PORTS, type DualSyncOrchestratorPorts } from './ports';
import { defaultDualSyncExportPreflight, type DualSyncExportPreflightPort } from './preflight';
import { runWithDualSyncLock, type DualSyncLockManager } from '../locks';

import type { DualSyncGoogleEditThrottle } from './google-safety';
import type { DualSyncPublishJobSummary, DualSyncRunPublishInput } from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface RunPublishOptions {
  readonly ports?: DualSyncOrchestratorPorts;
  readonly lockManager?: DualSyncLockManager;
  readonly lockTtlMs?: number;
  readonly googleEditThrottle?: DualSyncGoogleEditThrottle;
  readonly exportPreflight?: DualSyncExportPreflightPort;
  /**
   * When true, the orchestrator performs a live Google pull inside the
   * publish lock before evaluating snapshot/field pins. Tests and replay
   * callers can leave this disabled when they inject snapshot readers.
   */
  readonly refreshGoogleBeforePublish?: boolean;
  /**
   * Override snapshot reads for tests. Defaults to
   * `readNabatableSnapshot` / `readGoogleSnapshot`.
   */
  readonly readCoreSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
  readonly readGbpSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
}

export interface RunPublishResult {
  readonly summary: DualSyncPublishJobSummary;
}

/**
 * Run a publish job over the supplied decisions. Operates serially per
 * field for clarity; each operation row records before / after hashes
 * for audit. Throws only on infrastructural errors (missing snapshot
 * read, DB outage) — per-field failures are captured in the summary.
 */
export async function runPublish(
  client: DbClient,
  input: DualSyncRunPublishInput,
  options: RunPublishOptions = {},
): Promise<RunPublishResult> {
  return runWithDualSyncLock(
    {
      client,
      restaurantId: input.restaurantId,
      jobKind: 'publish_batch',
      holderId: input.clientRequestId ?? input.publishBatchId ?? undefined,
      ttlMs: options.lockTtlMs,
      manager: options.lockManager,
      metadata: {
        publishBatchId: input.publishBatchId ?? null,
        clientRequestId: input.clientRequestId ?? null,
        decisionCount: input.decisions.length,
      },
    },
    () => runPublishUnlocked(client, input, options),
  );
}

async function runPublishUnlocked(
  client: DbClient,
  input: DualSyncRunPublishInput,
  options: RunPublishOptions,
): Promise<RunPublishResult> {
  const ports = options.ports ?? NOOP_PORTS;
  const exportPreflight = options.exportPreflight ?? defaultDualSyncExportPreflight;

  const {
    restaurantId,
    readCoreSnapshot,
    readGbpSnapshot,
    coreSnapshot,
    gbpSnapshot,
    registry,
    fieldPolicyVersion,
    decisionHash,
    runtimeControls,
  } = await preparePublishRuntimeContext({
    client,
    input,
    refreshGoogleBeforePublish: options.refreshGoogleBeforePublish,
    readCoreSnapshot: options.readCoreSnapshot,
    readGbpSnapshot: options.readGbpSnapshot,
  });

  const replaySummary = await resolveClientRequestReplay({
    client,
    restaurantId,
    clientRequestId: input.clientRequestId,
    decisionHash,
    decisions: input.decisions,
  });
  if (replaySummary) {
    return { summary: replaySummary };
  }

  const { plan, publishBatch, publishJobId, operationGroups, operationGroupIdByKey } =
    await initializePublishBatch({
      client,
      input,
      decisionHash,
      fieldPolicyVersionId: fieldPolicyVersion.id,
      fieldPolicyHash: fieldPolicyVersion.policyHash,
      coreSnapshot,
      gbpSnapshot,
    });

  const staleSnapshotSummary = await rejectStaleSnapshotPins({
    client,
    restaurantId,
    publishJobId,
    publishBatchId: publishBatch.id,
    decisions: input.decisions,
    pinnedCoreSnapshotHash: input.pinnedCoreSnapshotHash,
    pinnedGbpSnapshotHash: input.pinnedGbpSnapshotHash,
    coreSnapshot,
    gbpSnapshot,
  });
  if (staleSnapshotSummary) {
    return { summary: staleSnapshotSummary };
  }

  return runPublishExecutionPhase({
    client,
    restaurantId,
    publishBatch,
    publishJobId,
    input,
    plan,
    operationGroups,
    operationGroupIdByKey,
    coreSnapshot,
    gbpSnapshot,
    registry,
    runtimeControls,
    ports,
    exportPreflight,
    googleEditThrottle: options.googleEditThrottle,
    readCoreSnapshot,
    readGbpSnapshot,
  });
}
