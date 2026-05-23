'use client';

import { useDualSyncControlAction } from './useDualSyncControlAction';
import { useDualSyncPublishActions } from './useDualSyncPublishActions';
import { useDualSyncReconnectAction } from './useDualSyncReconnectAction';
import { useDualSyncStateSyncActions } from './useDualSyncStateSyncActions';
import { useDualSyncToastBridge } from './useDualSyncToastBridge';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';

interface UseDualSyncShellActionsArgs {
  readonly restaurantId: string;
  readonly workspace: DualSyncWorkspace;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly canSubmit: boolean;
}

export function useDualSyncShellActions({
  restaurantId,
  workspace,
  syncPaused,
  pauseReason,
  canSubmit,
}: UseDualSyncShellActionsArgs) {
  const showToast = useDualSyncToastBridge();
  const {
    clearPublishPreview,
    onClickPublish,
    onConfirmPublishPreview,
    publishPreviewOpen,
    publishPreviewPlan,
    publishResult,
    publishResultOpen,
    setPublishPreviewOpen,
    setPublishResultOpen,
  } = useDualSyncPublishActions({
    workspace,
    syncPaused,
    pauseReason,
    canSubmit,
    showToast,
  });
  const { handleReconnect, isReconnectPending, needsReauth } = useDualSyncReconnectAction({
    restaurantId,
  });
  const { onClickAutoExport, onClickRefresh } = useDualSyncStateSyncActions({
    workspace,
    syncPaused,
    pauseReason,
    showToast,
  });
  const { onClickToggleControl } = useDualSyncControlAction({
    workspace,
    syncPaused,
    clearPublishPreview,
    showToast,
  });

  return {
    handleReconnect,
    isReconnectPending,
    needsReauth,
    onClickAutoExport,
    onClickPublish,
    onClickRefresh,
    onClickToggleControl,
    onConfirmPublishPreview,
    publishPreviewOpen,
    publishPreviewPlan,
    publishResult,
    publishResultOpen,
    setPublishPreviewOpen,
    setPublishResultOpen,
  };
}
