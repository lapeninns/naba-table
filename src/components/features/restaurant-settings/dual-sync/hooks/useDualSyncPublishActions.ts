'use client';

import { type DualSyncToastIntent } from '../dualSyncShellActionDomain';
import { useDualSyncConfirmPublishAction } from './useDualSyncConfirmPublishAction';
import { useDualSyncPublishDialogState } from './useDualSyncPublishDialogState';
import { useDualSyncPublishPreviewAction } from './useDualSyncPublishPreviewAction';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';

interface UseDualSyncPublishActionsArgs {
  readonly workspace: DualSyncWorkspace;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly canSubmit: boolean;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}

export function useDualSyncPublishActions({
  workspace,
  syncPaused,
  pauseReason,
  canSubmit,
  showToast,
}: UseDualSyncPublishActionsArgs) {
  const {
    clearPublishPreview,
    openPublishPreview,
    openPublishResult,
    publishPreview,
    publishPreviewOpen,
    publishPreviewPlan,
    publishResult,
    publishResultOpen,
    setPublishPreviewOpen,
    setPublishResultOpen,
  } = useDualSyncPublishDialogState();

  const onClickPublish = useDualSyncPublishPreviewAction({
    workspace,
    syncPaused,
    pauseReason,
    canSubmit,
    openPublishPreview,
    showToast,
  });
  const onConfirmPublishPreview = useDualSyncConfirmPublishAction({
    workspace,
    publishPreview,
    clearPublishPreview,
    openPublishResult,
    showToast,
  });

  return {
    clearPublishPreview,
    onClickPublish,
    onConfirmPublishPreview,
    publishPreviewOpen,
    publishPreviewPlan,
    publishResult,
    publishResultOpen,
    setPublishPreviewOpen,
    setPublishResultOpen,
  };
}
