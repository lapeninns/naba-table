/**
 * Phase 3f of the unified dual-sync engine.
 *
 * Concrete `applyExportToGoogle` port for `operatingHours.weekly.N` rows.
 *
 * Reuses the legacy push helper, narrowing the selection to a single day
 * so the orchestrator's per-field semantics are preserved.
 */

import { syncRestaurantOperatingHoursWithGoogleBusinessProfile } from '@/server/google-business-profile/service';

import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

const FIELD_KEY_PREFIX = 'operatingHours.weekly.';

function parseDayOfWeek(fieldKey: string): number | null {
  if (!fieldKey.startsWith(FIELD_KEY_PREFIX)) return null;
  const tail = fieldKey.slice(FIELD_KEY_PREFIX.length);
  const day = Number.parseInt(tail, 10);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  return day;
}

export async function applyOperatingHoursExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const dayOfWeek = parseDayOfWeek(decision.fieldKey);
  if (dayOfWeek === null) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Operating-hours export port does not handle ${decision.fieldKey}.`,
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

  await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
    restaurantId,
    direction: 'push_to_gbp',
    selection: { weeklyDays: [dayOfWeek] },
    client,
  });

  const targetedDay = coreSnapshot.operatingHours?.weekly.find(
    (entry) => entry.dayOfWeek === dayOfWeek,
  );
  const canonical = config.canonicalizeCoreValue({
    weekly: targetedDay
      ? [
          {
            dayOfWeek: targetedDay.dayOfWeek,
            opensAt: targetedDay.opensAt,
            closesAt: targetedDay.closesAt,
            isClosed: targetedDay.isClosed,
          },
        ]
      : [],
  });
  const hash = hashCanonicalJson(canonical);
  return { status: 'succeeded', afterCoreHash: hash, afterGbpHash: hash };
}

/**
 * Section-level batch port for operating hours.
 *
 * The legacy push helper already accepts `selection.weeklyDays:
 * number[]`, so the multi-decision case turns into a single push call
 * covering every requested day. The orchestrator then writes one
 * `dual_sync_publish_operations` row per decision and reuses the
 * batch-derived per-field result.
 */
export async function applyOperatingHoursExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  const { client, restaurantId, decisions, coreSnapshot, gbpSnapshot } = ctx;
  if (decisions.length === 0) return { supported: true, perField: {} };

  // Resolve every decision in the batch to a day-of-week. Any decision
  // with an invalid fieldKey falls back to the per-field path.
  const dayByFieldKey = new Map<string, number>();
  for (const decision of decisions) {
    const day = parseDayOfWeek(decision.fieldKey);
    if (day === null) return { supported: false };
    dayByFieldKey.set(decision.fieldKey, day);
  }

  const registry = buildRegistry({
    coreSnapshot,
    gbpSnapshot,
    includeCoreOnly: false,
  });

  const weeklyDays = Array.from(new Set(dayByFieldKey.values())).sort((a, b) => a - b);

  try {
    await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
      restaurantId,
      direction: 'push_to_gbp',
      selection: { weeklyDays },
      client,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed: Record<string, DualSyncOperationResult> = {};
    for (const decision of decisions) {
      failed[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: `Operating-hours batch export failed: ${message}`,
          retryable: true,
        },
      };
    }
    return { supported: true, perField: failed };
  }

  const perField: Record<string, DualSyncOperationResult> = {};
  for (const decision of decisions) {
    const day = dayByFieldKey.get(decision.fieldKey);
    if (day === undefined) continue;
    const config = findFieldConfig(registry, decision.fieldKey);
    if (!config) {
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'INVALID_DECISION',
          message: `Field ${decision.fieldKey} is not in the registry.`,
          retryable: false,
        },
      };
      continue;
    }
    const targetedDay = coreSnapshot.operatingHours?.weekly.find(
      (entry) => entry.dayOfWeek === day,
    );
    const canonical = config.canonicalizeCoreValue({
      weekly: targetedDay
        ? [
            {
              dayOfWeek: targetedDay.dayOfWeek,
              opensAt: targetedDay.opensAt,
              closesAt: targetedDay.closesAt,
              isClosed: targetedDay.isClosed,
            },
          ]
        : [],
    });
    const hash = hashCanonicalJson(canonical);
    perField[decision.fieldKey] = {
      status: 'succeeded',
      afterCoreHash: hash,
      afterGbpHash: hash,
    };
  }

  return { supported: true, perField };
}
