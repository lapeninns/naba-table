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

import { randomUUID } from 'node:crypto';

import { assertDualSyncRestaurantNotPaused } from '../controls';
import { getDualSyncDecisionDisabledReason, getDualSyncRuntimeFlags } from '../flag';
import { hashCanonicalJson } from '../hashing';
import { mapGoogleProviderErrorToPublishFailure } from './google-errors';
import { createGoogleRequestLog } from './google-request-logs';
import { reserveGoogleEditBudget, type DualSyncGoogleEditThrottle } from './google-safety';
import {
  createOperation,
  createOperationGroupsForPlan,
  createPublishBatch,
  findPublishBatchByClientRequest,
  listOperationsForJob,
  updateOperationGroupStatus,
  updateOperationStatus,
  updatePublishBatchStatus,
} from './operations';
import { validatePublishDecisionPins } from './pinning';
import { buildPublishPlan } from './planner';
import { NOOP_PORTS, type DualSyncOrchestratorPorts } from './ports';
import { defaultDualSyncExportPreflight, type DualSyncExportPreflightPort } from './preflight';
import { runWithDualSyncLock, type DualSyncLockManager } from '../locks';
import { listOpenOutboundCandidates, resolveOutboundCandidate } from '../outbound/candidates';
import { refreshFromGoogleWithoutLock } from '../refresh/service';
import { buildRegistry, findFieldConfig, resolveFieldCapability } from '../registry';
import { ensureActiveFieldPolicyVersion } from '../registry/field-policy-versions';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';
import { recomputeAllStates } from '../state/recompute';
import { markFailed, markIgnored, markInSync } from '../state/write';

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type {
  DualSyncGoogleUpdateMask,
  DualSyncPublishBatchStatus,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroupStatus,
  DualSyncSectionKey,
} from '../types';
import type {
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationFailure,
  DualSyncOperationResult,
  DualSyncPublishDecision,
  DualSyncPublishGroup,
  DualSyncPublishJobSummary,
  DualSyncRunPublishInput,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type PreparedPublishDecision = {
  readonly decision: DualSyncPublishDecision;
  readonly beforeCoreHash: string | null;
  readonly beforeGbpHash: string | null;
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly operation: DualSyncPublishOperation;
  readonly operationGroupId: string | null;
  readonly writeGroup: string | null;
  readonly googleUpdateMask: DualSyncGoogleUpdateMask | null;
};

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
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
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

function policyFailure(
  message: string,
  code: DualSyncOperationFailure['code'] = 'UNSUPPORTED_FIELD',
): DualSyncOperationFailure {
  return {
    code,
    message,
    retryable: false,
  };
}

function buildDecisionHash(input: DualSyncRunPublishInput, fieldPolicyHash: string | null): string {
  return (
    hashCanonicalJson({
      restaurantId: input.restaurantId,
      fieldPolicyHash,
      decisions: input.decisions.map((decision) => ({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        pinnedCoreHash: decision.pinnedCoreHash,
        pinnedGbpHash: decision.pinnedGbpHash,
      })),
      pinnedCoreSnapshotHash: input.pinnedCoreSnapshotHash ?? null,
      pinnedGbpSnapshotHash: input.pinnedGbpSnapshotHash ?? null,
    }) ?? randomUUID()
  );
}

function groupKeyForDecision(input: {
  readonly decision: DualSyncPublishDecision;
  readonly config: NonNullable<ReturnType<typeof findFieldConfig>>;
}): string | null {
  if (input.decision.action === 'ignore') return null;
  const writeGroup =
    input.decision.action === 'export_to_google'
      ? input.config.policy.googleWriteGroup
      : `core.${input.config.sectionKey}`;
  return writeGroup ? `${input.decision.action}:${input.decision.sectionKey}:${writeGroup}` : null;
}

function operationGroupStatusForOperations(
  operations: ReadonlyArray<DualSyncPublishOperation>,
): DualSyncPublishOperationGroupStatus {
  if (operations.length === 0) return 'skipped';
  if (operations.some((op) => op.status === 'failed')) return 'failed';
  if (operations.some((op) => op.status === 'retrying')) return 'retrying';
  if (operations.some((op) => op.status === 'pending' || op.status === 'running')) {
    return 'running';
  }
  if (operations.every((op) => op.status === 'skipped')) return 'skipped';
  if (operations.every((op) => op.status === 'succeeded')) return 'succeeded';
  return 'failed';
}

function batchStatusForSummary(input: {
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
  readonly failures: ReadonlyArray<{ readonly failure: DualSyncOperationFailure }>;
}): DualSyncPublishBatchStatus {
  if (input.failures.length > 0) return 'failed';
  if (input.operations.length === 0) return 'skipped';
  if (input.operations.some((op) => op.status === 'failed')) return 'failed';
  if (input.operations.some((op) => op.status === 'pending' || op.status === 'running')) {
    return 'running';
  }
  if (input.operations.every((op) => op.status === 'skipped')) return 'skipped';
  return 'succeeded';
}

function operationGroupExecutionSummary(operations: ReadonlyArray<DualSyncPublishOperation>) {
  return {
    operationIds: operations.map((operation) => operation.id),
    fieldKeys: operations.map((operation) => operation.fieldKey),
    counts: {
      total: operations.length,
      succeeded: operations.filter((operation) => operation.status === 'succeeded').length,
      failed: operations.filter((operation) => operation.status === 'failed').length,
      skipped: operations.filter((operation) => operation.status === 'skipped').length,
      other: operations.filter(
        (operation) =>
          operation.status !== 'succeeded' &&
          operation.status !== 'failed' &&
          operation.status !== 'skipped',
      ).length,
    },
    errorCodes: Array.from(
      new Set(
        operations
          .map((operation) => operation.errorCode)
          .filter((code): code is string => code !== null),
      ),
    ),
  };
}

async function runRequiredExportPreflights(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchId: string;
  readonly actorUserId: string | null;
  readonly planGroups: ReadonlyArray<DualSyncPublishGroup>;
  readonly operationGroupIdByKey: ReadonlyMap<string, string>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly exportPreflight: DualSyncExportPreflightPort;
}): Promise<Map<string, DualSyncOperationFailure>> {
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
  const readCore = options.readCoreSnapshot ?? readNabatableSnapshot;
  const readGbp = options.readGbpSnapshot ?? readGoogleSnapshot;

  const restaurantId = input.restaurantId;

  await assertDualSyncRestaurantNotPaused({ client, restaurantId });

  if (options.refreshGoogleBeforePublish) {
    await refreshFromGoogleWithoutLock({
      client,
      restaurantId,
      runKind: 'preflight',
      skipPull: false,
    });
  }

  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readCore({ client, restaurantId }),
    readGbp({ client, restaurantId }),
  ]);

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const fieldPolicyVersion = await ensureActiveFieldPolicyVersion({
    client,
    registry,
    restaurantId,
    createdByUserId: input.actorUserId,
  });
  const decisionHash = buildDecisionHash(input, fieldPolicyVersion.policyHash);
  const runtimeFlags = getDualSyncRuntimeFlags({ restaurantId });

  if (input.clientRequestId) {
    const existingBatch = await findPublishBatchByClientRequest({
      client,
      restaurantId,
      clientRequestId: input.clientRequestId,
    });
    if (existingBatch) {
      if (existingBatch.decisionHash !== decisionHash) {
        const failure = policyFailure(
          'Client request id was already used for a different publish decision set.',
          'INVALID_DECISION',
        );
        return {
          summary: buildSummary({
            publishJobId: existingBatch.id,
            restaurantId,
            decisions: input.decisions,
            operations: [],
            failures: input.decisions.map((decision) => ({
              fieldKey: decision.fieldKey,
              failure,
            })),
          }),
        };
      }
      const operations = await listOperationsForJob({ client, publishJobId: existingBatch.id });
      return {
        summary: buildSummary({
          publishJobId: existingBatch.id,
          restaurantId,
          decisions: input.decisions,
          operations,
          failures: [],
        }),
      };
    }
  }

  const plan = await buildPublishPlan(client, input, {
    readCoreSnapshot: async () => coreSnapshot,
    readGbpSnapshot: async () => gbpSnapshot,
  });
  const publishBatch = await createPublishBatch({
    client,
    restaurantId,
    clientRequestId: input.clientRequestId ?? null,
    actorUserId: input.actorUserId,
    decisionHash,
    pinnedCoreSnapshotHash: input.pinnedCoreSnapshotHash ?? null,
    pinnedGbpSnapshotHash: input.pinnedGbpSnapshotHash ?? null,
    coreSnapshotHash: plan.coreSnapshotHash,
    gbpSnapshotHash: plan.gbpSnapshotHash,
    fieldPolicyVersionId: fieldPolicyVersion.id,
    fieldPolicyHash: fieldPolicyVersion.policyHash,
    acceptedCount: plan.acceptedCount,
    rejectedCount: plan.rejectedCount,
    ignoredCount: plan.ignoredCount,
    planSummary: {
      groups: plan.groups,
      rejected: plan.rejected,
      warnings: plan.warnings,
    },
  });
  const publishJobId = publishBatch.id;
  const operationGroups = await createOperationGroupsForPlan({
    client,
    restaurantId,
    publishBatchId: publishBatch.id,
    groups: plan.groups,
  });
  const operationGroupIdByKey = new Map(
    operationGroups.map((group) => [group.groupKey, group.id] as const),
  );

  // Snapshot-level pinning check (cheap pre-flight, done once). A stale
  // snapshot pin rejects the whole job before any provider side effect.
  if (input.pinnedCoreSnapshotHash !== undefined && input.pinnedCoreSnapshotHash !== null) {
    const currentCoreHash = hashCanonicalJson(coreSnapshot);
    if (currentCoreHash !== input.pinnedCoreSnapshotHash) {
      const failure: DualSyncOperationFailure = {
        code: 'CORE_DRIFT',
        message: 'Core snapshot moved since the operator viewed the diff.',
        retryable: false,
      };
      await updatePublishBatchStatus({
        client,
        publishBatchId: publishBatch.id,
        status: 'stale',
        errorCode: failure.code,
        errorMessage: failure.message,
        finishedAt: new Date().toISOString(),
      });
      await recomputeAllStates({ client, restaurantId, coreSnapshot, gbpSnapshot });
      return {
        summary: buildSummary({
          publishJobId,
          restaurantId,
          decisions: input.decisions,
          operations: [],
          failures: input.decisions.map((decision) => ({ fieldKey: decision.fieldKey, failure })),
        }),
      };
    }
  }
  if (input.pinnedGbpSnapshotHash !== undefined && input.pinnedGbpSnapshotHash !== null) {
    const currentGbpHash = hashCanonicalJson(gbpSnapshot);
    if (currentGbpHash !== input.pinnedGbpSnapshotHash) {
      const failure: DualSyncOperationFailure = {
        code: 'GBP_DRIFT',
        message: 'Google snapshot moved since the operator viewed the diff.',
        retryable: false,
      };
      await updatePublishBatchStatus({
        client,
        publishBatchId: publishBatch.id,
        status: 'stale',
        errorCode: failure.code,
        errorMessage: failure.message,
        finishedAt: new Date().toISOString(),
      });
      await recomputeAllStates({ client, restaurantId, coreSnapshot, gbpSnapshot });
      return {
        summary: buildSummary({
          publishJobId,
          restaurantId,
          decisions: input.decisions,
          operations: [],
          failures: input.decisions.map((decision) => ({ fieldKey: decision.fieldKey, failure })),
        }),
      };
    }
  }

  const preflightFailures = await runRequiredExportPreflights({
    client,
    restaurantId,
    publishBatchId: publishBatch.id,
    actorUserId: input.actorUserId,
    planGroups: plan.groups,
    operationGroupIdByKey,
    coreSnapshot,
    gbpSnapshot,
    exportPreflight,
  });

  const failures: Array<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }> = [];
  const prepared: PreparedPublishDecision[] = [];
  await updatePublishBatchStatus({
    client,
    publishBatchId: publishBatch.id,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  // Validate every decision before any provider write can happen. Then
  // open operation rows for each write attempt before invoking ports.
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

    const pinValidationFailure = validatePublishDecisionPins(decision);
    if (pinValidationFailure) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: pinValidationFailure,
      });
      continue;
    }

    const preflightFailure = preflightFailures.get(decision.fieldKey);
    if (preflightFailure) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: preflightFailure,
      });
      continue;
    }

    const coreValue = valueForField(coreSnapshot, config, 'core');
    const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
    const beforeCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
    const beforeGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));

    if (beforeCoreHash !== decision.pinnedCoreHash) {
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
    if (beforeGbpHash !== decision.pinnedGbpHash) {
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

    if (decision.sectionKey !== config.sectionKey) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: policyFailure(
          `Field ${decision.fieldKey} belongs to ${config.sectionKey}, not ${decision.sectionKey}.`,
          'INVALID_DECISION',
        ),
      });
      continue;
    }

    const capability = resolveFieldCapability({ config, coreValue, gbpValue });
    const flagDisabledReason = getDualSyncDecisionDisabledReason(
      {
        action: decision.action,
        sectionKey: config.sectionKey,
        riskLevel: config.policy.riskLevel,
        requiresManualReview: config.policy.requiresManualReview,
      },
      runtimeFlags,
    );
    if (flagDisabledReason) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: policyFailure(flagDisabledReason),
      });
      continue;
    }

    if (decision.action === 'import_from_google' && !capability.canImport) {
      failures.push({
        fieldKey: decision.fieldKey,
        failure: policyFailure(
          capability.blockedReasons[0] ?? 'Field policy does not allow importing this field.',
        ),
      });
      continue;
    }
    if (decision.action === 'export_to_google') {
      if (!capability.canExport) {
        failures.push({
          fieldKey: decision.fieldKey,
          failure: policyFailure(
            config.policy.noWriteReason ??
              config.exportBlockedReason ??
              capability.blockedReasons[0] ??
              'Field policy does not allow exporting this field.',
          ),
        });
        continue;
      }
      if (config.policy.requiresManualReview && input.actorUserId === null) {
        failures.push({
          fieldKey: decision.fieldKey,
          failure: policyFailure('Field requires manual review before it can be exported.'),
        });
        continue;
      }
      if (!config.policy.googleWriteGroup) {
        failures.push({
          fieldKey: decision.fieldKey,
          failure: policyFailure(
            config.policy.noWriteReason ?? 'Field policy has no Google write group.',
          ),
        });
        continue;
      }
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
    const operationGroupId =
      operationGroupIdByKey.get(groupKeyForDecision({ decision, config }) ?? '') ?? null;
    const operation = await createOperation({
      client,
      restaurantId,
      publishJobId,
      publishBatchId: publishBatch.id,
      operationGroupId,
      sectionKey: decision.sectionKey,
      fieldKey: decision.fieldKey,
      direction,
      beforeCoreHash,
      beforeGbpHash,
      googleUpdateMask: config.googleUpdateMask ?? null,
    });

    prepared.push({
      decision,
      beforeCoreHash,
      beforeGbpHash,
      direction,
      operation,
      operationGroupId,
      writeGroup:
        direction === 'export_to_google' ? (config.policy.googleWriteGroup ?? null) : null,
      googleUpdateMask: config.googleUpdateMask ?? null,
    });
  }

  const prebuiltResults = await runBatchExportPorts({
    ports,
    decisions: prepared
      .filter((item) => item.direction === 'export_to_google')
      .map((item) => item.decision),
    coreSnapshot,
    gbpSnapshot,
    registry,
    client,
    publishJobId,
    restaurantId,
    actorUserId: input.actorUserId,
    googleEditThrottle: options.googleEditThrottle,
  });

  const runningOperationGroups = new Set<string>();
  for (const item of prepared) {
    const { decision, beforeCoreHash, beforeGbpHash, operation } = item;
    const startedAt = new Date().toISOString();
    if (item.operationGroupId && !runningOperationGroups.has(item.operationGroupId)) {
      runningOperationGroups.add(item.operationGroupId);
      await updateOperationGroupStatus({
        client,
        operationGroupId: item.operationGroupId,
        status: 'running',
        startedAt,
      });
    }
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
        if (isImport(decision.action)) {
          result = await ports.applyImportToCore(ctx);
        } else if (isExport(decision.action)) {
          const throttleFailure = await reserveGoogleEditBudget({
            throttle: options.googleEditThrottle,
            restaurantId,
            writeGroup: item.operationGroupId ?? decision.sectionKey,
          });
          result = throttleFailure
            ? { status: 'failed', failure: throttleFailure }
            : await ports.applyExportToGoogle(ctx);
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

    if (isExport(decision.action)) {
      await createGoogleRequestLog({
        client,
        restaurantId,
        publishBatchId: publishBatch.id,
        operationGroupId: item.operationGroupId,
        publishOperationId: operation.id,
        publishJobId,
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
  for (const group of operationGroups) {
    const groupOperations = operations.filter((op) => op.operationGroupId === group.id);
    const groupStatus = operationGroupStatusForOperations(groupOperations);
    const firstFailure = groupOperations.find((op) => op.status === 'failed');
    await updateOperationGroupStatus({
      client,
      operationGroupId: group.id,
      status: groupStatus,
      responseSummary: operationGroupExecutionSummary(groupOperations),
      errorCode: firstFailure?.errorCode ?? null,
      errorMessage: firstFailure?.errorMessage ?? null,
      finishedAt:
        groupStatus === 'running' || groupStatus === 'retrying' ? null : new Date().toISOString(),
    });
  }
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

  await updatePublishBatchStatus({
    client,
    publishBatchId: publishBatch.id,
    status: batchStatusForSummary({ operations, failures }),
    finishedAt: new Date().toISOString(),
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
      // A throw means every decision in the group fails; the per-field
      // loop will then write one operation row per fieldKey with the
      // shared failure.
      const message = error instanceof Error ? error.message : String(error);
      for (const decision of group.decisions) {
        out.set(decision.fieldKey, {
          status: 'failed',
          failure: mapGoogleProviderErrorToPublishFailure(error, `Batch export failed: ${message}`),
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
