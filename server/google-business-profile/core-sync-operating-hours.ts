import {
  pickLatestTimestamp,
  pickRecommendedDirection,
  resolveCoreStatusFromNormalization,
  type CoreSectionVerification,
} from './core-sync-profile';
import {
  buildRegularHoursPeriod,
  ensureSelectionNotEmpty,
  googleDayNameToIndex,
  normalizeNumericSelection,
  toGoogleTimeOfDay,
} from './core-sync-time';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { GoogleBusinessProfileLocationProfile } from './client';
import type {
  OperatingHoursSnapshot,
  UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';

export type OperatingHoursSyncSelection = {
  weeklyDays?: number[];
  overrideDates?: string[];
};

function toGoogleDate(value: string) {
  const [yearToken, monthToken, dayToken] = value.split('-');
  const year = Number.parseInt(yearToken ?? '', 10);
  const month = Number.parseInt(monthToken ?? '', 10);
  const day = Number.parseInt(dayToken ?? '', 10);

  return {
    year,
    month,
    day,
  };
}

function formatGoogleDate(
  value: { year?: number; month?: number; day?: number } | null | undefined,
) {
  if (!value) {
    return null;
  }

  const year = Number.isInteger(value.year) ? value.year : null;
  const month = Number.isInteger(value.month) ? value.month : null;
  const day = Number.isInteger(value.day) ? value.day : null;

  if (!year || !month || !day) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDateSelection(requested: string[] | undefined, available: string[]): string[] {
  const availableSet = new Set(available);
  const source = requested && requested.length > 0 ? requested : available;
  return [...new Set(source.filter((value) => availableSet.has(value)))].sort();
}

function buildSpecialHoursPeriod(params: {
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}) {
  const base = {
    startDate: toGoogleDate(params.effectiveDate),
    endDate: toGoogleDate(params.effectiveDate),
  };

  if (params.isClosed) {
    return {
      ...base,
      closed: true,
    };
  }

  const openTime = toGoogleTimeOfDay(params.opensAt);
  const closeTime = toGoogleTimeOfDay(params.closesAt);
  if (!openTime || !closeTime) {
    throw new Error(
      'Selected holiday overrides must include valid open and close times before pushing to Google Business Profile.',
    );
  }

  return {
    ...base,
    openTime,
    closeTime,
    closed: false,
  };
}

type GoogleRegularHoursPeriod = NonNullable<
  NonNullable<GoogleBusinessProfileLocationProfile['regularHours']>['periods']
>[number];
type GoogleSpecialHourPeriod = NonNullable<
  NonNullable<GoogleBusinessProfileLocationProfile['specialHours']>['specialHourPeriods']
>[number];

function googleTimeSortKey(value: GoogleRegularHoursPeriod['openTime']): string {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return '99:99';
  }
  const hours = Number.isInteger(value.hours) ? value.hours : 99;
  const minutes = Number.isInteger(value.minutes) ? value.minutes : 99;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function compareGoogleRegularHoursPeriod(
  left: GoogleRegularHoursPeriod,
  right: GoogleRegularHoursPeriod,
): number {
  const leftOpenDay = googleDayNameToIndex(left.openDay) ?? 99;
  const rightOpenDay = googleDayNameToIndex(right.openDay) ?? 99;
  if (leftOpenDay !== rightOpenDay) {
    return leftOpenDay - rightOpenDay;
  }

  const leftOpenTime = googleTimeSortKey(left.openTime);
  const rightOpenTime = googleTimeSortKey(right.openTime);
  if (leftOpenTime !== rightOpenTime) {
    return leftOpenTime.localeCompare(rightOpenTime);
  }

  const leftCloseDay = googleDayNameToIndex(left.closeDay) ?? 99;
  const rightCloseDay = googleDayNameToIndex(right.closeDay) ?? 99;
  if (leftCloseDay !== rightCloseDay) {
    return leftCloseDay - rightCloseDay;
  }

  return googleTimeSortKey(left.closeTime).localeCompare(googleTimeSortKey(right.closeTime));
}

function compareGoogleSpecialHourPeriod(
  left: GoogleSpecialHourPeriod,
  right: GoogleSpecialHourPeriod,
): number {
  const leftDate =
    formatGoogleDate(left.startDate) ?? formatGoogleDate(left.endDate) ?? '9999-99-99';
  const rightDate =
    formatGoogleDate(right.startDate) ?? formatGoogleDate(right.endDate) ?? '9999-99-99';
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }
  return googleTimeSortKey(left.openTime).localeCompare(googleTimeSortKey(right.openTime));
}

export function buildOperatingHoursVerificationSummary(params: {
  snapshot: OperatingHoursSnapshot;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}): CoreSectionVerification {
  const normalization = params.businessInfo.coreNormalization.operatingHours;
  const status = resolveCoreStatusFromNormalization(normalization.matchStatus);

  return {
    status,
    summary: normalization.summary,
    recommendedDirection: pickRecommendedDirection({
      coreUpdatedAt: params.snapshot.updatedAt,
      providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
      canPull: normalization.source !== 'unavailable',
      canPush: true,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush: true,
    coreUpdatedAt: params.snapshot.updatedAt,
    providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
    lastPulledAt: params.lastPulledAt,
    lastPushedAt: params.lastPushedAt,
    warnings: normalization.warnings,
  };
}

export function buildPullOperatingHoursPayload(params: {
  currentSnapshot: OperatingHoursSnapshot;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  selection?: OperatingHoursSyncSelection;
}): UpdateOperatingHoursPayload {
  const normalized = params.businessInfo.coreNormalization.operatingHours;
  const availableOverrideDates = [
    ...new Set([
      ...params.currentSnapshot.overrides.map((row) => row.effectiveDate),
      ...normalized.overrides.map((row) => row.effectiveDate),
    ]),
  ].sort();
  const selectedWeeklyDays = normalizeNumericSelection(
    params.selection?.weeklyDays,
    params.currentSnapshot.weekly.map((row) => row.dayOfWeek),
  );
  const selectedOverrideDates = normalizeDateSelection(
    params.selection?.overrideDates,
    availableOverrideDates,
  );
  ensureSelectionNotEmpty([...selectedWeeklyDays, ...selectedOverrideDates], 'operating-hours');

  const currentOverridesByDate = new Map(
    params.currentSnapshot.overrides.map((row) => [row.effectiveDate, row]),
  );
  const selectedWeeklyDaySet = new Set(selectedWeeklyDays);
  const selectedOverrideDateSet = new Set(selectedOverrideDates);
  const providerOverridesByDate = new Map(
    normalized.overrides.map((row) => [row.effectiveDate, row]),
  );

  const weekly = params.currentSnapshot.weekly.map((currentRow) => {
    if (!selectedWeeklyDaySet.has(currentRow.dayOfWeek)) {
      return currentRow;
    }

    const providerRow = normalized.weekly.find((row) => row.dayOfWeek === currentRow.dayOfWeek);
    if (!providerRow) {
      return currentRow;
    }

    return {
      dayOfWeek: providerRow.dayOfWeek,
      opensAt: providerRow.isClosed ? null : providerRow.opensAt,
      closesAt: providerRow.isClosed ? null : providerRow.closesAt,
      isClosed: providerRow.isClosed,
      notes: currentRow.notes ?? null,
      reservationIntervalMinutes: currentRow.reservationIntervalMinutes ?? null,
      reservationSlotTimes: currentRow.reservationSlotTimes ?? null,
    };
  });

  const overrides: UpdateOperatingHoursPayload['overrides'] = params.currentSnapshot.overrides
    .filter((row) => !selectedOverrideDateSet.has(row.effectiveDate))
    .map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      effectiveDate: row.effectiveDate,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
      notes: row.notes ?? null,
      reservationIntervalMinutes: row.reservationIntervalMinutes ?? null,
      reservationSlotTimes: row.reservationSlotTimes ?? null,
    }));

  for (const effectiveDate of selectedOverrideDates) {
    const providerRow = providerOverridesByDate.get(effectiveDate);
    if (!providerRow) {
      continue;
    }

    const current = currentOverridesByDate.get(effectiveDate);
    overrides.push({
      ...(current?.id ? { id: current.id } : {}),
      effectiveDate: providerRow.effectiveDate,
      opensAt: providerRow.isClosed ? null : providerRow.opensAt,
      closesAt: providerRow.isClosed ? null : providerRow.closesAt,
      isClosed: providerRow.isClosed,
      notes: current?.notes ?? null,
      reservationIntervalMinutes: current?.reservationIntervalMinutes ?? null,
      reservationSlotTimes: current?.reservationSlotTimes ?? null,
    });
  }

  return {
    weekly,
    overrides: overrides.sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate),
    ),
  };
}

