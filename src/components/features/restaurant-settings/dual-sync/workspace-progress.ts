/**
 * Derives operator-facing progress for the dual-sync workspace: which fields
 * still need an explicit Import / Export / Ignore choice vs already chosen
 * pending states.
 */

import { bucketForFieldState } from './heatmap';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

/** Field states where Nabatable and Google differ enough that an operator should decide. */
export function fieldNeedsOperatorChoice(field: DualSyncFieldSummary): boolean {
  if (field.conflictPolicy === 'unsupported') return false;
  const bucket = bucketForFieldState(field.state);
  return bucket === 'drift' || bucket === 'conflict' || bucket === 'failed';
}

export interface WorkspaceReviewProgress {
  readonly totalFields: number;
  readonly inSyncCount: number;
  readonly needsReviewCount: number;
  readonly draftedForReviewCount: number;
  /** Share of visible fields that are in sync with Google (health). */
  readonly syncHealthPercent: number;
  /** Share of “needs review” fields that already have a draft decision. */
  readonly draftCoveragePercent: number;
}

type DecisionMap = Readonly<Record<string, { readonly action: DualSyncDecisionAction }>>;

export function computeWorkspaceReviewProgress(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: DecisionMap,
): WorkspaceReviewProgress {
  let inSync = 0;
  const needsReview: DualSyncFieldSummary[] = [];
  for (const field of fields) {
    if (bucketForFieldState(field.state) === 'in_sync') {
      inSync += 1;
    }
    if (fieldNeedsOperatorChoice(field)) {
      needsReview.push(field);
    }
  }
  let drafted = 0;
  for (const field of needsReview) {
    if (decisions[field.fieldKey]) {
      drafted += 1;
    }
  }
  const total = fields.length;
  const needsReviewCount = needsReview.length;
  return {
    totalFields: total,
    inSyncCount: inSync,
    needsReviewCount,
    draftedForReviewCount: drafted,
    syncHealthPercent: total === 0 ? 100 : (inSync / total) * 100,
    draftCoveragePercent: needsReviewCount === 0 ? 100 : (drafted / needsReviewCount) * 100,
  };
}

export function computeSectionReviewProgress(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: DecisionMap,
): Pick<
  WorkspaceReviewProgress,
  'needsReviewCount' | 'draftedForReviewCount' | 'draftCoveragePercent'
> {
  const needsReview = fields.filter(fieldNeedsOperatorChoice);
  const needsReviewCount = needsReview.length;
  let drafted = 0;
  for (const field of needsReview) {
    if (decisions[field.fieldKey]) {
      drafted += 1;
    }
  }
  return {
    needsReviewCount,
    draftedForReviewCount: drafted,
    draftCoveragePercent: needsReviewCount === 0 ? 100 : (drafted / needsReviewCount) * 100,
  };
}
