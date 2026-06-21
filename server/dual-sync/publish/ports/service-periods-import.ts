/**
 * Phase 3e of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` port for `servicePeriods.<stableKey>` rows.
 *
 * Reads the current Nabatable service periods, finds the targeted entry
 * by `stableKey` (computed identically to the snapshot reader), splices in
 * the Google canonical row (or removes it when Google is missing the
 * key), and writes back via `updateServicePeriods` so the dual-sync
 * `core_writes/service-periods.ts` wrapper does NOT re-queue an outbound
 * candidate.
 */

import {
  getServicePeriods,
  updateServicePeriods,
  type ServicePeriod,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';

import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig, buildRegistry } from '../../registry';

import type { DualSyncServicePeriod } from '../../snapshots/types';
import type {
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

const FIELD_KEY_PREFIX = 'servicePeriods.';

function parseStableKey(fieldKey: string): string | null {
  if (!fieldKey.startsWith(FIELD_KEY_PREFIX)) return null;
  const tail = fieldKey.slice(FIELD_KEY_PREFIX.length);
  return tail.length > 0 ? tail : null;
}

function stableServicePeriodKey(period: {
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
  name: string;
}): string {
  return [
    period.dayOfWeek === null ? 'any' : String(period.dayOfWeek),
    period.startTime,
    period.endTime,
    period.bookingOption,
    period.name.trim().toLowerCase(),
  ].join('|');
}

function findGooglePeriod(
  ctx: DualSyncOperationContext,
  stableKey: string,
): DualSyncServicePeriod | null {
  const periods = ctx.gbpSnapshot.servicePeriods?.periods ?? [];
  return periods.find((entry) => entry.stableKey === stableKey) ?? null;
}

function periodToUpdateEntry(
  source: DualSyncServicePeriod,
  existingId: string | undefined,
): UpdateServicePeriod {
  return {
    id: existingId,
    name: source.name,
    dayOfWeek: source.dayOfWeek,
    startTime: source.startTime,
    endTime: source.endTime,
    bookingOption: source.bookingOption,
  };
}

function existingToUpdateEntry(period: ServicePeriod): UpdateServicePeriod {
  return {
    id: period.id,
    name: period.name,
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    bookingOption: period.bookingOption,
  };
}

export async function applyServicePeriodsImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const stableKey = parseStableKey(decision.fieldKey);
  if (!stableKey) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Service-periods import port does not handle field ${decision.fieldKey}.`,
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

  const googlePeriod = findGooglePeriod(ctx, stableKey);
  const current = await getServicePeriods(restaurantId, client);

  // Locate any existing core period that maps to the same stableKey so we
  // can preserve its row id (avoids unnecessary delete+insert churn).
  const existingMatch = current.find(
    (period) => stableServicePeriodKey(period) === stableKey,
  );
  const others = current.filter(
    (period) => stableServicePeriodKey(period) !== stableKey,
  );

  let nextPayload: UpdateServicePeriod[];
  if (googlePeriod) {
    nextPayload = [
      ...others.map(existingToUpdateEntry),
      periodToUpdateEntry(googlePeriod, existingMatch?.id),
    ];
  } else {
    // Google has no row for this stableKey; importing means deleting the
    // Core row.
    nextPayload = others.map(existingToUpdateEntry);
  }

  await updateServicePeriods(restaurantId, nextPayload, client);

  // Recompute canonical hash from the updated set.
  const canonical = config.canonicalizeCoreValue({
    periods: googlePeriod ? [googlePeriod] : [],
  });
  const hash = hashCanonicalJson(canonical);

  return {
    status: 'succeeded',
    afterCoreHash: hash,
    afterGbpHash: hash,
  };
}
