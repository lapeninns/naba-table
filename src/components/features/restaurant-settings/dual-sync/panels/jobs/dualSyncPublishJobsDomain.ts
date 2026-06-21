import { formatDualSyncTimestamp } from '../../dualSyncFormattingDomain';

import type { ListDualSyncPublishJobsResponse } from '@/services/ops/dual-sync';

export const DUAL_SYNC_PUBLISH_SECTION_LABEL: Record<string, string> = {
  profile: 'Profile',
  operatingHours: 'Hours',
  servicePeriods: 'Periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Items',
};

export interface DualSyncPublishJobsPanelModel {
  readonly jobs: ListDualSyncPublishJobsResponse['jobs'];
}

export function formatPublishJobTimestamp(value: string | null): string {
  return formatDualSyncTimestamp(value, { emptyFallback: '—' });
}

export function formatDualSyncSectionLabel(section: string): string {
  return DUAL_SYNC_PUBLISH_SECTION_LABEL[section] ?? section;
}

export function buildDualSyncPublishJobsPanelModel(
  response: ListDualSyncPublishJobsResponse | null | undefined,
): DualSyncPublishJobsPanelModel {
  return {
    jobs: response?.jobs ?? [],
  };
}
