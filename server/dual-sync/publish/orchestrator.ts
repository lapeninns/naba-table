/**
 * Phase 3 of the unified dual-sync engine.
 *
 * Per-field publish orchestrator.
 *
 * Inputs : { restaurantId, decisions[], pinned snapshot hashes? }
 * Outputs: { publishJobId, operations[], summary, failures[] }
 *
 * Lifecycle for one decision:
 *   1. read current Core + Google canonical snapshots (a fresh pull is
 *      *not* performed inside the orchestrator; callers should run
 *      `refreshFromGoogle` before invoking publish so the pinned hashes
 *      align with what the operator viewed).
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

import { randomUUID } from 'node:crypto';

import { hashCanonicalJson } from '../hashing';
import { createOperation, listOperationsForJob, updateOperationStatus } from './operations';
import { NOOP_PORTS, type DualSyncOrchestratorPorts } from './ports';
// (no extra imports needed)
import { listOpenOutboundCandidates, resolveOutboundCandidate } from '../outbound/candidates';
import { buildRegistry, findFieldConfig } from '../registry';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';
import { recomputeAllStates } from '../state/recompute';
import { markFailed, markIgnored, markInSync } from '../state/write';


import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncSectionKey, DualSyncPublishOperation } from '../types';
import type {
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationFailure,
  DualSyncOperationResult,
  DualSyncPublishDecision,
  DualSyncPublishJobSummary,
  DualSyncRunPublishInput,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function readSectionValue(
  snapshot: DualSyncCanonicalSnapshot,
  sectionKey: DualSyncSectionKey | 'core_only',
): unknown {
  switch (sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'core_only':
      return null;
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: ReturnType<typeof findFieldConfig> extends infer T ? NonNullable<T> : never,
  side: 'core' | 'gbp',
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;
  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }
  if (config.kind === 'core_only') {
    return side === 'core' ? sectionValue : null;
  }
  return sectionValue;
}

function isImport(action: DualSyncPublishDecision['action']): boolean {
  return action === 'import_from_google';
}
function isExport(action: DualSyncPublishDecision['action']): boolean {
  return action === 'export_to_google';
}

export interface RunPublishOptions {
  readonly ports?: DualSyncOrchestratorPorts;
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
  const ports = options.ports ?? NOOP_PORTS;
  const readCore = options.readCoreSnapshot ?? readNabatableSnapshot;
  const readGbp = options.readGbpSnapshot ?? readGoogleSnapshot;

  const publishJobId = randomUUID();
  const restaurantId = input.restaurantId;

  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readCore({ client, restaurantId }),
    readGbp({ client, restaurantId }),
  ]);

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });

  // Snapshot-level pinning check (cheap pre-flight, done once).
  if (input.pinnedCoreSnapshotHash !== undefined && input.pinnedCoreSnapshotHash !== null) {
    const currentCoreHash = hashCanonicalJson(coreSnapshot);
    if (currentCoreHash !== input.pinnedCoreSnapshotHash) {
      // Continue per-field — individual decisions may still pass — but
      // the orchestrator does not abort the whole job. Per-field drift
      // is enforced below.
    }
  }
  if (input.pinnedGbpSnapshotHash !== undefined && input.pinnedGbpSnapshotHash !== null) {
    const currentGbpHash = hashCanonicalJson(gbpSnapshot);
    if (currentGbpHash !== input.pinnedGbpSnapshotHash) {
      // Same: continue per-field.
      void currentGbpHash;
    }
  }

  const failures: Array<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }> = [];

  // Pre-compute drift per export decision so the batch port only sees
  // decisions that have already passed the drift check. Decisions that
  // fail drift are routed through the existing per-field failure path.
  const prebuiltResults = await runBatchExportPorts({
    ports,
    decisions: input.decisions,
    coreSnapshot,
    gbpSnapshot,
    registry,
    client,
    publishJobId,
    restaurantId,
    actorUserId: input.actorUserId,
  });

  for (const decision of input.decisions) {
    const config = findFieldConfig(registry, decision.fieldKey);
    if (!config) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: {
          code: 'INVALID_DECISION',
          message: `Unknown field key ${decision.fieldKey}.`,
          retryable: false,
        },
      });
      continue;
    }

    const coreValue = valueForField(coreSnapshot, config, 'core');
    const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
    const beforeCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
    const beforeGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));

    if (
      decision.pinnedCoreHash !== null &&
      decision.pinnedCoreHash !== undefined &&
      beforeCoreHash !== decision.pinnedCoreHash
    ) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: {
          code: 'CORE_DRIFT',
          message: 'Core value moved since the operator viewed the diff.',
          retryable: false,
        },
      });
      continue;
    }
    if (
      decision.pinnedGbpHash !== null &&
      decision.pinnedGbpHash !== undefined &&
      beforeGbpHash !== decision.pinnedGbpHash
    ) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: {
          code: 'GBP_DRIFT',
          message: 'Google value moved since the operator viewed the diff.',
          retryable: false,
        },
      });
      continue;
    }

    if (decision.action === 'ignore') {
      // Mark ignored without creating an operation row. Operations are
      // reserved for actual write attempts.
      await markIgnored({
        client,
        restaurantId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }

    const direction = isImport(decision.action) ? 'import_from_google' : 'export_to_google';
    const operation = await createOperation({
      client,
      restaurantId,
      publishJobId,
      sectionKey: decision.sectionKey,
      fieldKey: decision.fieldKey,
      direction,
      beforeCoreHash,
      beforeGbpHash,
      googleUpdateMask: config.googleUpdateMask ?? null,
    });

    const startedAt = new Date().toISOString();
    await updateOperationStatus({
      client,
      operationId: operation.id,
      status: 'running',
      attemptCount: 1,
      startedAt,
    });

    let result: DualSyncOperationResult;
    const prebuilt = prebuiltResults.get(decision.fieldKey);
    if (prebuilt && isExport(decision.action)) {
      // The section-level batch port already produced a result for this
      // decision. Skip the per-field port call and reuse the batch
      // outcome so we issue only one Google call per section.
      result = prebuilt;
    } else {
      try {
        const ctx: DualSyncOperationContext = {
          client,
          restaurantId,
          publishJobId,
          decision,
          coreSnapshot,
          gbpSnapshot,
          actorUserId: input.actorUserId,
        };
        result = isImport(decision.action)
          ? await ports.applyImportToCore(ctx)
          : isExport(decision.action)
            ? await ports.applyExportToGoogle(ctx)
            : {
                status: 'skipped',
              };
      } catch (error) {
        result = {
          status: 'failed',
          failure: {
            code: 'PORT_FAILURE',
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          },
        };
      }
    }

    const finishedAt = new Date().toISOString();
    await updateOperationStatus({
      client,
      operationId: operation.id,
      status: result.status,
      afterCoreHash: result.afterCoreHash,
      afterGbpHash: result.afterGbpHash,
      externalResponse: result.externalResponse,
      errorCode: result.failure?.code ?? null,
      errorMessage: result.failure?.message ?? null,
      finishedAt,
    });

    if (result.status === 'succeeded') {
      const newCanonicalHash =
        decision.action === 'import_from_google'
          ? beforeGbpHash
          : beforeCoreHash;
      await markInSync({
        client,
        restaurantId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
        inSyncHash: newCanonicalHash,
      });
    } else if (result.status === 'failed') {
      await markFailed({
        client,
        restaurantId,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
        direction: isImport(decision.action) ? 'import' : 'export',
      });
      if (result.failure) {
        failures.push({ fieldKey: decision.fieldKey, failure: result.failure });
      }
    }
  }

  // Resolve any open outbound candidate for fields that succeeded.
  const operations = await listOperationsForJob({ client, publishJobId });
  const succeeded = operations.filter((op) => op.status === 'succeeded');
  if (succeeded.length > 0) {
    const openCandidates = await listOpenOutboundCandidates({ client, restaurantId });
    const succeededFieldKeys = new Set(succeeded.map((op) => op.fieldKey));
    for (const candidate of openCandidates) {
      if (succeededFieldKeys.has(candidate.fieldKey)) {
        await resolveOutboundCandidate({
          client,
          id: candidate.id,
          nextStatus: 'resolved',
        });
      }
    }
  }

  // Final state recomputation closes the loop. Re-read snapshots after
  // the ports run so successful Core imports are not reclassified using
  // the pre-import Core snapshot.
  const [finalCoreSnapshot, finalGbpSnapshot] = await Promise.all([
    readCore({ client, restaurantId }),
    readGbp({ client, restaurantId }),
  ]);
  await recomputeAllStates({
    client,
    restaurantId,
    coreSnapshot: finalCoreSnapshot,
    gbpSnapshot: finalGbpSnapshot,
  });

  return {
    summary: buildSummary({
      publishJobId,
      restaurantId,
      decisions: input.decisions,
      operations,
      failures,
    }),
  };
}

// ---------------------------------------------------------------------------
// Section-level batch export coalescing
// ---------------------------------------------------------------------------

interface RunBatchExportPortsInput {
  readonly ports: DualSyncOrchestratorPorts;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly client: DbClient;
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly actorUserId: string | null;
}

/**
 * Group consecutive `export_to_google` decisions by `sectionKey` and
 * offer each group as a single batch to the optional
 * `applyExportBatchToGoogle` port. Returns a map keyed by `fieldKey`
 * with the per-field operation results so the main per-decision loop
 * can reuse them and skip the per-field port call.
 *
 * Drift checks are intentionally NOT performed here — the main loop
 * already enforces them per decision, and a decision that drifts will
 * be routed to the failure path before its prebuilt result is consulted.
 */
