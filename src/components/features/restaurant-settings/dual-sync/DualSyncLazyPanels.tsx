import { DualSyncLazyPanelItem } from './DualSyncLazyPanelItem';
import { DUAL_SYNC_LAZY_PANEL_IDS, type DualSyncLazyPanelId } from './dualSyncLazyPanelsDomain';
import { useDualSyncLazyPanelsController } from './hooks/useDualSyncLazyPanelsController';
import { type DualSyncWorkspace } from './hooks/useDualSyncWorkspace';
import { DualSyncOperationalHealthPanel } from './panels/health/DualSyncOperationalHealthPanel';
import { DualSyncPendingCandidatesPanel } from './panels/jobs/DualSyncPendingCandidatesPanel';
import { DualSyncPublishJobsPanel } from './panels/jobs/DualSyncPublishJobsPanel';
import { DualSyncQueueJobsPanel } from './panels/jobs/DualSyncQueueJobsPanel';
import { DualSyncOperationsPanel } from './panels/operations/DualSyncOperationsPanel';

export function DualSyncLazyPanels({ workspace }: { readonly workspace: DualSyncWorkspace }) {
  const { activatePanel, panels } = useDualSyncLazyPanelsController(workspace);

  return (
    <>
      {panels.map((panel) => (
        <DualSyncLazyPanelItem
          key={panel.id}
          panel={panel}
          onActivate={() => activatePanel(panel.id)}
        >
          {renderDualSyncLazyPanelContent(workspace, panel.id)}
        </DualSyncLazyPanelItem>
      ))}
    </>
  );
}

function renderDualSyncLazyPanelContent(
  workspace: DualSyncWorkspace,
  panelId: DualSyncLazyPanelId,
) {
  switch (panelId) {
    case DUAL_SYNC_LAZY_PANEL_IDS.metrics:
      return <DualSyncOperationalHealthPanel metricsQuery={workspace.metricsQuery} />;
    case DUAL_SYNC_LAZY_PANEL_IDS.pendingCandidates:
      return (
        <DualSyncPendingCandidatesPanel
          candidatesQuery={workspace.candidatesQuery}
          cancelCandidateMutation={workspace.cancelCandidateMutation}
        />
      );
    case DUAL_SYNC_LAZY_PANEL_IDS.queueJobs:
      return (
        <DualSyncQueueJobsPanel
          jobsQuery={workspace.jobsQuery}
          retryJobMutation={workspace.retryJobMutation}
        />
      );
    case DUAL_SYNC_LAZY_PANEL_IDS.publishes:
      return (
        <DualSyncPublishJobsPanel
          publishJobsQuery={workspace.publishJobsQuery}
          selectedJobId={workspace.selectedJobId}
          onSelectJob={workspace.setSelectedJobId}
          publishJobDetailQuery={workspace.publishJobDetailQuery}
        />
      );
    case DUAL_SYNC_LAZY_PANEL_IDS.operations:
      return <DualSyncOperationsPanel operationsQuery={workspace.operationsQuery} />;
  }
}
