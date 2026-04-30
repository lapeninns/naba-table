/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Service-period registry. Service periods don't carry a stable provider id
 * across pulls, so the registry is computed on the fly per-restaurant from
 * the union of Core and Google periods. Stable keys are derived from
 * (dayOfWeek, startTime, endTime, bookingOption, lowercased name) and then
 * deterministically sorted.
 *
 * Field shape consumed by the diff engine: a single canonical
 * `SyncV2ServicePeriod`-like object per registry entry, or `null` when one
 * side is missing the period entirely.
 */

import type { DualSyncFieldConfig } from './types';

interface ServicePeriodValue {
  readonly stableKey: string;
  readonly name: string;
  readonly dayOfWeek: number | null;
  readonly startTime: string;
  readonly endTime: string;
  readonly bookingOption: string;
}

interface ServicePeriodsSnapshot {
  readonly periods: ReadonlyArray<ServicePeriodValue>;
}

function readPeriods(value: unknown): ReadonlyArray<ServicePeriodValue> {
  if (!value || typeof value !== 'object') return [];
  const periods = (value as ServicePeriodsSnapshot).periods;
  return Array.isArray(periods) ? periods : [];
}

function periodValue(value: unknown, stableKey: string): ServicePeriodValue | null {
  return readPeriods(value).find((entry) => entry?.stableKey === stableKey) ?? null;
}

function canonicalizePeriod(value: unknown, stableKey: string): unknown {
  const period = periodValue(value, stableKey);
  if (!period) return null;
  return {
    name: period.name?.trim().toLowerCase() ?? '',
    dayOfWeek: period.dayOfWeek,
    startTime: period.startTime,
    endTime: period.endTime,
    bookingOption: period.bookingOption,
  };
}

/**
 * Build registry entries for the service-period section keyed off the union
 * of stable keys present on either side. The diff engine receives a stable
 * registry list per draft so unchanged-section pulls don't churn fieldKeys.
 */
export function buildServicePeriodFields({
  coreSnapshot,
  gbpSnapshot,
}: {
  readonly coreSnapshot: unknown;
  readonly gbpSnapshot: unknown;
}): ReadonlyArray<DualSyncFieldConfig> {
  const seen = new Map<string, ServicePeriodValue>();
  for (const period of readPeriods(coreSnapshot)) {
    if (!seen.has(period.stableKey)) seen.set(period.stableKey, period);
  }
  for (const period of readPeriods(gbpSnapshot)) {
    if (!seen.has(period.stableKey)) seen.set(period.stableKey, period);
  }

  const stableKeys = [...seen.keys()].sort();

  return stableKeys.map((stableKey, index) => {
    const sample = seen.get(stableKey)!;
    const dayLabel =
      sample.dayOfWeek === null
        ? 'All days'
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sample.dayOfWeek] ?? 'Day';
    const label = `${sample.name} (${dayLabel} ${sample.startTime}-${sample.endTime})`;
    return {
      fieldKey: `servicePeriods.${stableKey}`,
      sectionKey: 'servicePeriods',
      kind: 'servicePeriod',
      label,
      helpText: 'Service period exported as a Google more-hours block when the location supports it.',
      corePath: `servicePeriods.periods.${stableKey}`,
      gbpPath: `servicePeriods.periods.${stableKey}`,
      importable: true,
      exportable: true,
      normalizeCoreValue: (value: unknown) => periodValue(value, stableKey),
      normalizeGbpValue: (value: unknown) => periodValue(value, stableKey),
      canonicalizeCoreValue: (value: unknown) => canonicalizePeriod(value, stableKey),
      canonicalizeGbpValue: (value: unknown) => canonicalizePeriod(value, stableKey),
      conflictPolicy: 'manual',
      deletePolicy: 'manual',
      googleUpdateMask: 'moreHours',
      requiresGoogleCapability: 'moreHoursTypes',
      exportBlockedReason:
        'Service-period export requires Google to expose a writable kitchen moreHoursType.',
      sortOrder: index,
    } satisfies DualSyncFieldConfig;
  });
}
