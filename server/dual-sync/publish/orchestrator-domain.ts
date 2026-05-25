import { randomUUID } from 'node:crypto';

import { hashCanonicalJson } from '../hashing';

import type { findFieldConfig } from '../registry';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type {
  DualSyncPublishBatchStatus,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroupStatus,
  DualSyncSectionKey,
} from '../types';
import type {
  DualSyncOperationFailure,
  DualSyncPublishDecision,
  DualSyncPublishJobSummary,
  DualSyncRunPublishInput,
} from './types';

export type DualSyncPublishFieldConfig = NonNullable<ReturnType<typeof findFieldConfig>>;

export function readSectionValue(
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

export function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: DualSyncPublishFieldConfig,
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

export function isImport(action: DualSyncPublishDecision['action']): boolean {
  return action === 'import_from_google';
}

export function isExport(action: DualSyncPublishDecision['action']): boolean {
  return action === 'export_to_google';
}

export function policyFailure(
  message: string,
  code: DualSyncOperationFailure['code'] = 'UNSUPPORTED_FIELD',
): DualSyncOperationFailure {
  return {
    code,
    message,
    retryable: false,
  };
}

export function buildDecisionHash(
  input: DualSyncRunPublishInput,
  fieldPolicyHash: string | null,
): string {
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

export function groupKeyForDecision(input: {
  readonly decision: DualSyncPublishDecision;
  readonly config: DualSyncPublishFieldConfig;
}): string | null {
  if (input.decision.action === 'ignore') return null;
  const writeGroup =
    input.decision.action === 'export_to_google'
      ? input.config.policy.googleWriteGroup
      : `core.${input.config.sectionKey}`;
  return writeGroup ? `${input.decision.action}:${input.decision.sectionKey}:${writeGroup}` : null;
}

export function operationGroupStatusForOperations(
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

export function batchStatusForSummary(input: {
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

export function operationGroupExecutionSummary(
  operations: ReadonlyArray<DualSyncPublishOperation>,
) {
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

export function buildSummary(input: {
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
