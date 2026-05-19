import { bucketForFieldState } from './dual-sync/heatmap';
import { fieldNeedsOperatorChoice } from './dual-sync/workspace-progress';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';
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

const EMPTY_SECTION_STATUS: GbpDriftSectionStatus = {
  fieldCount: 0,
  inSyncCount: 0,
  needsReviewCount: 0,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  driftCount: 0,
};

export const EMPTY_GBP_DRIFT_SECTION_STATUSES: Readonly<Record<
  DualSyncSectionKey,
  GbpDriftSectionStatus
>> = GBP_DRIFT_SECTION_KEYS.reduce(
  (acc, sectionKey) => ({ ...acc, [sectionKey]: EMPTY_SECTION_STATUS }),
  {} as Record<DualSyncSectionKey, GbpDriftSectionStatus>,
);

const EMPTY_SETTINGS_SECTION_REVIEW_COUNTS: Readonly<Record<GbpDriftSettingsSection, number>> = {
  profile: 0,
  availability: 0,
  menu: 0,
  googleBusinessProfile: 0,
};

function isIncompleteConnection(status: GoogleBusinessProfileConnection['status'] | undefined) {
  return (
    !status ||
    status === 'unlinked' ||
    status === 'pending_auth' ||
    status === 'authorized' ||
    status === 'reauth_required'
  );
}

function emptyStatus(overrides: Partial<GbpDriftStatus>): GbpDriftStatus {
  return {
    ...EMPTY_SECTION_STATUS,
    kind: 'unknown',
    label: 'Google status unknown',
    shortLabel: 'Unknown',
    detail: 'Google comparison status is not available yet.',
    badgeTone: 'outline',
    isLoading: false,
    isError: false,
    isLinked: false,
    lastCheckedAt: null,
    sectionStatuses: EMPTY_GBP_DRIFT_SECTION_STATUSES,
    sectionReviewCounts: EMPTY_SETTINGS_SECTION_REVIEW_COUNTS,
    ...overrides,
  };
}

function summarizeFields(fields: ReadonlyArray<DualSyncFieldSummary>): GbpDriftSectionStatus {
  let inSyncCount = 0;
  let needsReviewCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let conflictCount = 0;
  let driftCount = 0;

  for (const field of fields) {
    const bucket = bucketForFieldState(field.state);
    if (bucket === 'in_sync') inSyncCount += 1;
    if (bucket === 'pending') pendingCount += 1;
    if (bucket === 'failed') failedCount += 1;
    if (bucket === 'conflict') conflictCount += 1;
    if (bucket === 'drift') driftCount += 1;
    if (fieldNeedsOperatorChoice(field)) needsReviewCount += 1;
  }

  return {
    fieldCount: fields.length,
    inSyncCount,
    needsReviewCount,
    pendingCount,
    failedCount,
    conflictCount,
    driftCount,
  };
}

function mergeSectionStatuses(
  statuses: ReadonlyArray<GbpDriftSectionStatus>,
): GbpDriftSectionStatus {
  return statuses.reduce<GbpDriftSectionStatus>(
    (acc, status) => ({
      fieldCount: acc.fieldCount + status.fieldCount,
      inSyncCount: acc.inSyncCount + status.inSyncCount,
      needsReviewCount: acc.needsReviewCount + status.needsReviewCount,
      pendingCount: acc.pendingCount + status.pendingCount,
      failedCount: acc.failedCount + status.failedCount,
      conflictCount: acc.conflictCount + status.conflictCount,
      driftCount: acc.driftCount + status.driftCount,
    }),
    EMPTY_SECTION_STATUS,
  );
}

function buildSectionStatuses(fields: ReadonlyArray<DualSyncFieldSummary>) {
  const grouped = new Map<DualSyncSectionKey, DualSyncFieldSummary[]>();
  for (const field of fields) {
    if (!GBP_DRIFT_SECTION_KEYS.includes(field.sectionKey as DualSyncSectionKey)) {
      continue;
    }
    const sectionKey = field.sectionKey as DualSyncSectionKey;
    grouped.set(sectionKey, [...(grouped.get(sectionKey) ?? []), field]);
  }

  return GBP_DRIFT_SECTION_KEYS.reduce(
    (acc, sectionKey) => ({
      ...acc,
      [sectionKey]: summarizeFields(grouped.get(sectionKey) ?? []),
    }),
    {} as Record<DualSyncSectionKey, GbpDriftSectionStatus>,
  );
}

function isSnapshotStale(timestamp: string | null, now: Date) {
  if (!timestamp) {
    return true;
  }
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return true;
  }
  return now.getTime() - parsed >= 24 * 60 * 60 * 1000;
}

export function mergeGbpDriftSectionStatuses(
  sectionStatuses: Readonly<Record<DualSyncSectionKey, GbpDriftSectionStatus>>,
  sectionKeys: ReadonlyArray<DualSyncSectionKey>,
): GbpDriftSectionStatus {
  return mergeSectionStatuses(sectionKeys.map((sectionKey) => sectionStatuses[sectionKey]));
}

