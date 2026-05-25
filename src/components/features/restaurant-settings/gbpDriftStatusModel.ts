import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { GetDualSyncStateResponse } from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export type GbpDriftStatusKind =
  | 'no_profile'
  | 'not_connected'
  | 'connected_with_review'
  | 'connected_outdated'
  | 'synced'
  | 'unknown';

export type GbpDriftBadgeTone = 'default' | 'secondary' | 'destructive' | 'outline' | 'metric';

export type GbpDriftSectionStatus = {
  readonly fieldCount: number;
  readonly inSyncCount: number;
  readonly needsReviewCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
  readonly conflictCount: number;
  readonly driftCount: number;
};

export type GbpDriftSettingsSection = 'profile' | 'availability' | 'menu' | 'googleBusinessProfile';

export type GbpDriftStatus = GbpDriftSectionStatus & {
  readonly kind: GbpDriftStatusKind;
  readonly label: string;
  readonly shortLabel: string;
  readonly detail: string;
  readonly badgeTone: GbpDriftBadgeTone;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isLinked: boolean;
  readonly lastCheckedAt: string | null;
  readonly sectionStatuses: Readonly<Record<DualSyncSectionKey, GbpDriftSectionStatus>>;
  readonly sectionReviewCounts: Readonly<Record<GbpDriftSettingsSection, number>>;
};

export type DeriveGbpDriftStatusInput = {
  readonly restaurantId: string | null;
  readonly connection: GoogleBusinessProfileConnection | null | undefined;
  readonly connectionLoading?: boolean;
  readonly connectionError?: Error | null;
  readonly dualSyncState: GetDualSyncStateResponse | null | undefined;
  readonly dualSyncLoading?: boolean;
  readonly dualSyncError?: Error | null;
  readonly now?: Date;
};

export const GBP_DRIFT_SECTION_KEYS: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
];

export const EMPTY_GBP_DRIFT_SECTION_STATUS: GbpDriftSectionStatus = {
  fieldCount: 0,
  inSyncCount: 0,
  needsReviewCount: 0,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  driftCount: 0,
};

export const EMPTY_GBP_DRIFT_SECTION_STATUSES: Readonly<
  Record<DualSyncSectionKey, GbpDriftSectionStatus>
> = GBP_DRIFT_SECTION_KEYS.reduce(
  (acc, sectionKey) => ({ ...acc, [sectionKey]: EMPTY_GBP_DRIFT_SECTION_STATUS }),
  {} as Record<DualSyncSectionKey, GbpDriftSectionStatus>,
);

export const EMPTY_GBP_DRIFT_SETTINGS_SECTION_REVIEW_COUNTS: Readonly<
  Record<GbpDriftSettingsSection, number>
> = {
  profile: 0,
  availability: 0,
  menu: 0,
  googleBusinessProfile: 0,
};
