'use client';

import { useCallback } from 'react';

import { buildDualSyncPublishPreviewReadiness } from '../dualSyncPublishRequestDomain';
import {
  getDualSyncBlockedActionToastIntent,
  getDualSyncErrorToastIntent,
  getDualSyncPublishPreviewEmptyToastIntent,
  type DualSyncToastIntent,
} from '../dualSyncShellActionDomain';

import type { DualSyncDecisionEntry } from '../dualSyncWorkspaceDecisionDomain';
import type { DualSyncWorkspace } from './useDualSyncWorkspace';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
} from '@/services/ops/dual-sync';

interface UseDualSyncPublishPreviewActionArgs {
  readonly workspace: DualSyncWorkspace;
  /** The draft decisions to preview; defaults to every draft decision. */
  readonly decisions?: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly canSubmit: boolean;
  readonly openPublishPreview: (
    request: DualSyncPublishRequest,
    plan: DualSyncPublishPreviewResponse,
  ) => void;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}

export function useDualSyncPublishPreviewAction({
  workspace,
  decisions,
  syncPaused,
  pauseReason,
  canSubmit,
  openPublishPreview,
  showToast,
}: UseDualSyncPublishPreviewActionArgs) {
  const activeDecisions = decisions ?? workspace.decisions;
  return useCallback(async () => {
    const readiness = buildDualSyncPublishPreviewReadiness({
      stateData: workspace.stateQuery.data,
      decisions: activeDecisions,
      syncPaused,
      pauseReason,
      canSubmit,
    });
    if (readiness.kind === 'blocked') {
      const intent = getDualSyncBlockedActionToastIntent(readiness.message);
      if (intent) showToast(intent);
      return;
    }

    try {
      const plan = await workspace.previewPublishMutation.mutateAsync(readiness.request);
      openPublishPreview(readiness.request, plan);
      if (plan.acceptedCount === 0) {
        showToast(getDualSyncPublishPreviewEmptyToastIntent());
      }
    } catch (error) {
      showToast(getDualSyncErrorToastIntent(error, 'Publish preview failed.'));
    }
  }, [
    activeDecisions,
    canSubmit,
    openPublishPreview,
    pauseReason,
    showToast,
    syncPaused,
    workspace.previewPublishMutation,
    workspace.stateQuery.data,
  ]);
}
