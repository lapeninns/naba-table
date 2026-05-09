/**
 * Phase 3f of the unified dual-sync engine.
 *
 * Concrete `applyExportToGoogle` port for `servicePeriods.<stableKey>` rows.
 *
 * Maps the targeted period back to its `dayOfWeek` and reuses the legacy
 * push helper. Periods with `dayOfWeek === null` are not exportable to
 * Google because the GBP "more hours" API requires a weekday.
 */

import { syncRestaurantServicePeriodsWithGoogleBusinessProfile } from '@/server/google-business-profile/service';

import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

const FIELD_KEY_PREFIX = 'servicePeriods.';

function parseStableKey(fieldKey: string): string | null {
  if (!fieldKey.startsWith(FIELD_KEY_PREFIX)) return null;
  const tail = fieldKey.slice(FIELD_KEY_PREFIX.length);
  return tail.length > 0 ? tail : null;
}

export async function applyServicePeriodsExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const stableKey = parseStableKey(decision.fieldKey);
  if (!stableKey) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Service-periods export port does not handle ${decision.fieldKey}.`,
        retryable: false,
      },
    };
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, decision.fieldKey);
  if (!config) {
    return {
      status: 'failed',
      failure: {
        code: 'INVALID_DECISION',
        message: `Field ${decision.fieldKey} is not in the registry.`,
        retryable: false,
      },
    };
  }

  const corePeriod =
    coreSnapshot.servicePeriods?.periods.find((p) => p.stableKey === stableKey) ?? null;
  const googlePeriod =
    gbpSnapshot.servicePeriods?.periods.find((p) => p.stableKey === stableKey) ?? null;

  if (!corePeriod) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Core snapshot is missing service-period ${stableKey}; nothing to export.`,
        retryable: true,
      },
    };
  }

  const dayOfWeek = corePeriod.dayOfWeek ?? googlePeriod?.dayOfWeek ?? null;
  if (dayOfWeek === null) {
    return {
      status: 'failed',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: 'Google service-period export requires a specific weekday.',
        retryable: false,
      },
    };
  }

  await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
    restaurantId,
    direction: 'push_to_gbp',
    selection: { dayOfWeeks: [dayOfWeek] },
    client,
  });

  const canonical = config.canonicalizeCoreValue({ periods: [corePeriod] });
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

/**
 * Section-level batch port for service periods.
 *
 * Resolves each decision to a `(stableKey, dayOfWeek)` pair, deduplicates
 * the day list, and issues one push call with `selection.dayOfWeeks =
 * [d1, d2, ...]`. Decisions whose period has `dayOfWeek === null` are
 * reported as `UNSUPPORTED_FIELD` per-field so they don't poison the
 * batch.
 */
export async function applyServicePeriodsExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  const { client, restaurantId, decisions, coreSnapshot, gbpSnapshot } = ctx;
  if (decisions.length === 0) return { supported: true, perField: {} };

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });

  interface Resolved {
    readonly fieldKey: string;
    readonly stableKey: string;
    readonly dayOfWeek: number | null;
    readonly corePeriod: NonNullable<typeof coreSnapshot.servicePeriods>['periods'][number] | null;
  }

  const resolved: Resolved[] = [];
  for (const decision of decisions) {
    const stableKey = parseStableKey(decision.fieldKey);
    if (!stableKey) return { supported: false };
    const corePeriod =
      coreSnapshot.servicePeriods?.periods.find((p) => p.stableKey === stableKey) ?? null;
    const googlePeriod =
      gbpSnapshot.servicePeriods?.periods.find((p) => p.stableKey === stableKey) ?? null;
    const day = corePeriod?.dayOfWeek ?? googlePeriod?.dayOfWeek ?? null;
    resolved.push({ fieldKey: decision.fieldKey, stableKey, dayOfWeek: day, corePeriod });
  }

  const perField: Record<string, DualSyncOperationResult> = {};

  // Pre-process: surface UNSUPPORTED_FIELD / missing-core failures up
  // front so the push call only sees decisions that can actually run.
  const exportable: Resolved[] = [];
  for (const r of resolved) {
    if (!r.corePeriod) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Core snapshot is missing service-period ${r.stableKey}; nothing to export.`,
          retryable: true,
        },
      };
      continue;
    }
    if (r.dayOfWeek === null) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'UNSUPPORTED_FIELD',
          message: 'Google service-period export requires a specific weekday.',
          retryable: false,
        },
      };
      continue;
    }
    exportable.push(r);
  }

  if (exportable.length === 0) {
    return { supported: true, perField };
  }

  const dayOfWeeks = Array.from(new Set(exportable.map((r) => r.dayOfWeek as number))).sort(
    (a, b) => a - b,
  );

  try {
    await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
      restaurantId,
      direction: 'push_to_gbp',
      selection: { dayOfWeeks },
      client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const r of exportable) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Service-periods batch export failed: ${message}`,
          retryable: true,
        },
      };
    }
    return { supported: true, perField };
  }

  for (const r of exportable) {
    const config = findFieldConfig(registry, r.fieldKey);
    if (!config) {
      perField[r.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'INVALID_DECISION',
          message: `Field ${r.fieldKey} is not in the registry.`,
          retryable: false,
        },
      };
      continue;
    }
    const canonical = config.canonicalizeCoreValue({ periods: [r.corePeriod!] });
    const hash = hashCanonicalJson(canonical);
    perField[r.fieldKey] = {
      status: 'succeeded',
      afterCoreHash: hash,
      afterGbpHash: hash,
    };
  }
  return { supported: true, perField };
}
