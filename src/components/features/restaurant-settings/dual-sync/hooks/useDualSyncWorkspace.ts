import { useMemo } from 'react';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';

import { useDualSyncLazyPanelState } from './useDualSyncLazyPanelState';
import { useDualSyncWorkspaceReviewState } from './useDualSyncWorkspaceReviewState';

import type { DualSyncSectionKey } from '@/server/dual-sync';

type UseDualSyncWorkspaceArgs = {
  restaurantId: string;
  sections?: ReadonlyArray<DualSyncSectionKey>;
};

export function useDualSyncWorkspace({ restaurantId, sections }: UseDualSyncWorkspaceArgs) {
  const lazyPanels = useDualSyncLazyPanelState();

  const dualSync = useOpsDualSync({
    restaurantId,
    ...lazyPanels.lazyRequests,
  });

  const fields = useMemo(
    () => dualSync.stateQuery.data?.fields ?? [],
    [dualSync.stateQuery.data?.fields],
  );

  const reviewState = useDualSyncWorkspaceReviewState({
    fields,
    sections,
    coreSnapshotHash: dualSync.stateQuery.data?.coreSnapshotHash,
    gbpSnapshotHash: dualSync.stateQuery.data?.gbpSnapshotHash,
  });

  return {
    ...dualSync,
    ...reviewState,
    selectedJobId: lazyPanels.selectedJobId,
    setSelectedJobId: lazyPanels.setSelectedJobId,
    setShowOperationalHealth: lazyPanels.setShowOperationalHealth,
    setShowOperations: lazyPanels.setShowOperations,
    setShowPendingCandidates: lazyPanels.setShowPendingCandidates,
    setShowPublishJobs: lazyPanels.setShowPublishJobs,
    setShowQueueJobs: lazyPanels.setShowQueueJobs,
    showOperationalHealth: lazyPanels.showOperationalHealth,
    showOperations: lazyPanels.showOperations,
    showPendingCandidates: lazyPanels.showPendingCandidates,
    showPublishJobs: lazyPanels.showPublishJobs,
    showQueueJobs: lazyPanels.showQueueJobs,
  };
}

export type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;
