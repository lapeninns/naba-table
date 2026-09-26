import { DualSyncShellDialogs } from './DualSyncShellDialogs';
import { DualSyncShellReauthAlert } from './DualSyncShellReauthAlert';
import { DualSyncShellWorkspaceCard } from './DualSyncShellWorkspaceCard';
import { GbpPublishResults } from './GbpPublishResults';

import type { DualSyncShellViewState } from './dualSyncShellDomain';
import type { DualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { DualSyncWorkspace } from './hooks/useDualSyncWorkspace';

export interface DualSyncShellReadyContentProps {
  readonly workspace: DualSyncWorkspace;
  readonly shellActions: DualSyncShellActions;
  readonly viewState: DualSyncShellViewState;
  readonly showDriftOnly: boolean;
  readonly onShowDriftOnlyChange: (next: boolean) => void;
}

export function DualSyncShellReadyContent({
  workspace,
  shellActions,
  viewState,
  showDriftOnly,
  onShowDriftOnlyChange,
}: DualSyncShellReadyContentProps) {
  const exactPublishPending = workspace.exactPublishMutation?.isPending;
  return (
    <>
      <DualSyncShellDialogs
        shellActions={shellActions}
        publishPending={exactPublishPending ?? workspace.publishMutation.isPending}
        importPending={workspace.publishMutation.isPending}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {shellActions.needsReauth ? (
          <DualSyncShellReauthAlert
            onReconnect={shellActions.handleReconnect}
            isActionPending={shellActions.isReconnectPending}
          />
        ) : null}
        <DualSyncShellWorkspaceCard
          workspace={workspace}
          shellActions={shellActions}
          viewState={viewState}
          showDriftOnly={showDriftOnly}
          onShowDriftOnlyChange={onShowDriftOnlyChange}
        />
        {shellActions.usesExactPublish ? (
          <GbpPublishResults result={shellActions.exactPublishActions.result} />
        ) : null}
      </div>
    </>
  );
}