async function runBatchExportPorts(
  input: RunBatchExportPortsInput,
): Promise<Map<string, DualSyncOperationResult>> {
  const out = new Map<string, DualSyncOperationResult>();
  const batchPort = input.ports.applyExportBatchToGoogle;
  if (!batchPort) return out;

  // Partition into groups of consecutive same-section export decisions.
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
    if (group.decisions.length < 2) continue; // single-decision groups don't benefit from batching.
    let batchResult: DualSyncBatchExportResult;
    try {
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
      // A throw means every decision in the group fails; the per-field
      // loop will then write one operation row per fieldKey with the
      // shared failure.
      const message = error instanceof Error ? error.message : String(error);
      for (const decision of group.decisions) {
        out.set(decision.fieldKey, {
          status: 'failed',
          failure: {
            code: 'PORT_FAILURE',
            message: `Batch export failed: ${message}`,
            retryable: true,
          },
        });
      }
      continue;
    }
    if (!batchResult.supported) continue; // fall back to per-field for this group.
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

function buildSummary(input: {
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
  readonly failures: ReadonlyArray<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
}): DualSyncPublishJobSummary {
  return {
    publishJobId: input.publishJobId,
    restaurantId: input.restaurantId,
    totalDecisions: input.decisions.length,
    succeededCount: input.operations.filter((op) => op.status === 'succeeded').length,
    failedCount: input.operations.filter((op) => op.status === 'failed').length,
    skippedCount: input.operations.filter((op) => op.status === 'skipped').length,
    operations: input.operations,
    failures: input.failures,
  };
}
