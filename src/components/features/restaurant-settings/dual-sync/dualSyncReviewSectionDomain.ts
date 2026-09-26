import {
  getDualSyncSectionBulkSummary,
  type DualSyncDecisionEntry,
  type DualSyncSectionBulkSummary,
} from './dualSyncWorkspaceDecisionDomain';
import { DUAL_SYNC_SECTION_LABEL } from './dualSyncWorkspaceDomain';
import { pluralise } from '../shared/settingsSaveSequence';

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
  /** "2 differences" in the Differences only view, "5 fields · 2 different" in All fields. */
  readonly countLabel: string;
  /** "1 of 2 chosen" while fields that differ still need a choice. */
  readonly progressLabel: string | null;
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
  const differentFields = fields.filter((field) => field.state !== 'in_sync');
  const displayedFields = showDriftOnly ? differentFields : fields;

  return {
    sectionLabel,
    displayedFields,
    countLabel: showDriftOnly
      ? pluralise(differentFields.length, 'difference')
      : `${pluralise(fields.length, 'field')} · ${differentFields.length} different`,
    progressLabel:
      sectionProgress.needsReviewCount > 0
        ? `${sectionProgress.draftedForReviewCount} of ${sectionProgress.needsReviewCount} chosen`
        : null,
    emptyMessage: 'Nabatable and Google match for this section.',
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