function buildSettingsSectionReviewCounts(
  sectionStatuses: Readonly<Record<DualSyncSectionKey, GbpDriftSectionStatus>>,
): Readonly<Record<GbpDriftSettingsSection, number>> {
  const profileDiscovery = mergeGbpDriftSectionStatuses(sectionStatuses, [
    'profile',
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
  ]);
  const availability = mergeGbpDriftSectionStatuses(sectionStatuses, [
    'operatingHours',
    'servicePeriods',
  ]);

  return {
    profile: profileDiscovery.needsReviewCount,
    availability: availability.needsReviewCount,
    menu: sectionStatuses.foodMenus.needsReviewCount,
    googleBusinessProfile: mergeSectionStatuses(Object.values(sectionStatuses)).needsReviewCount,
  };
}

export function deriveGbpDriftStatus(input: DeriveGbpDriftStatusInput): GbpDriftStatus {
  if (!input.restaurantId) {
    return emptyStatus({
      kind: 'no_profile',
      label: 'No restaurant selected',
      shortLabel: 'No restaurant',
      detail: 'Choose a restaurant to check Google comparison status.',
    });
  }

  if (input.connectionLoading && !input.connection) {
    return emptyStatus({
      label: 'Checking Google',
      shortLabel: 'Checking',
      detail: 'Loading the Google Business Profile connection.',
      isLoading: true,
    });
  }

  if (input.connectionError) {
    return emptyStatus({
      label: 'Google status unavailable',
      shortLabel: 'Unavailable',
      detail: input.connectionError.message,
      isError: true,
    });
  }

  const connectionStatus = input.connection?.status;
  if (isIncompleteConnection(connectionStatus)) {
    return emptyStatus({
      kind: 'not_connected',
      label: 'Google not linked',
      shortLabel: 'Link Google',
      detail: 'Connect Google Business Profile to compare public fields.',
      badgeTone: 'outline',
    });
  }

  const fields = input.dualSyncState?.fields ?? [];
  const sectionStatuses = buildSectionStatuses(fields);
  const overall = mergeSectionStatuses(Object.values(sectionStatuses));
  const sectionReviewCounts = buildSettingsSectionReviewCounts(sectionStatuses);
  const lastCheckedAt =
    input.dualSyncState?.lastSnapshot?.finishedAt ??
    input.dualSyncState?.lastSnapshot?.startedAt ??
    null;
  const isDualSyncLoading = Boolean(input.dualSyncLoading && !input.dualSyncState);
  const isDualSyncError = Boolean(input.dualSyncError);

  if (isDualSyncLoading) {
    return {
      ...overall,
      kind: 'unknown',
      label: 'Checking Google drift',
      shortLabel: 'Checking',
      detail: 'Loading the latest Google comparison state.',
      badgeTone: 'outline',
      isLoading: true,
      isError: false,
      isLinked: true,
      lastCheckedAt,
      sectionStatuses,
      sectionReviewCounts,
    };
  }

  if (isDualSyncError || connectionStatus === 'sync_error') {
    return {
      ...overall,
      kind: 'connected_outdated',
      label: 'Google check needed',
      shortLabel: 'Check Google',
      detail: input.dualSyncError?.message ?? input.connection?.lastError ?? 'Refresh Google status.',
      badgeTone: 'destructive',
      isLoading: false,
      isError: isDualSyncError,
      isLinked: true,
      lastCheckedAt,
      sectionStatuses,
      sectionReviewCounts,
    };
  }

  if (overall.needsReviewCount > 0) {
    return {
      ...overall,
      kind: 'connected_with_review',
      label: `${overall.needsReviewCount} Google change${
        overall.needsReviewCount === 1 ? '' : 's'
      } to review`,
      shortLabel: `${overall.needsReviewCount} to review`,
      detail: 'Review Google differences before importing or exporting.',
      badgeTone: overall.failedCount > 0 || overall.conflictCount > 0 ? 'destructive' : 'metric',
      isLoading: false,
      isError: false,
      isLinked: true,
      lastCheckedAt,
      sectionStatuses,
      sectionReviewCounts,
    };
  }

  const now = input.now ?? new Date();
  if (isSnapshotStale(lastCheckedAt, now)) {
    return {
      ...overall,
      kind: 'connected_outdated',
      label: 'Google refresh needed',
      shortLabel: 'Refresh',
      detail: 'Pull the latest Google data before trusting comparison status.',
      badgeTone: 'secondary',
      isLoading: false,
      isError: false,
      isLinked: true,
      lastCheckedAt,
      sectionStatuses,
      sectionReviewCounts,
    };
  }

  return {
    ...overall,
    kind: 'synced',
    label: 'Google in sync',
    shortLabel: 'Synced',
    detail:
      overall.pendingCount > 0
        ? 'Google has pending decisions already queued.'
        : 'Tracked Google fields match Nabatable.',
    badgeTone: 'secondary',
    isLoading: false,
    isError: false,
    isLinked: true,
    lastCheckedAt,
    sectionStatuses,
    sectionReviewCounts,
  };
}
