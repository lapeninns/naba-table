/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Operating-hours registry. One config per weekday. The Core and Google
 * canonical snapshots both expose the weekly schedule as an array of
 * `SyncV2OperatingHoursDay`-shaped entries indexed by `dayOfWeek` (0..6,
 * Sunday-first). The diff engine reduces each to a {opensAt, closesAt,
 * isClosed} triple for hashing.
 */

import { withFieldPolicy } from './policy';

import type { DualSyncFieldConfig } from './types';

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

interface WeeklyHourValue {
  readonly dayOfWeek: number;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly isClosed: boolean;
}

function pickDay(value: unknown, dayOfWeek: number): WeeklyHourValue | null {
  if (!value || typeof value !== 'object') return null;
  const weekly = (value as { weekly?: ReadonlyArray<WeeklyHourValue> }).weekly;
  if (!Array.isArray(weekly)) return null;
  return weekly.find((entry) => entry?.dayOfWeek === dayOfWeek) ?? null;
}

function reduceDay(
  value: unknown,
  dayOfWeek: number,
): {
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
} | null {
  const day = pickDay(value, dayOfWeek);
  if (!day) return null;
  return {
    opensAt: day.opensAt ?? null,
    closesAt: day.closesAt ?? null,
    isClosed: Boolean(day.isClosed),
  };
}

export const OPERATING_HOURS_FIELDS: ReadonlyArray<DualSyncFieldConfig> = DAY_LABELS.map(
  (label, dayOfWeek) =>
    withFieldPolicy({
      fieldKey: `operatingHours.weekly.${dayOfWeek}`,
      sectionKey: 'operatingHours',
      kind: 'operatingHours.weekly',
      label: `${label} hours`,
      helpText: 'Weekly opening hours for this day.',
      corePath: `operatingHours.weekly[${dayOfWeek}]`,
      gbpPath: `operatingHours.weekly[${dayOfWeek}]`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => reduceDay(value, dayOfWeek),
      normalizeGbpValue: (value: unknown) => reduceDay(value, dayOfWeek),
      canonicalizeCoreValue: (value: unknown) => reduceDay(value, dayOfWeek),
      canonicalizeGbpValue: (value: unknown) => reduceDay(value, dayOfWeek),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'regularHours',
      sortOrder: dayOfWeek,
    }),
);
