/**
 * Phase 3d of the unified dual-sync engine.
 *
 * Concrete `applyImportToCore` port for `operatingHours.weekly.N` rows.
 * Reads the Nabatable weekly schedule, splices in the Google canonical
 * value for the targeted day, and writes back via the legacy section
 * writer so the dual-sync `core_writes/operating-hours.ts` wrapper does
 * NOT re-queue an outbound candidate.
 */

import {
  getOperatingHours,
  updateOperatingHours,
  type UpdateWeeklyOperatingHour,
  type WeeklyOperatingHour,
} from '@/server/restaurants/operatingHours';

import { hashCanonicalJson } from '../../hashing';
import { findFieldConfig, buildRegistry } from '../../registry';

import type {
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

function findGoogleDay(
  ctx: DualSyncOperationContext,
  dayOfWeek: number,
): { opensAt: string | null; closesAt: string | null; isClosed: boolean } | null {
  const weekly = ctx.gbpSnapshot.operatingHours?.weekly ?? [];
  const match = weekly.find((entry) => entry.dayOfWeek === dayOfWeek);
  if (!match) return null;
  return {
    opensAt: match.opensAt,
    closesAt: match.closesAt,
    isClosed: match.isClosed,
  };
}

function dayToUpdateEntry(
  current: WeeklyOperatingHour,
  override: { opensAt: string | null; closesAt: string | null; isClosed: boolean },
): UpdateWeeklyOperatingHour {
  return {
    dayOfWeek: current.dayOfWeek,
    opensAt: override.isClosed ? null : override.opensAt,
    closesAt: override.isClosed ? null : override.closesAt,
    isClosed: override.isClosed,
    notes: current.notes,
    reservationIntervalMinutes: current.reservationIntervalMinutes,
    reservationSlotTimes: current.reservationSlotTimes,
  };
}

export async function applyOperatingHoursImportToCore(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  const { client, restaurantId, decision, coreSnapshot, gbpSnapshot } = ctx;
  const dayOfWeek = parseDayOfWeek(decision.fieldKey);
  if (dayOfWeek === null) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Operating-hours import port does not handle field ${decision.fieldKey}.`,
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

  const googleDay = findGoogleDay(ctx, dayOfWeek);
  if (!googleDay) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: `Google snapshot does not contain a weekly entry for day ${dayOfWeek}.`,
        retryable: true,
      },
    };
  }

  const current = await getOperatingHours(restaurantId, client);
  const weeklyByDay = new Map<number, WeeklyOperatingHour>(
    current.weekly.map((entry) => [entry.dayOfWeek, entry]),
  );

  const placeholder: WeeklyOperatingHour = {
    dayOfWeek,
    opensAt: null,
    closesAt: null,
    isClosed: true,
    notes: null,
    reservationIntervalMinutes: null,
    reservationSlotTimes: null,
  };
  const target = weeklyByDay.get(dayOfWeek) ?? placeholder;
  weeklyByDay.set(dayOfWeek, {
    ...target,
    opensAt: googleDay.isClosed ? null : googleDay.opensAt,
    closesAt: googleDay.isClosed ? null : googleDay.closesAt,
    isClosed: googleDay.isClosed,
  });

  const orderedWeekly = [...weeklyByDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const updateWeekly: UpdateWeeklyOperatingHour[] = orderedWeekly.map((entry) =>
    dayToUpdateEntry(entry, {
      opensAt: entry.opensAt,
      closesAt: entry.closesAt,
      isClosed: entry.isClosed,
    }),
  );

  // Pass overrides through unchanged.
  const updateOverrides = current.overrides.map((entry) => ({
    id: entry.id,
    effectiveDate: entry.effectiveDate,
    opensAt: entry.opensAt,
    closesAt: entry.closesAt,
    isClosed: entry.isClosed,
    notes: entry.notes,
    reservationIntervalMinutes: entry.reservationIntervalMinutes,
    reservationSlotTimes: entry.reservationSlotTimes,
  }));

  await updateOperatingHours(
    restaurantId,
    { weekly: updateWeekly, overrides: updateOverrides },
    client,
  );

  // The canonical hash for this field is identical on both sides after
  // the import succeeds.
  const canonicalDay = config.canonicalizeCoreValue({
    weekly: orderedWeekly.map((entry) => ({
      dayOfWeek: entry.dayOfWeek,
      opensAt: entry.opensAt,
      closesAt: entry.closesAt,
      isClosed: entry.isClosed,
    })),
  });
  const hash = hashCanonicalJson(canonicalDay);

  return {
    status: 'succeeded',
    afterCoreHash: hash,
    afterGbpHash: hash,
  };
}
