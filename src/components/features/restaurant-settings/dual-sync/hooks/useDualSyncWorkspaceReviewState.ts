import { useMemo } from 'react';

import { buildDualSyncWorkspaceReviewModel } from '../dualSyncWorkspaceReviewModelDomain';
import { computeSectionReviewProgress } from '../workspace-progress';
import { useDualSyncWorkspaceAccordionState } from './useDualSyncWorkspaceAccordionState';
import { useDualSyncWorkspaceDecisionState } from './useDualSyncWorkspaceDecisionState';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

interface UseDualSyncWorkspaceReviewStateArgs {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly singleOpenSections: boolean;
  readonly coreSnapshotHash?: string | null;
  readonly gbpSnapshotHash?: string | null;
}

export function useDualSyncWorkspaceReviewState({
  fields,
  sections,
  singleOpenSections,
  coreSnapshotHash,
  gbpSnapshotHash,
}: UseDualSyncWorkspaceReviewStateArgs) {
  const decisionState = useDualSyncWorkspaceDecisionState({
    coreSnapshotHash,
    gbpSnapshotHash,
  });
  const { decisions } = decisionState;

  const reviewModel = useMemo(
    () => buildDualSyncWorkspaceReviewModel({ fields, sections, decisions }),
    [fields, sections, decisions],
  );

  const accordionState = useDualSyncWorkspaceAccordionState({
    orderedAccordionValues: reviewModel.orderedAccordionValues,
    singleOpenSections,
  });

  return {
    ...accordionState,
    ...decisionState,
    ...reviewModel,
    getSectionProgress: computeSectionReviewProgress,
  };
}
