import {
  getDualSyncAccordionValues,
  getOrderedDualSyncSectionKeys,
  getVisibleDualSyncFields,
  groupDualSyncFieldsBySection,
} from './dualSyncWorkspaceDomain';
import { computeWorkspaceReviewProgress, type WorkspaceReviewProgress } from './workspace-progress';

import type { DualSyncDecisionEntry } from './dualSyncWorkspaceDecisionDomain';
import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface BuildDualSyncWorkspaceReviewModelArgs {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
}

export interface DualSyncWorkspaceReviewModel {
  readonly visibleFields: ReadonlyArray<DualSyncFieldSummary>;
  readonly workspaceProgress: WorkspaceReviewProgress;
  readonly fieldsBySection: ReadonlyMap<DualSyncSectionKey, ReadonlyArray<DualSyncFieldSummary>>;
  readonly orderedSectionKeys: ReadonlyArray<DualSyncSectionKey>;
  readonly orderedAccordionValues: ReadonlyArray<string>;
}

export function buildDualSyncWorkspaceReviewModel({
  fields,
  sections,
  decisions,
}: BuildDualSyncWorkspaceReviewModelArgs): DualSyncWorkspaceReviewModel {
  const visibleFields = getVisibleDualSyncFields(fields, sections);
  const workspaceProgress = computeWorkspaceReviewProgress(visibleFields, decisions);
  const fieldsBySection = groupDualSyncFieldsBySection(visibleFields);
  const orderedSectionKeys = getOrderedDualSyncSectionKeys(fieldsBySection);
  const orderedAccordionValues = getDualSyncAccordionValues(orderedSectionKeys);

  return {
    visibleFields,
    workspaceProgress,
    fieldsBySection,
    orderedSectionKeys,
    orderedAccordionValues,
  };
}
