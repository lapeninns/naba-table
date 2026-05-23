import { bucketForFieldState } from './dual-sync/heatmap';
import { fieldNeedsOperatorChoice } from './dual-sync/workspace-progress';
import {
  EMPTY_GBP_DRIFT_SECTION_STATUS,
  GBP_DRIFT_SECTION_KEYS,
  type GbpDriftSectionStatus,
  type GbpDriftSettingsSection,
} from './gbpDriftStatusModel';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function summarizeGbpDriftFields(
  fields: ReadonlyArray<DualSyncFieldSummary>,
): GbpDriftSectionStatus {
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
    EMPTY_GBP_DRIFT_SECTION_STATUS,
  );
}

export function buildGbpDriftSectionStatuses(
  fields: ReadonlyArray<DualSyncFieldSummary>,
): Readonly<Record<DualSyncSectionKey, GbpDriftSectionStatus>> {
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
      [sectionKey]: summarizeGbpDriftFields(grouped.get(sectionKey) ?? []),
    }),
    {} as Record<DualSyncSectionKey, GbpDriftSectionStatus>,
  );
}

export function mergeGbpDriftSectionStatuses(
  sectionStatuses: Readonly<Record<DualSyncSectionKey, GbpDriftSectionStatus>>,
  sectionKeys: ReadonlyArray<DualSyncSectionKey>,
): GbpDriftSectionStatus {
  return mergeSectionStatuses(sectionKeys.map((sectionKey) => sectionStatuses[sectionKey]));
}

export function buildGbpDriftSettingsSectionReviewCounts(
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
