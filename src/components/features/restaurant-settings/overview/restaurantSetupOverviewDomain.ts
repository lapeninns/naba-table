import { getMissingProfileSetupFields } from '@/lib/ops/restaurant-setup-rules';

import {
  buildSetupCards,
  summarizeReadiness,
  type ProfileSetupChecks,
  type SetupCardKey,
} from './buildSetupCards';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
} from '@/services/ops/restaurants';
import type { TableInventorySummary } from '@/services/ops/tables';

/** The queries behind the setup rows. Each row depends on one or two of them. */
export type SetupCheckSource =
  | 'profile'
  | 'operatingHours'
  | 'servicePeriods'
  | 'tables'
  | 'menu'
  | 'team';

/**
 * Which queries feed which row. Discovery and Google are optional pointers with no completion
 * check, so nothing can fail for them.
 */
const SETUP_ROW_SOURCES: Record<SetupCardKey, readonly SetupCheckSource[]> = {
  profile: ['profile'],
  availability: ['operatingHours', 'servicePeriods'],
  tables: ['tables'],
  discovery: [],
  google: [],
  menu: ['menu'],
  team: ['team'],
};

export type RestaurantSetupOverviewStateInput = {
  profile: RestaurantProfile | null | undefined;
  operatingHours: OperatingHoursSnapshot | null | undefined;
  servicePeriods: ServicePeriodRow[] | null | undefined;
  tableSummary: TableInventorySummary | null | undefined;
  menuCount: number;
  pendingInvites: number;
  failedSources?: ReadonlySet<SetupCheckSource>;
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

/** Sources feeding `rowKey` that failed, in the order they should be refetched. */
export function getFailedSourcesForRow(
  rowKey: SetupCardKey,
  failedSources: ReadonlySet<SetupCheckSource>,
): SetupCheckSource[] {
  return SETUP_ROW_SOURCES[rowKey].filter((source) => failedSources.has(source));
}

/** Per-field presence, using the same rule as `isProfileSetupComplete`. */
export function deriveProfileSetupChecks(
  profile: RestaurantProfile | null | undefined,
): ProfileSetupChecks {
  const missing = new Set(getMissingProfileSetupFields(profile).map((field) => field.key));
  return {
    name: !missing.has('name'),
    slug: !missing.has('slug'),
    timezone: !missing.has('timezone'),
    contactPhone: !missing.has('contactPhone'),
  };
}

export function deriveRestaurantSetupOverviewState({
  profile,
  operatingHours,
  servicePeriods,
  tableSummary,
  menuCount,
  pendingInvites,
  failedSources = new Set(),
}: RestaurantSetupOverviewStateInput) {
  const failedKeys = new Set(
    (Object.keys(SETUP_ROW_SOURCES) as SetupCardKey[]).filter(
      (key) => getFailedSourcesForRow(key, failedSources).length > 0,
    ),
  );

  const cards = buildSetupCards({
    profileChecks: deriveProfileSetupChecks(profile),
    openDays: operatingHours?.weekly?.filter((row) => !row.isClosed).length ?? 0,
    servicePeriodCount: servicePeriods?.length ?? 0,
    totalTables: tableSummary?.totalTables ?? 0,
    availableTables: tableSummary?.availableTables ?? 0,
    menuCount,
    pendingInvites,
    failedKeys,
  });

  return {
    requiredCards: cards.filter((card) => card.group === 'required'),
    optionalCards: cards.filter((card) => card.group === 'optional'),
    readiness: summarizeReadiness(cards),
  };
}
