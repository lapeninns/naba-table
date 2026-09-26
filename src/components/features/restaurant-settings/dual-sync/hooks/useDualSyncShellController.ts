import { useMemo, useState } from 'react';

import { buildDualSyncShellViewState } from '../dualSyncShellDomain';
import { useDualSyncShellActions } from './useDualSyncShellActions';
import { useDualSyncWorkspace } from './useDualSyncWorkspace';

import type { DualSyncSectionKey } from '@/server/dual-sync';

interface UseDualSyncShellControllerArgs {
  readonly restaurantId: string;
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
}

export function useDualSyncShellController({
  restaurantId,
  sections,
}: UseDualSyncShellControllerArgs) {
  const workspace = useDualSyncWorkspace({ restaurantId, sections });
  const [showDriftOnly, setShowDriftOnly] = useState(true);

  // Any running publish or preview (exact, legacy or the Nabatable-only import) blocks writes.
  const publishPending = Boolean(
    workspace.exactPublishMutation?.isPending || workspace.publishMutation.isPending,
  );
  const previewPublishPending = Boolean(
    workspace.exactPreviewPublishMutation?.isPending || workspace.previewPublishMutation.isPending,
  );

  const shellViewState = useMemo(
    () =>
      buildDualSyncShellViewState({
        stateData: workspace.stateQuery.data,
        decisions: workspace.decisions,
        publishPending,
        previewPublishPending,
      }),
    [previewPublishPending, publishPending, workspace.decisions, workspace.stateQuery.data],
  );
  const shellActions = useDualSyncShellActions({
    restaurantId,
    workspace,
    syncPaused: shellViewState.syncPaused,
    pauseReason: shellViewState.pauseReason,
    canPublish: shellViewState.canPublish,
    canImport: shellViewState.canImport,
  });

  return {
    setShowDriftOnly,
    shellActions,
    shellViewState,
    showDriftOnly,
    workspace,
  };
}

export type DualSyncShellController = ReturnType<typeof useDualSyncShellController>;
