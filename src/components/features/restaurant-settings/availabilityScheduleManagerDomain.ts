import {
  buildWeeklyHoursMap,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
} from './availabilityScheduleManagerUtils';
import { findServicePeriodDriftField } from './gbpDriftDomain';
import { buildServicePeriodState, type DayServiceConfig } from './servicePeriodsMapper';
import { DAYS_OF_WEEK, type OverrideRow, type WeeklyRow } from './types';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';
import type { OpsOccasion } from '@/services/ops/occasions';
import type {
  OperatingHoursSnapshot,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';

export interface RequiredOccasionKeys {
  readonly lunch?: string | null;
  readonly dinner?: string | null;
}

export type AvailabilityScheduleDraftState = {
  customRows: ServicePeriodRow[];
  dayConfigs: DayServiceConfig[];
  occasionDrafts: OpsOccasion[];
  overrideRows: OverrideRow[];
  turnBandsDraft: TurnBandsPayload;
  weeklyRows: WeeklyRow[];
};

export function buildAvailabilityScheduleDraftState({
  occasions,
  operatingHours,
  servicePeriods,
  turnBands,
}: {
  readonly occasions: OpsOccasion[];
  readonly operatingHours: OperatingHoursSnapshot;
  readonly servicePeriods: ServicePeriodRow[];
  readonly turnBands: TurnBandsSnapshot;
}): AvailabilityScheduleDraftState {
  const weeklyRows = mapWeeklyFromResponse(operatingHours.weekly);
  const { custom, days } = buildServicePeriodState({
    periods: servicePeriods,
    weeklyHours: buildWeeklyHoursMap(weeklyRows),
    dayLabels: weeklyRows.map((row) => DAYS_OF_WEEK[row.dayOfWeek]),
  });

  return {
    customRows: custom,
    dayConfigs: days,
    occasionDrafts: occasions,
    overrideRows: mapOverridesFromResponse(operatingHours.overrides),
    turnBandsDraft: turnBands.bands ?? {},
    weeklyRows,
  };
}

export function buildAvailabilityDraftOverrides({
  dayConfigs,
  occasionKeys,
  servicePeriodDriftFields,
  weeklyRows,
}: {
  readonly dayConfigs: ReadonlyArray<DayServiceConfig>;
  readonly occasionKeys: RequiredOccasionKeys;
  readonly servicePeriodDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  readonly weeklyRows: ReadonlyArray<WeeklyRow>;
}): Array<readonly [string, unknown]> {
  const entries: Array<readonly [string, unknown]> = weeklyRows.map((row) => [
    `operatingHours.weekly.${row.dayOfWeek}`,
    {
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
    },
  ]);

  for (const day of dayConfigs) {
    if (occasionKeys.lunch && day.lunch.enabled) {
      const field = findServicePeriodDriftField(servicePeriodDriftFields, {
        dayOfWeek: day.dayOfWeek,
        startTime: day.lunch.startTime,
        endTime: day.lunch.endTime,
        bookingOption: occasionKeys.lunch,
        name: day.lunch.name,
      });
      if (field) {
        entries.push([
          field.fieldKey,
          {
            name: day.lunch.name,
            dayOfWeek: day.dayOfWeek,
            startTime: day.lunch.startTime,
            endTime: day.lunch.endTime,
            bookingOption: occasionKeys.lunch,
          },
        ]);
      }
    }

    if (occasionKeys.dinner && day.dinner.enabled) {
      const field = findServicePeriodDriftField(servicePeriodDriftFields, {
        dayOfWeek: day.dayOfWeek,
        startTime: day.dinner.startTime,
        endTime: day.dinner.endTime,
        bookingOption: occasionKeys.dinner,
        name: day.dinner.name,
      });
      if (field) {
        entries.push([
          field.fieldKey,
          {
            name: day.dinner.name,
            dayOfWeek: day.dayOfWeek,
            startTime: day.dinner.startTime,
            endTime: day.dinner.endTime,
            bookingOption: occasionKeys.dinner,
          },
        ]);
      }
    }
  }

  return entries;
}
