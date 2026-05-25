import { useCallback, useMemo } from 'react';

import {
  DUAL_SYNC_LAZY_PANEL_IDS,
  buildDualSyncLazyPanelStates,
  type DualSyncLazyPanelId,
} from '../dualSyncLazyPanelsDomain';

import type { DualSyncWorkspace } from './useDualSyncWorkspace';

type DualSyncLazyPanelsWorkspace = Pick<
  DualSyncWorkspace,
  | 'setShowOperationalHealth'
  | 'setShowOperations'
  | 'setShowPendingCandidates'
  | 'setShowPublishJobs'
  | 'setShowQueueJobs'
  | 'showOperationalHealth'
  | 'showOperations'
  | 'showPendingCandidates'
  | 'showPublishJobs'
  | 'showQueueJobs'
>;

export function useDualSyncLazyPanelsController(workspace: DualSyncLazyPanelsWorkspace) {
  const {
    setShowOperationalHealth,
    setShowOperations,
    setShowPendingCandidates,
    setShowPublishJobs,
    setShowQueueJobs,
    showOperationalHealth,
    showOperations,
    showPendingCandidates,
    showPublishJobs,
    showQueueJobs,
  } = workspace;

  const panels = useMemo(
    () =>
      buildDualSyncLazyPanelStates({
        metrics: showOperationalHealth,
        pendingCandidates: showPendingCandidates,
        queueJobs: showQueueJobs,
        publishes: showPublishJobs,
        operations: showOperations,
      }),
    [showOperationalHealth, showOperations, showPendingCandidates, showPublishJobs, showQueueJobs],
  );

  const activatePanel = useCallback(
    (panelId: DualSyncLazyPanelId) => {
      switch (panelId) {
        case DUAL_SYNC_LAZY_PANEL_IDS.metrics:
          setShowOperationalHealth(true);
          break;
        case DUAL_SYNC_LAZY_PANEL_IDS.pendingCandidates:
          setShowPendingCandidates(true);
          break;
        case DUAL_SYNC_LAZY_PANEL_IDS.queueJobs:
          setShowQueueJobs(true);
          break;
        case DUAL_SYNC_LAZY_PANEL_IDS.publishes:
          setShowPublishJobs(true);
          break;
        case DUAL_SYNC_LAZY_PANEL_IDS.operations:
          setShowOperations(true);
          break;
      }
    },
    [
      setShowOperationalHealth,
      setShowOperations,
      setShowPendingCandidates,
      setShowPublishJobs,
      setShowQueueJobs,
    ],
  );

  return { activatePanel, panels };
}
