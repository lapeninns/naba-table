import { DualSyncPublishPreviewDialog } from './DualSyncPublishPreviewDialog';
import { DualSyncPublishResultDialog } from './DualSyncPublishResultDialog';
import { GbpExactPublishDialog } from './GbpExactPublishDialog';
import { GbpExactPublishResultDialog } from './GbpExactPublishResultDialog';

import type { DualSyncShellActions } from './hooks/useDualSyncShellActions';

interface DualSyncShellDialogsProps {
  readonly shellActions: DualSyncShellActions;
  /** The exact (or legacy) Google publish is running. */
  readonly publishPending: boolean;
  /** The Nabatable-only save of Google values is running. */
  readonly importPending: boolean;
}

export function DualSyncShellDialogs({
  shellActions,
  publishPending,
  importPending,
}: DualSyncShellDialogsProps) {
  const imports = shellActions.importActions;
  const importDialogs = (
    <>
      <DualSyncPublishPreviewDialog
        purpose="import"
        open={imports.publishPreviewOpen}
        plan={imports.publishPreviewPlan}
        isPublishing={importPending}
        onOpenChange={imports.setPublishPreviewOpen}
        onConfirm={imports.onConfirmPublishPreview}
      />
      <DualSyncPublishResultDialog
        purpose="import"
        open={imports.publishResultOpen}
        result={imports.publishResult}
        onOpenChange={imports.setPublishResultOpen}
      />
    </>
  );

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
        {importDialogs}
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
      {importDialogs}
    </>
  );
}
