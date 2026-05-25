import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig } from '../../registry';

import type { DualSyncFieldConfig } from '../../registry';
import type { DualSyncCanonicalSnapshot } from '../../snapshots/types';
import type { DualSyncOperationResult, DualSyncPublishDecision } from '../types';

export const SERVICE_PERIODS_EXPORT_FIELD_PREFIX = 'servicePeriods.';

type ServicePeriodValue = DualSyncCanonicalSnapshot['servicePeriods']['periods'][number];

export interface ResolvedServicePeriodExport {
  readonly fieldKey: string;
  readonly stableKey: string;
  readonly dayOfWeek: number | null;
  readonly corePeriod: ServicePeriodValue | null;
}

export interface ServicePeriodsExportBatchPlan {
  readonly supported: true;
  readonly perField: Record<string, DualSyncOperationResult>;
  readonly exportable: ReadonlyArray<
    ResolvedServicePeriodExport & { readonly corePeriod: ServicePeriodValue }
  >;
  readonly dayOfWeeks: ReadonlyArray<number>;
}

export function parseServicePeriodExportStableKey(fieldKey: string): string | null {
  if (!fieldKey.startsWith(SERVICE_PERIODS_EXPORT_FIELD_PREFIX)) return null;
  const tail = fieldKey.slice(SERVICE_PERIODS_EXPORT_FIELD_PREFIX.length);
  return tail.length > 0 ? tail : null;
}

export function buildServicePeriodsExportPortFailure(
  message: string,
  retryable = false,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: { code: 'PORT_FAILURE', message, retryable },
  };
}

export function buildServicePeriodsExportRegistryFailure(
  fieldKey: string,
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'INVALID_DECISION',
      message: `Field ${fieldKey} is not in the registry.`,
      retryable: false,
    },
  };
}

export function buildServicePeriodsExportMissingCoreFailure(
  stableKey: string,
): DualSyncOperationResult {
  return buildServicePeriodsExportPortFailure(
    `Core snapshot is missing service-period ${stableKey}; nothing to export.`,
    true,
  );
}

export function buildServicePeriodsExportWeekdayFailure(): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'UNSUPPORTED_FIELD',
      message: 'Google service-period export requires a specific weekday.',
      retryable: false,
    },
  };
}

export function resolveServicePeriodsExportFieldConfig(
  registry: ReadonlyArray<DualSyncFieldConfig>,
  fieldKey: string,
):
  | {
      readonly status: 'ready';
      readonly config: DualSyncFieldConfig;
    }
  | {
      readonly status: 'failed';
      readonly result: DualSyncOperationResult;
    } {
  const config = findFieldConfig(registry, fieldKey);
  if (!config) {
    return { status: 'failed', result: buildServicePeriodsExportRegistryFailure(fieldKey) };
  }
  return { status: 'ready', config };
}

export function buildServicePeriodsExportSuccess(
  config: DualSyncFieldConfig,
  corePeriod: ServicePeriodValue,
): DualSyncOperationResult {
  const canonical = config.canonicalizeCoreValue({ periods: [corePeriod] });
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

export type ResolveServicePeriodExportResult =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly resolved: ResolvedServicePeriodExport;
    };

export function resolveServicePeriodExportDecision(args: {
  readonly fieldKey: string;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}): ResolveServicePeriodExportResult {
  const stableKey = parseServicePeriodExportStableKey(args.fieldKey);
  if (!stableKey) return { supported: false };

  const corePeriod =
    args.coreSnapshot.servicePeriods?.periods.find((period) => period.stableKey === stableKey) ??
    null;
  const googlePeriod =
    args.gbpSnapshot.servicePeriods?.periods.find((period) => period.stableKey === stableKey) ??
    null;
  const dayOfWeek = corePeriod?.dayOfWeek ?? googlePeriod?.dayOfWeek ?? null;

  return {
    supported: true,
    resolved: {
      fieldKey: args.fieldKey,
      stableKey,
      dayOfWeek,
      corePeriod,
    },
  };
}

export type PlanServicePeriodsExportBatchResult =
  | { readonly supported: false }
  | ServicePeriodsExportBatchPlan;

export function planServicePeriodsExportBatch(args: {
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
}): PlanServicePeriodsExportBatchResult {
  const perField: Record<string, DualSyncOperationResult> = {};
  const exportable: Array<
    ResolvedServicePeriodExport & { readonly corePeriod: ServicePeriodValue }
  > = [];

  for (const decision of args.decisions) {
    const result = resolveServicePeriodExportDecision({
      fieldKey: decision.fieldKey,
      coreSnapshot: args.coreSnapshot,
      gbpSnapshot: args.gbpSnapshot,
    });
    if (!result.supported) return { supported: false };
    const { resolved } = result;
    if (!resolved.corePeriod) {
      perField[resolved.fieldKey] = buildServicePeriodsExportMissingCoreFailure(resolved.stableKey);
      continue;
    }
    if (resolved.dayOfWeek === null) {
      perField[resolved.fieldKey] = buildServicePeriodsExportWeekdayFailure();
      continue;
    }
    exportable.push({ ...resolved, corePeriod: resolved.corePeriod });
  }

  const dayOfWeeks = Array.from(new Set(exportable.map((entry) => entry.dayOfWeek as number))).sort(
    (a, b) => a - b,
  );

  return {
    supported: true,
    perField,
    exportable,
    dayOfWeeks,
  };
}

export function applyServicePeriodsBatchFailure(
  perField: Record<string, DualSyncOperationResult>,
  exportable: ReadonlyArray<Pick<ResolvedServicePeriodExport, 'fieldKey'>>,
  message: string,
): Record<string, DualSyncOperationResult> {
  const next = { ...perField };
  for (const entry of exportable) {
    next[entry.fieldKey] = buildServicePeriodsExportPortFailure(message, true);
  }
  return next;
}
