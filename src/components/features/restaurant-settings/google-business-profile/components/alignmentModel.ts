import { opsHref } from '@/lib/url/opsHref';

import type { DriftGroupSummary, DriftRowStatus } from '../lib/drift';
import type {
  GoogleBusinessProfileConnection,
  OperatingHoursSnapshot,
} from '@/services/ops/restaurants';

export type AlignmentTabId = 'profile' | 'hours';

export type AlignmentTabMeta = {
  id: AlignmentTabId;
  label: string;
  sourceId: DriftGroupSummary['id'];
};

export const ALIGNMENT_TAB_ORDER: AlignmentTabMeta[] = [
  { id: 'profile', label: 'Profile', sourceId: 'profile' },
  { id: 'hours', label: 'Weekly availability', sourceId: 'hours' },
];

export const AVAILABILITY_WORKSPACE_HREF = opsHref('/settings/restaurant/availability');

export const GBP_ALIGNMENT_DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export type AlignmentCounts = {
  drift: number;
  partial: number;
  verified: number;
  unavailable: number;
};

export type AlignmentTone = 'drift' | 'partial' | 'verified' | 'muted';

export function hasWeeklyScheduleContext(
  connection: GoogleBusinessProfileConnection,
  operatingHours: OperatingHoursSnapshot | null | undefined,
) {
  const g = connection.businessInfo.coreNormalization.operatingHours.weekly.length;
  const n = operatingHours?.weekly?.length ?? 0;
  return g > 0 || n > 0;
}

export function countsFor(rows: DriftGroupSummary['rows']): AlignmentCounts {
  return rows.reduce<AlignmentCounts>(
    (acc, row) => {
      if (row.status === 'drift') acc.drift += 1;
      else if (row.status === 'partial') acc.partial += 1;
      else if (row.status === 'verified') acc.verified += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { drift: 0, partial: 0, verified: 0, unavailable: 0 },
  );
}

export function tabTone(counts: AlignmentCounts): AlignmentTone {
  if (counts.drift > 0) return 'drift';
  if (counts.partial > 0) return 'partial';
  if (counts.verified > 0) return 'verified';
  return 'muted';
}

type GoogleServicePeriod =
  GoogleBusinessProfileConnection['businessInfo']['coreNormalization']['servicePeriods']['periods'][number];

export const GBP_STATUS_RANK: Record<DriftRowStatus, number> = {
  drift: 3,
  partial: 2,
  unavailable: 1,
  verified: 0,
};

export function worstDriftStatus(a: DriftRowStatus, b: DriftRowStatus): DriftRowStatus {
  return GBP_STATUS_RANK[a] >= GBP_STATUS_RANK[b] ? a : b;
}

export function mealDriftStatus(google: GoogleServicePeriod | null): DriftRowStatus {
  if (!google) return 'unavailable';
  if (google.matchesCore === null) return 'unavailable';
  return google.matchesCore ? 'verified' : 'drift';
}

export function servicePeriodsDayCounts(periods: GoogleServicePeriod[]): AlignmentCounts {
  return GBP_ALIGNMENT_DAY_INDICES.reduce<AlignmentCounts>(
    (acc, dayOfWeek) => {
      const gLunch =
        periods.find((p) => p.bookingOption === 'lunch' && p.dayOfWeek === dayOfWeek) ?? null;
      const gDinner =
        periods.find((p) => p.bookingOption === 'dinner' && p.dayOfWeek === dayOfWeek) ?? null;
      const dayStatus = worstDriftStatus(mealDriftStatus(gLunch), mealDriftStatus(gDinner));
      if (dayStatus === 'drift') acc.drift += 1;
      else if (dayStatus === 'partial') acc.partial += 1;
      else if (dayStatus === 'verified') acc.verified += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { drift: 0, partial: 0, verified: 0, unavailable: 0 },
  );
}
