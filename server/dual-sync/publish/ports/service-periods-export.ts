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

import {
  applyServicePeriodsBatchFailure,
  buildServicePeriodsExportMissingCoreFailure,
  buildServicePeriodsExportPortFailure,
  buildServicePeriodsExportSuccess,
  buildServicePeriodsExportWeekdayFailure,
  parseServicePeriodExportStableKey,
  planServicePeriodsExportBatch,
  resolveServicePeriodExportDecision,
  resolveServicePeriodsExportFieldConfig,
} from './service-periods-export-domain';
import { buildRegistry } from '../../registry';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

export async function applyServicePeriodsExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const stableKey = parseServicePeriodExportStableKey(decision.fieldKey);
  if (!stableKey) {
    return buildServicePeriodsExportPortFailure(
      `Service-periods export port does not handle ${decision.fieldKey}.`,
    );
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });
  const configResult = resolveServicePeriodsExportFieldConfig(registry, decision.fieldKey);
  if (configResult.status === 'failed') return configResult.result;

  const resolvedResult = resolveServicePeriodExportDecision({
    fieldKey: decision.fieldKey,
    coreSnapshot,
    gbpSnapshot,
  });
  if (!resolvedResult.supported) {
    return buildServicePeriodsExportPortFailure(
      `Service-periods export port does not handle ${decision.fieldKey}.`,
    );
  }

  const { resolved } = resolvedResult;
  if (!resolved.corePeriod) return buildServicePeriodsExportMissingCoreFailure(stableKey);
  if (resolved.dayOfWeek === null) return buildServicePeriodsExportWeekdayFailure();

  await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
    restaurantId,
    direction: 'push_to_gbp',
    selection: { dayOfWeeks: [resolved.dayOfWeek] },
    client,
  });

  return buildServicePeriodsExportSuccess(configResult.config, resolved.corePeriod);
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

  const plan = planServicePeriodsExportBatch({ decisions, coreSnapshot, gbpSnapshot });
  if (!plan.supported) return { supported: false };
  if (plan.exportable.length === 0) return { supported: true, perField: plan.perField };

  try {
    await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
      restaurantId,
      direction: 'push_to_gbp',
      selection: { dayOfWeeks: [...plan.dayOfWeeks] },
      client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      supported: true,
      perField: applyServicePeriodsBatchFailure(
        plan.perField,
        plan.exportable,
        `Service-periods batch export failed: ${message}`,
      ),
    };
  }

  const perField = { ...plan.perField };
  for (const entry of plan.exportable) {
    const configResult = resolveServicePeriodsExportFieldConfig(registry, entry.fieldKey);
    if (configResult.status === 'failed') {
      perField[entry.fieldKey] = configResult.result;
      continue;
    }
    perField[entry.fieldKey] = buildServicePeriodsExportSuccess(
      configResult.config,
      entry.corePeriod,
    );
  }
  return { supported: true, perField };
}
