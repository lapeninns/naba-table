'use client';

import { useDualSyncControlAction } from './useDualSyncControlAction';
import { useDualSyncExactPublishActions } from './useDualSyncExactPublishActions';
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
  const exact = useDualSyncExactPublishActions({
    workspace,
    syncPaused,
    pauseReason,
    canSubmit,
    showToast,
  });
  const legacy = useDualSyncPublishActions({
    workspace,
    syncPaused,
    pauseReason,
    canSubmit,
    showToast,
  });
  const usesExactPublish = Boolean(
    workspace.exactPreviewPublishMutation && workspace.exactPublishMutation,
  );
  const clearPublishPreview = usesExactPublish
    ? () => exact.setPreviewOpen(false)
    : legacy.clearPublishPreview;
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
    onClickPublish: usesExactPublish ? exact.onClickPublish : legacy.onClickPublish,
    onClickRefresh,
    onClickToggleControl,
    onConfirmPublishPreview: usesExactPublish ? exact.onConfirm : legacy.onConfirmPublishPreview,
    onRefreshExpired: exact.onRefreshExpired,
    publishPreviewOpen: usesExactPublish ? exact.previewOpen : legacy.publishPreviewOpen,
    publishPreviewPlan: usesExactPublish ? exact.preview : legacy.publishPreviewPlan,
    publishResult: usesExactPublish ? exact.result : legacy.publishResult,
    publishResultOpen: usesExactPublish ? exact.resultOpen : legacy.publishResultOpen,
    setPublishPreviewOpen: usesExactPublish ? exact.setPreviewOpen : legacy.setPublishPreviewOpen,
    setPublishResultOpen: usesExactPublish ? exact.setResultOpen : legacy.setPublishResultOpen,
    usesExactPublish,
    exactPublishActions: exact,
    legacyPublishActions: legacy,
  };
}
