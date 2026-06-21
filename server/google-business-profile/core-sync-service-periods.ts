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
  normalizeComparableText,
  normalizeNumericSelection,
} from './core-sync-time';

import type { GoogleBusinessProfileBusinessInfo } from './business-info';
import type { GoogleBusinessProfileLocationProfile } from './client';
import type { ServicePeriod, UpdateServicePeriod } from '@/server/restaurants/servicePeriods';

export type ServicePeriodsSyncSelection = {
  dayOfWeeks?: number[];
};

export function buildServicePeriodsVerificationSummary(params: {
  periodsUpdatedAt: string | null;
  businessInfo: GoogleBusinessProfileBusinessInfo;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  canPush: boolean;
}): CoreSectionVerification {
  const normalization = params.businessInfo.coreNormalization.servicePeriods;
  const status = resolveCoreStatusFromNormalization(normalization.matchStatus);

  return {
    status,
    summary: normalization.summary,
    recommendedDirection: pickRecommendedDirection({
      coreUpdatedAt: params.periodsUpdatedAt,
      providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
      canPull: normalization.source !== 'unavailable',
      canPush: params.canPush,
    }),
    canPull: normalization.source !== 'unavailable',
    canPush: params.canPush,
    coreUpdatedAt: params.periodsUpdatedAt,
    providerUpdatedAt: pickLatestTimestamp(params.lastPulledAt, params.lastPushedAt),
    lastPulledAt: params.lastPulledAt,
    lastPushedAt: params.lastPushedAt,
    warnings: normalization.warnings,
  };
}

export function buildPullServicePeriodsPayload(params: {
  currentPeriods: ServicePeriod[];
  businessInfo: GoogleBusinessProfileBusinessInfo;
  selection?: ServicePeriodsSyncSelection;
}): UpdateServicePeriod[] {
  const normalizedPeriods = params.businessInfo.coreNormalization.servicePeriods.periods;
  const selectedDayOfWeeks = normalizeNumericSelection(params.selection?.dayOfWeeks, [
    ...new Set(
      params.currentPeriods
        .map((period) => period.dayOfWeek)
        .concat(normalizedPeriods.map((period) => period.dayOfWeek))
        .filter((value): value is number => value !== null),
    ),
  ]);
  ensureSelectionNotEmpty(selectedDayOfWeeks, 'service-period');
  const selectedDaySet = new Set(selectedDayOfWeeks);
  const preserved = params.currentPeriods.filter((period) => {
    const option = period.bookingOption.trim().toLowerCase();
    if (option !== 'lunch' && option !== 'dinner') {
      return true;
    }

    return period.dayOfWeek === null || !selectedDaySet.has(period.dayOfWeek);
  });

  return [
    ...preserved,
    ...normalizedPeriods
      .filter((period) => period.dayOfWeek !== null && selectedDaySet.has(period.dayOfWeek))
      .map<UpdateServicePeriod>((period) => ({
        name: period.name,
        dayOfWeek: period.dayOfWeek,
        startTime: period.startTime,
        endTime: period.endTime,
        bookingOption: period.bookingOption,
      })),
  ];
}

function isKitchenHoursType(hoursTypeId: string | null | undefined): boolean {
  return Boolean(hoursTypeId && normalizeComparableText(hoursTypeId)?.includes('kitchen'));
}

export function canPushServicePeriodsToGoogle(
  location: GoogleBusinessProfileLocationProfile,
): boolean {
  return (
    (location.moreHours ?? []).some((entry) => isKitchenHoursType(entry.hoursTypeId)) ||
    Boolean(
      location.categories?.primaryCategory?.moreHoursTypes?.some((type) =>
        isKitchenHoursType(type.hoursTypeId ?? type.localizedDisplayName ?? type.displayName),
      ),
    )
  );
}

function resolveKitchenHoursTypeId(location: GoogleBusinessProfileLocationProfile): string | null {
  const existing = (location.moreHours ?? []).find((entry) =>
    isKitchenHoursType(entry.hoursTypeId),
  );
  if (existing?.hoursTypeId) {
    return existing.hoursTypeId;
  }

  const categoryType = location.categories?.primaryCategory?.moreHoursTypes?.find((type) =>
    isKitchenHoursType(type.hoursTypeId ?? type.localizedDisplayName ?? type.displayName),
  );

  return categoryType?.hoursTypeId ?? null;
}

export function buildPushServicePeriodsLocationPatch(params: {
  periods: ServicePeriod[];
  location: GoogleBusinessProfileLocationProfile;
  selection?: ServicePeriodsSyncSelection;
}): { payload: Record<string, unknown>; updateMask: string[] } | null {
  const kitchenHoursTypeId = resolveKitchenHoursTypeId(params.location);
  if (!kitchenHoursTypeId) {
    return null;
  }

  const selectedDayOfWeeks = normalizeNumericSelection(params.selection?.dayOfWeeks, [
    ...new Set(
      params.periods
        .map((period) => period.dayOfWeek)
        .concat(
          (params.location.moreHours ?? [])
            .filter((entry) => isKitchenHoursType(entry.hoursTypeId))
            .flatMap((entry) =>
              (entry.periods ?? []).map((period) => googleDayNameToIndex(period.openDay)),
            )
            .filter((value): value is number => value !== null),
        )
        .filter((value): value is number => value !== null),
    ),
  ]);
  ensureSelectionNotEmpty(selectedDayOfWeeks, 'service-period');
  const selectedDaySet = new Set(selectedDayOfWeeks);

  const kitchenPeriods = params.periods
    .filter((period) => {
      const option = period.bookingOption.trim().toLowerCase();
      return (
        (option === 'lunch' || option === 'dinner') &&
        period.dayOfWeek !== null &&
        selectedDaySet.has(period.dayOfWeek)
      );
    })
    .sort((left, right) => {
      const dayOrder = (left.dayOfWeek ?? 99) - (right.dayOfWeek ?? 99);
      if (dayOrder !== 0) {
        return dayOrder;
      }
      return left.startTime.localeCompare(right.startTime);
    })
    .map((period) =>
      buildRegularHoursPeriod(period.dayOfWeek ?? 0, period.startTime, period.endTime),
    );

  const preservedMoreHours = (params.location.moreHours ?? []).filter(
    (entry) => !isKitchenHoursType(entry.hoursTypeId),
  );
  const preservedKitchenPeriods = (params.location.moreHours ?? [])
    .filter((entry) => isKitchenHoursType(entry.hoursTypeId))
    .flatMap((entry) => entry.periods ?? [])
    .filter((period) => {
      const openDay = googleDayNameToIndex(period.openDay);
      const closeDay = googleDayNameToIndex(period.closeDay);
      return !(
        (openDay !== null && selectedDaySet.has(openDay)) ||
        (closeDay !== null && selectedDaySet.has(closeDay))
      );
    });

  return {
    payload: {
      moreHours: [
        ...preservedMoreHours,
        {
          hoursTypeId: kitchenHoursTypeId,
          periods: [...preservedKitchenPeriods, ...kitchenPeriods],
        },
      ],
    },
    updateMask: ['moreHours'],
  };
}
