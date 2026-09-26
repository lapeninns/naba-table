'use client';

import { useCallback, useMemo } from 'react';

import { pickDualSyncDecisions } from '../dualSyncShellDomain';
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
  /** "Send to Google" decisions exist and nothing blocks writes. */
  readonly canPublish: boolean;
  /** "Use Google's" decisions exist and nothing blocks writes. */
  readonly canImport: boolean;
}

/**
 * Wires the review step's actions onto the existing mutations without changing them:
 * - "Review and publish" previews and publishes the Send to Google choices through the exact
 *   consent path (or the legacy preview path when exact mutations are unavailable);
 * - "Use Google values" previews and publishes the Use Google's choices through the
 *   Nabatable-only publish path, which never writes to Google.
 */
export function useDualSyncShellActions({
  restaurantId,
  workspace,
  syncPaused,
  pauseReason,
  canPublish,
  canImport,
}: UseDualSyncShellActionsArgs) {
  const showToast = useDualSyncToastBridge();
  const exportDecisions = useMemo(
    () => pickDualSyncDecisions(workspace.decisions, 'export_to_google'),
    [workspace.decisions],
  );
  const importDecisions = useMemo(
    () => pickDualSyncDecisions(workspace.decisions, 'import_from_google'),
    [workspace.decisions],
  );
  const exact = useDualSyncExactPublishActions({
    workspace,
    decisions: exportDecisions,
    syncPaused,
    pauseReason,
    canSubmit: canPublish,
    showToast,
  });
  const legacy = useDualSyncPublishActions({
    workspace,
    decisions: exportDecisions,
    syncPaused,
    pauseReason,
    canSubmit: canPublish,
    showToast,
  });
  const importActions = useDualSyncPublishActions({
    workspace,
    decisions: importDecisions,
    syncPaused,
    pauseReason,
    canSubmit: canImport,
    showToast,
  });
  const usesExactPublish = Boolean(
    workspace.exactPreviewPublishMutation && workspace.exactPublishMutation,
  );
  const { setPreviewOpen: setExactPreviewOpen } = exact;
  const { clearPublishPreview: clearLegacyPreview } = legacy;
  const { clearPublishPreview: clearImportPreview } = importActions;
  const clearPublishPreview = useCallback(() => {
    if (usesExactPublish) setExactPreviewOpen(false);
    else clearLegacyPreview();
    clearImportPreview();
  }, [clearImportPreview, clearLegacyPreview, setExactPreviewOpen, usesExactPublish]);
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
    onClickImportValues: importActions.onClickPublish,
    onClickRefresh,
    onClickToggleControl,
    usesExactPublish,
    exactPublishActions: exact,
    legacyPublishActions: legacy,
    importActions,
  };
}

export type DualSyncShellActions = ReturnType<typeof useDualSyncShellActions>;
