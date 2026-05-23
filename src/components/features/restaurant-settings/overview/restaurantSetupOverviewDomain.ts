import {
  formatMissingProfileSetupFields,
  isProfileSetupComplete,
} from '@/lib/ops/restaurant-setup-rules';

import { buildSetupCards, summarizeOptionalSetup, summarizeRequiredSetup } from './buildSetupCards';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
} from '@/services/ops/restaurants';
import type { TableInventorySummary } from '@/services/ops/tables';

export type RestaurantSetupOverviewStateInput = {
  profile: RestaurantProfile | null | undefined;
  operatingHours: OperatingHoursSnapshot | null | undefined;
  servicePeriods: ServicePeriodRow[] | null | undefined;
  tableSummary: TableInventorySummary | null | undefined;
  menuCount: number;
  pendingInvites: number;
};

export type RequiredSetupLoadingInput = {
  profileLoading: boolean;
  operatingHoursLoading: boolean;
  servicePeriodsLoading: boolean;
  tablesLoading: boolean;
};

export function isRequiredSetupLoading({
  profileLoading,
  operatingHoursLoading,
  servicePeriodsLoading,
  tablesLoading,
}: RequiredSetupLoadingInput) {
  return profileLoading || operatingHoursLoading || servicePeriodsLoading || tablesLoading;
}

export function deriveRestaurantSetupOverviewState({
  profile,
  operatingHours,
  servicePeriods,
  tableSummary,
  menuCount,
  pendingInvites,
}: RestaurantSetupOverviewStateInput) {
  const profileComplete = isProfileSetupComplete(profile);
  const profileDetail = formatMissingProfileSetupFields(profile);
  const hasWeeklyHours = Boolean(operatingHours?.weekly?.some((row) => !row.isClosed));
  const hasServicePeriods = Boolean(servicePeriods?.length);
  const availabilityComplete = hasWeeklyHours && hasServicePeriods;
  const tablesComplete = Boolean(
    tableSummary && tableSummary.totalTables > 0 && tableSummary.availableTables > 0,
  );

  const cards = buildSetupCards({
    profileComplete,
    profileDetail,
    availabilityComplete,
    tablesComplete,
    availableTables: tableSummary?.availableTables ?? 0,
    menuCount,
    pendingInvites,
  });

  return {
    cards,
    requiredSetup: summarizeRequiredSetup(cards),
    optionalSetup: summarizeOptionalSetup(cards),
  };
}
