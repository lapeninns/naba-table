import {
  formatDualSyncDirectionLabel,
  getDualSyncDirectionIconKey,
  type DualSyncDirectionIconKey,
} from './dualSyncDirectionDomain';

import type {
  DualSyncPlanWarning,
  DualSyncPublishGroup,
  DualSyncPublishPlan,
} from '@/server/dual-sync/publish/types';

export const DUAL_SYNC_PUBLISH_PREVIEW_SECTION_LABEL: Record<string, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
  foodMenus: 'Food menus',
};

export const DUAL_SYNC_PUBLISH_RISK_VARIANT: Record<
  DualSyncPublishGroup['riskLevel'],
  'status-confirmed' | 'status-pending' | 'status-cancelled' | 'status-completed'
> = {
  low: 'status-confirmed',
  medium: 'status-completed',
  high: 'status-pending',
  critical: 'status-cancelled',
};

export interface DualSyncPublishGroupTableRow {
  readonly id: string;
  readonly sectionLabel: string;
  readonly writeGroup: string;
  readonly direction: DualSyncPublishGroup['direction'];
  readonly directionIconKey: DualSyncDirectionIconKey;
  readonly directionLabel: string;
  readonly riskLevel: DualSyncPublishGroup['riskLevel'];
  readonly riskVariant: (typeof DUAL_SYNC_PUBLISH_RISK_VARIANT)[DualSyncPublishGroup['riskLevel']];
  readonly masksLabel: string;
  readonly fieldCount: number;
}

export type DualSyncPublishPreviewSummaryBadgeVariant =
  | 'metric'
  | 'outline'
  | 'secondary'
  | 'status-cancelled'
  | 'status-confirmed';

export interface DualSyncPublishPreviewSummaryBadge {
  readonly id: 'accepted' | 'rejected' | 'ignored' | 'writeGroups';
  readonly label: string;
  readonly variant: DualSyncPublishPreviewSummaryBadgeVariant;
}

export function formatPublishPreviewSectionLabel(sectionKey: string): string {
  return DUAL_SYNC_PUBLISH_PREVIEW_SECTION_LABEL[sectionKey] ?? sectionKey;
}

export function formatPublishPreviewWarningLabel(code: DualSyncPlanWarning['code']): string {
  if (code === 'DESTRUCTIVE_WRITE') return 'Destructive write';
  if (code === 'PREFLIGHT_REQUIRED') return 'Preflight required';
  return 'High risk';
}

export function requiresPublishPreviewAcknowledgement(plan: DualSyncPublishPlan | null): boolean {
  if (!plan) return false;
  return (
    plan.groups.some(
      (group) =>
        group.requiresManualConfirmation ||
        group.destructiveWritePossible ||
        group.riskLevel === 'high' ||
        group.riskLevel === 'critical',
    ) || plan.warnings.length > 0
  );
}

export function formatPublishPreviewFieldLabel(count: number): string {
  return count === 1 ? 'field' : 'fields';
}

export function buildDualSyncPublishGroupTableRows(
  groups: ReadonlyArray<DualSyncPublishGroup>,
): ReadonlyArray<DualSyncPublishGroupTableRow> {
  return groups.map((group) => ({
    id: group.groupId,
    sectionLabel: formatPublishPreviewSectionLabel(group.sectionKey),
    writeGroup: group.writeGroup,
    direction: group.direction,
    directionIconKey: getDualSyncDirectionIconKey(group.direction),
    directionLabel: formatDualSyncDirectionLabel(group.direction),
    riskLevel: group.riskLevel,
    riskVariant: DUAL_SYNC_PUBLISH_RISK_VARIANT[group.riskLevel],
    masksLabel: group.googleUpdateMasks.length > 0 ? group.googleUpdateMasks.join(', ') : '-',
    fieldCount: group.fields.length,
  }));
}

export function buildDualSyncPublishPreviewSummaryBadges(
  plan: Pick<DualSyncPublishPlan, 'acceptedCount' | 'groups' | 'ignoredCount' | 'rejectedCount'>,
): ReadonlyArray<DualSyncPublishPreviewSummaryBadge> {
  return [
    {
      id: 'accepted',
      label: `${plan.acceptedCount} accepted`,
      variant: 'metric',
    },
    {
      id: 'rejected',
      label: `${plan.rejectedCount} rejected`,
      variant: plan.rejectedCount > 0 ? 'status-cancelled' : 'status-confirmed',
    },
    {
      id: 'ignored',
      label: `${plan.ignoredCount} ignored`,
      variant: 'secondary',
    },
    {
      id: 'writeGroups',
      label: `${plan.groups.length} write groups`,
      variant: 'outline',
    },
  ];
}

export function isPublishPreviewConfirmDisabled({
  isPublishing,
  acceptedCount,
  needsAcknowledgement,
  acknowledged,
}: {
  isPublishing: boolean;
  acceptedCount: number;
  needsAcknowledgement: boolean;
  acknowledged: boolean;
}): boolean {
  return isPublishing || acceptedCount === 0 || (needsAcknowledgement && !acknowledged);
}
