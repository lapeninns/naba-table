import { useMemo, useState } from 'react';

import { buildDualSyncWorkspaceLazyRequests } from '../dualSyncWorkspaceQueryDomain';

export function useDualSyncLazyPanelState() {
  const [showOperationalHealth, setShowOperationalHealth] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showPendingCandidates, setShowPendingCandidates] = useState(false);
  const [showQueueJobs, setShowQueueJobs] = useState(false);
  const [showPublishJobs, setShowPublishJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const lazyRequests = useMemo(
    () =>
      buildDualSyncWorkspaceLazyRequests(
        {
          showOperationalHealth,
          showOperations,
          showPendingCandidates,
          showPublishJobs,
          showQueueJobs,
        },
        selectedJobId,
      ),
    [
      selectedJobId,
      showOperationalHealth,
      showOperations,
      showPendingCandidates,
      showPublishJobs,
      showQueueJobs,
    ],
  );

  return {
    lazyRequests,
    selectedJobId,
    setSelectedJobId,
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
  };
}
