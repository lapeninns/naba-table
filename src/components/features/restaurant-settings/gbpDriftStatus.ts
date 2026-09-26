import {
  EMPTY_GBP_DRIFT_SECTION_STATUS,
  EMPTY_GBP_DRIFT_SECTION_STATUSES,
  EMPTY_GBP_DRIFT_SETTINGS_SECTION_REVIEW_COUNTS,
  GBP_DRIFT_SECTION_KEYS,
  type DeriveGbpDriftStatusInput,
  type GbpDriftStatus,
} from './gbpDriftStatusModel';
import {
  buildGbpDriftSectionStatuses,
  buildGbpDriftSettingsSectionReviewCounts,
  mergeGbpDriftSectionStatuses,
} from './gbpDriftStatusSections';
import { getSafeSettingsErrorMessage } from './shared/settingsErrorCopy';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export { EMPTY_GBP_DRIFT_SECTION_STATUSES, GBP_DRIFT_SECTION_KEYS } from './gbpDriftStatusModel';
export { mergeGbpDriftSectionStatuses } from './gbpDriftStatusSections';
export type {
  DeriveGbpDriftStatusInput,
  GbpDriftBadgeTone,
  GbpDriftSectionStatus,
  GbpDriftSettingsSection,
  GbpDriftStatus,
  GbpDriftStatusKind,
} from './gbpDriftStatusModel';

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
    ...EMPTY_GBP_DRIFT_SECTION_STATUS,
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
    sectionReviewCounts: EMPTY_GBP_DRIFT_SETTINGS_SECTION_REVIEW_COUNTS,
    ...overrides,
  };
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

  if (input.fetchDeferred && input.connection === undefined) {
    return emptyStatus({});
  }

  if (input.connectionError) {
    return emptyStatus({
      label: 'Google status unavailable',
      shortLabel: 'Unavailable',
      detail: getSafeSettingsErrorMessage(
        input.connectionError,
        'Google status could not be loaded.',
      ),
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

  if (input.fetchDeferred && input.dualSyncState === undefined && !input.dualSyncError) {
    return emptyStatus({ isLinked: true });
  }

  const fields = input.dualSyncState?.fields ?? [];
  const sectionStatuses = buildGbpDriftSectionStatuses(fields);
  const overall = mergeGbpDriftSectionStatuses(sectionStatuses, GBP_DRIFT_SECTION_KEYS);
  const sectionReviewCounts = buildGbpDriftSettingsSectionReviewCounts(sectionStatuses);
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
      // Request errors get fixed copy; raw text can echo database or provider internals.
      detail: input.dualSyncError
        ? getSafeSettingsErrorMessage(input.dualSyncError, 'Google status could not be checked.')
        : (input.connection?.lastError ?? 'Refresh Google status.'),
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
