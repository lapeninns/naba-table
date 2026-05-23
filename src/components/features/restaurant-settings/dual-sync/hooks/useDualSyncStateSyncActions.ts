'use client';

import { useCallback } from 'react';

import {
  getDualSyncAutoExportToastIntent,
  getDualSyncErrorToastIntent,
  getDualSyncPausedToastIntent,
  getDualSyncRefreshSuccessToastIntent,
  type DualSyncToastIntent,
} from '../dualSyncShellActionDomain';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';

interface UseDualSyncStateSyncActionsArgs {
  readonly workspace: Pick<DualSyncWorkspace, 'autoExportMutation' | 'refreshMutation'>;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}

export function useDualSyncStateSyncActions({
  workspace,
  syncPaused,
  pauseReason,
  showToast,
}: UseDualSyncStateSyncActionsArgs) {
  const onClickRefresh = useCallback(async () => {
    if (syncPaused) {
      showToast(getDualSyncPausedToastIntent(pauseReason));
      return;
    }
    try {
      await workspace.refreshMutation.mutateAsync();
      showToast(getDualSyncRefreshSuccessToastIntent());
    } catch (error) {
      showToast(getDualSyncErrorToastIntent(error, 'Refresh failed.'));
    }
  }, [pauseReason, showToast, syncPaused, workspace.refreshMutation]);

  const onClickAutoExport = useCallback(async () => {
    if (syncPaused) {
      showToast(getDualSyncPausedToastIntent(pauseReason));
      return;
    }
    try {
      const result = await workspace.autoExportMutation.mutateAsync();
      showToast(getDualSyncAutoExportToastIntent(result));
    } catch (error) {
      showToast(getDualSyncErrorToastIntent(error, 'Auto-export failed.'));
    }
  }, [pauseReason, showToast, syncPaused, workspace.autoExportMutation]);

  return {
    onClickAutoExport,
    onClickRefresh,
  };
}
