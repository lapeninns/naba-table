import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DualSyncReviewAccordion } from './DualSyncReviewAccordion';
import { DualSyncShellHeader } from './DualSyncShellHeader';
import { useDualSyncShellHeaderProps } from './hooks/useDualSyncShellHeaderProps';

import type { DualSyncShellViewState } from './dualSyncShellDomain';
import type { useDualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { useDualSyncWorkspace } from './hooks/useDualSyncWorkspace';

type DualSyncShellActions = ReturnType<typeof useDualSyncShellActions>;
type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;

interface DualSyncShellWorkspaceCardProps {
  readonly className?: string;
  readonly workspace: DualSyncWorkspace;
  readonly shellActions: DualSyncShellActions;
  readonly viewState: DualSyncShellViewState;
  readonly showDriftOnly: boolean;
  readonly onToggleDriftOnly: () => void;
  readonly singleOpenSections: boolean;
}

export function DualSyncShellWorkspaceCard({
  className,
  workspace,
  shellActions,
  viewState,
  showDriftOnly,
  onToggleDriftOnly,
  singleOpenSections,
}: DualSyncShellWorkspaceCardProps) {
  const headerProps = useDualSyncShellHeaderProps({
    workspace,
    shellActions,
    viewState,
    showDriftOnly,
    onToggleDriftOnly,
  });

  return (
    <Card className={cn('flex flex-col gap-4', className)}>
      <DualSyncShellHeader {...headerProps} />
      <CardContent className="flex flex-col gap-3">
        <DualSyncReviewAccordion
          workspace={workspace}
          showDriftOnly={showDriftOnly}
          writeBlocked={viewState.writeBlocked}
          syncPaused={viewState.syncPaused}
          pauseReason={viewState.pauseReason}
          singleOpenSections={singleOpenSections}
        />
      </CardContent>
    </Card>
  );
}
