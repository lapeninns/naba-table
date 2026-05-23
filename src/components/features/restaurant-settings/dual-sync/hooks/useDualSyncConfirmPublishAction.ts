'use client';

import { useCallback } from 'react';

import {
  buildDualSyncConfirmPublishReadiness,
  type DualSyncPendingPublishPreview,
} from '../dualSyncPublishRequestDomain';
import {
  getDualSyncBlockedActionToastIntent,
  getDualSyncErrorToastIntent,
  getDualSyncPublishResultToastIntent,
  type DualSyncToastIntent,
} from '../dualSyncShellActionDomain';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';
import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

interface UseDualSyncConfirmPublishActionArgs {
  readonly workspace: DualSyncWorkspace;
  readonly publishPreview: DualSyncPendingPublishPreview | null;
  readonly clearPublishPreview: () => void;
  readonly openPublishResult: (result: DualSyncPublishResponse) => void;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}

export function useDualSyncConfirmPublishAction({
  workspace,
  publishPreview,
  clearPublishPreview,
  openPublishResult,
  showToast,
}: UseDualSyncConfirmPublishActionArgs) {
  return useCallback(async () => {
    const readiness = buildDualSyncConfirmPublishReadiness(publishPreview);
    if (readiness.kind === 'blocked') {
      const intent = getDualSyncBlockedActionToastIntent(readiness.message);
      if (intent) showToast(intent);
      return;
    }

    try {
      const result = await workspace.publishMutation.mutateAsync(readiness.request);
      showToast(getDualSyncPublishResultToastIntent(result));
      workspace.setDecisions({});
      clearPublishPreview();
      openPublishResult(result);
    } catch (error) {
      showToast(getDualSyncErrorToastIntent(error, 'Publish failed.'));
    }
  }, [clearPublishPreview, openPublishResult, publishPreview, showToast, workspace]);
}
