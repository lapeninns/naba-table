'use client';

import { useCallback } from 'react';

import {
  getDualSyncControlToastIntent,
  getDualSyncErrorToastIntent,
  type DualSyncToastIntent,
} from '../dualSyncShellActionDomain';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';

interface UseDualSyncControlActionArgs {
  readonly workspace: Pick<DualSyncWorkspace, 'controlMutation' | 'setDecisions'>;
  readonly syncPaused: boolean;
  readonly clearPublishPreview: () => void;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}

export function useDualSyncControlAction({
  workspace,
  syncPaused,
  clearPublishPreview,
  showToast,
}: UseDualSyncControlActionArgs) {
  const onClickToggleControl = useCallback(async () => {
    try {
      const nextPaused = !syncPaused;
      await workspace.controlMutation.mutateAsync({
        syncPaused: nextPaused,
        reason: nextPaused ? 'Paused from dual-sync settings.' : null,
      });
      if (nextPaused) {
        workspace.setDecisions({});
        clearPublishPreview();
      }
      showToast(getDualSyncControlToastIntent(nextPaused));
    } catch (error) {
      showToast(getDualSyncErrorToastIntent(error, 'Dual-sync control update failed.'));
    }
  }, [clearPublishPreview, showToast, syncPaused, workspace]);

  return {
    onClickToggleControl,
  };
}
