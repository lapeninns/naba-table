import { TooltipProvider } from '@/components/ui/tooltip';

import { DualSyncShellDialogs } from './DualSyncShellDialogs';
import { DualSyncShellReauthAlert } from './DualSyncShellReauthAlert';
import { DualSyncShellWorkspaceCard } from './DualSyncShellWorkspaceCard';

import type { DualSyncShellViewState } from './dualSyncShellDomain';
import type { useDualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { useDualSyncWorkspace } from './hooks/useDualSyncWorkspace';

type DualSyncShellActions = ReturnType<typeof useDualSyncShellActions>;
type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;

export interface DualSyncShellReadyContentProps {
  readonly className?: string;
  readonly workspace: DualSyncWorkspace;
  readonly shellActions: DualSyncShellActions;
  readonly viewState: DualSyncShellViewState;
  readonly showDriftOnly: boolean;
  readonly onToggleDriftOnly: () => void;
  readonly singleOpenSections: boolean;
}

export function DualSyncShellReadyContent({
  className,
  workspace,
  shellActions,
  viewState,
  showDriftOnly,
  onToggleDriftOnly,
  singleOpenSections,
}: DualSyncShellReadyContentProps) {
  return (
    <>
      <DualSyncShellDialogs
        shellActions={shellActions}
        publishPending={
          workspace.exactPublishMutation?.isPending ?? workspace.publishMutation.isPending
        }
      />
      <TooltipProvider delayDuration={250}>
        <div className="flex flex-col gap-4">
          {shellActions.needsReauth ? (
            <DualSyncShellReauthAlert
              onReconnect={shellActions.handleReconnect}
              isActionPending={shellActions.isReconnectPending}
            />
          ) : null}
          <DualSyncShellWorkspaceCard
            className={className}
            workspace={workspace}
            shellActions={shellActions}
            viewState={viewState}
            showDriftOnly={showDriftOnly}
            onToggleDriftOnly={onToggleDriftOnly}
            singleOpenSections={singleOpenSections}
          />
        </div>
      </TooltipProvider>
    </>
  );
}
