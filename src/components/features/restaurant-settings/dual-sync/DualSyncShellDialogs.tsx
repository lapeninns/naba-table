import { DualSyncPublishPreviewDialog } from './DualSyncPublishPreviewDialog';
import { DualSyncPublishResultDialog } from './DualSyncPublishResultDialog';
import { GbpExactPublishDialog } from './GbpExactPublishDialog';
import { GbpExactPublishResultDialog } from './GbpExactPublishResultDialog';

import type { useDualSyncShellActions } from './hooks/useDualSyncShellActions';
import type { useDualSyncWorkspace } from './hooks/useDualSyncWorkspace';

type DualSyncShellActions = ReturnType<typeof useDualSyncShellActions>;
type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;

interface DualSyncShellDialogsProps {
  readonly shellActions: DualSyncShellActions;
  readonly publishPending: DualSyncWorkspace['publishMutation']['isPending'];
}

export function DualSyncShellDialogs({ shellActions, publishPending }: DualSyncShellDialogsProps) {
  if (!shellActions.usesExactPublish) {
    const legacy = shellActions.legacyPublishActions;
    return (
      <>
        <DualSyncPublishPreviewDialog
          open={legacy.publishPreviewOpen}
          plan={legacy.publishPreviewPlan}
          isPublishing={publishPending}
          onOpenChange={legacy.setPublishPreviewOpen}
          onConfirm={legacy.onConfirmPublishPreview}
        />
        <DualSyncPublishResultDialog
          open={legacy.publishResultOpen}
          result={legacy.publishResult}
          onOpenChange={legacy.setPublishResultOpen}
        />
      </>
    );
  }
  const exact = shellActions.exactPublishActions;
  return (
    <>
      <GbpExactPublishDialog
        open={exact.previewOpen}
        preview={exact.preview}
        isPublishing={publishPending}
        onOpenChange={exact.setPreviewOpen}
        onConfirm={exact.onConfirm}
        onRefreshExpired={exact.onRefreshExpired}
      />
      <GbpExactPublishResultDialog
        open={exact.resultOpen}
        result={exact.result}
        onOpenChange={exact.setResultOpen}
      />
    </>
  );
}
