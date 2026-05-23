import { DualSyncPublishPreviewDialog } from './DualSyncPublishPreviewDialog';
import { DualSyncPublishResultDialog } from './DualSyncPublishResultDialog';

import type { useDualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { useDualSyncWorkspace } from './hooks/useDualSyncWorkspace';

type DualSyncShellActions = ReturnType<typeof useDualSyncShellActions>;
type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;

interface DualSyncShellDialogsProps {
  readonly shellActions: DualSyncShellActions;
  readonly publishPending: DualSyncWorkspace['publishMutation']['isPending'];
}

export function DualSyncShellDialogs({ shellActions, publishPending }: DualSyncShellDialogsProps) {
  return (
    <>
      <DualSyncPublishPreviewDialog
        open={shellActions.publishPreviewOpen}
        plan={shellActions.publishPreviewPlan}
        isPublishing={publishPending}
        onOpenChange={shellActions.setPublishPreviewOpen}
        onConfirm={shellActions.onConfirmPublishPreview}
      />
      <DualSyncPublishResultDialog
        open={shellActions.publishResultOpen}
        result={shellActions.publishResult}
        onOpenChange={shellActions.setPublishResultOpen}
      />
    </>
  );
}