export function buildPushOperatingHoursLocationPatch(params: {
  snapshot: OperatingHoursSnapshot;
  location: GoogleBusinessProfileLocationProfile;
  selection?: OperatingHoursSyncSelection;
}): {
  payload: Record<string, unknown>;
  updateMask: string[];
} {
  const availableOverrideDates = [
    ...new Set([
      ...params.snapshot.overrides.map((row) => row.effectiveDate),
      ...(params.location.specialHours?.specialHourPeriods ?? [])
        .map((row) => formatGoogleDate(row.startDate))
        .filter((value): value is string => Boolean(value)),
    ]),
  ].sort();
  const selectedWeeklyDays = normalizeNumericSelection(
    params.selection?.weeklyDays,
    params.snapshot.weekly.map((row) => row.dayOfWeek),
  );
  const selectedOverrideDates = normalizeDateSelection(
    params.selection?.overrideDates,
    availableOverrideDates,
  );
  ensureSelectionNotEmpty([...selectedWeeklyDays, ...selectedOverrideDates], 'operating-hours');

  const selectedWeeklyDaySet = new Set(selectedWeeklyDays);
  const selectedOverrideDateSet = new Set(selectedOverrideDates);
  const preservedRegularPeriods = (params.location.regularHours?.periods ?? []).filter((period) => {
    const openDay = googleDayNameToIndex(period.openDay);
    const closeDay = googleDayNameToIndex(period.closeDay);
    return !(
      (openDay !== null && selectedWeeklyDaySet.has(openDay)) ||
      (closeDay !== null && selectedWeeklyDaySet.has(closeDay))
    );
  });
  const replacementRegularPeriods = params.snapshot.weekly
    .filter((row) => selectedWeeklyDaySet.has(row.dayOfWeek))
    .filter((row) => !row.isClosed)
    .map((row) => buildRegularHoursPeriod(row.dayOfWeek, row.opensAt ?? '', row.closesAt ?? ''));

  const preservedSpecialHourPeriods = (
    params.location.specialHours?.specialHourPeriods ?? []
  ).filter((row) => {
    const effectiveDate = formatGoogleDate(row.startDate) ?? formatGoogleDate(row.endDate);
    return !effectiveDate || !selectedOverrideDateSet.has(effectiveDate);
  });
  const replacementSpecialHourPeriods = params.snapshot.overrides
    .filter((row) => selectedOverrideDateSet.has(row.effectiveDate))
    .map((row) =>
      buildSpecialHoursPeriod({
        effectiveDate: row.effectiveDate,
        opensAt: row.opensAt,
        closesAt: row.closesAt,
        isClosed: row.isClosed,
      }),
    );

  const payload: Record<string, unknown> = {};
  const updateMask: string[] = [];

  if (selectedWeeklyDaySet.size > 0) {
    payload.regularHours = {
      periods: [...preservedRegularPeriods, ...replacementRegularPeriods].sort(
        compareGoogleRegularHoursPeriod,
      ),
    };
    updateMask.push('regularHours');
  }

  if (selectedOverrideDateSet.size > 0) {
    payload.specialHours = {
      specialHourPeriods: [...preservedSpecialHourPeriods, ...replacementSpecialHourPeriods].sort(
        compareGoogleSpecialHourPeriod,
      ),
    };
    updateMask.push('specialHours');
  }

  return {
    payload,
    updateMask,
  };
}
