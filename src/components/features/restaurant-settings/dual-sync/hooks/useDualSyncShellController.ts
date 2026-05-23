import { useCallback, useMemo, useState } from 'react';

import { buildDualSyncShellViewState } from '../dualSyncShellDomain';
import { useDualSyncShellActions } from './useDualSyncShellActions';
import { useDualSyncWorkspace } from './useDualSyncWorkspace';

import type { DualSyncSectionKey } from '@/server/dual-sync';

interface UseDualSyncShellControllerArgs {
  readonly restaurantId: string;
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly singleOpenSections: boolean;
}

export function useDualSyncShellController({
  restaurantId,
  sections,
  singleOpenSections,
}: UseDualSyncShellControllerArgs) {
  const workspace = useDualSyncWorkspace({
    restaurantId,
    sections,
    singleOpenSections,
  });
  const [showDriftOnly, setShowDriftOnly] = useState(true);

  const shellViewState = useMemo(
    () =>
      buildDualSyncShellViewState({
        stateData: workspace.stateQuery.data,
        decisionCount: workspace.decisionCount,
        publishPending: workspace.publishMutation.isPending,
        previewPublishPending: workspace.previewPublishMutation.isPending,
      }),
    [
      workspace.decisionCount,
      workspace.previewPublishMutation.isPending,
      workspace.publishMutation.isPending,
      workspace.stateQuery.data,
    ],
  );
  const shellActions = useDualSyncShellActions({
    restaurantId,
    workspace,
    syncPaused: shellViewState.syncPaused,
    pauseReason: shellViewState.pauseReason,
    canSubmit: shellViewState.canSubmit,
  });
  const onToggleDriftOnly = useCallback(() => {
    setShowDriftOnly((current) => !current);
  }, []);

  return {
    onToggleDriftOnly,
    shellActions,
    shellViewState,
    showDriftOnly,
    workspace,
  };
}
