import {
  getDualSyncSectionBulkSummary,
  type DualSyncDecisionEntry,
  type DualSyncSectionBulkSummary,
} from './dualSyncWorkspaceDecisionDomain';
import { DUAL_SYNC_SECTION_LABEL } from './dualSyncWorkspaceDomain';

import type { DualSyncDecisionAction, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncSectionReviewProgress {
  readonly needsReviewCount: number;
  readonly draftedForReviewCount: number;
  readonly draftCoveragePercent: number;
}

export interface DualSyncReviewSectionState {
  readonly sectionLabel: string;
  readonly displayedFields: ReadonlyArray<DualSyncFieldSummary>;
  readonly countBadgeLabel: string;
  readonly hasSectionReview: boolean;
  readonly progressLeadLabel: string;
  readonly progressCountLabel: string;
  readonly progressValue: number;
  readonly progressAriaLabel: string;
  readonly emptyMessage: string;
}

export interface DualSyncReviewSectionFieldRowModel {
  readonly field: DualSyncFieldSummary;
  readonly selectedAction: DualSyncDecisionAction | null;
}

export interface DualSyncReviewSectionModel {
  readonly bulkSummary: DualSyncSectionBulkSummary;
  readonly fieldRows: ReadonlyArray<DualSyncReviewSectionFieldRowModel>;
  readonly sectionState: DualSyncReviewSectionState;
}

interface BuildDualSyncReviewSectionStateInput {
  readonly sectionKey: DualSyncSectionKey;
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly showDriftOnly: boolean;
  readonly sectionProgress: DualSyncSectionReviewProgress;
}

interface BuildDualSyncReviewSectionModelInput {
  readonly sectionKey: DualSyncSectionKey;
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly showDriftOnly: boolean;
  readonly sectionProgress: DualSyncSectionReviewProgress;
}

export function buildDualSyncReviewSectionState({
  sectionKey,
  fields,
  showDriftOnly,
  sectionProgress,
}: BuildDualSyncReviewSectionStateInput): DualSyncReviewSectionState {
  const sectionLabel = DUAL_SYNC_SECTION_LABEL[sectionKey];
  const displayedFields = showDriftOnly
    ? fields.filter((field) => field.state !== 'in_sync')
    : fields;
  const hasSectionReview = sectionProgress.needsReviewCount > 0;

  return {
    sectionLabel,
    displayedFields,
    countBadgeLabel: showDriftOnly ? `${displayedFields.length} drifted` : `${fields.length} total`,
    hasSectionReview,
    progressLeadLabel: hasSectionReview ? 'Draft progress' : 'No review needed',
    progressCountLabel: hasSectionReview
      ? `${sectionProgress.draftedForReviewCount}/${sectionProgress.needsReviewCount}`
      : '0 pending',
    progressValue: hasSectionReview ? sectionProgress.draftCoveragePercent : 100,
    progressAriaLabel: hasSectionReview
      ? `Draft progress for ${sectionLabel}`
      : `${sectionLabel} has no fields needing review`,
    emptyMessage: 'All fields in this section are in sync.',
  };
}

export function buildDualSyncReviewSectionFieldRows(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: Readonly<Record<string, { readonly action: DualSyncDecisionAction }>>,
): ReadonlyArray<DualSyncReviewSectionFieldRowModel> {
  return fields.map((field) => ({
    field,
    selectedAction: decisions[field.fieldKey]?.action ?? null,
  }));
}

export function buildDualSyncReviewSectionModel({
  sectionKey,
  fields,
  decisions,
  showDriftOnly,
  sectionProgress,
}: BuildDualSyncReviewSectionModelInput): DualSyncReviewSectionModel {
  const sectionState = buildDualSyncReviewSectionState({
    sectionKey,
    fields,
    showDriftOnly,
    sectionProgress,
  });

  return {
    bulkSummary: getDualSyncSectionBulkSummary(fields, decisions),
    fieldRows: buildDualSyncReviewSectionFieldRows(sectionState.displayedFields, decisions),
    sectionState,
  };
}
