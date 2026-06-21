/**
 * Publish preview confirmation for unified dual-sync.
 *
 * Renders the read-only section-level plan returned by
 * `/dual-sync/publish/preview` before the operator can execute a write.
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { DualSyncPublishPreviewDialogBody } from './DualSyncPublishPreviewDialogBody';
import { useDualSyncPublishPreviewDialogState } from './hooks/useDualSyncPublishPreviewDialogState';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

export interface DualSyncPublishPreviewDialogProps {
  readonly open: boolean;
  readonly plan: DualSyncPublishPlan | null;
  readonly isPublishing: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function DualSyncPublishPreviewDialog({
  open,
  plan,
  isPublishing,
  onOpenChange,
  onConfirm,
}: DualSyncPublishPreviewDialogProps) {
  const {
    acknowledged,
    confirmDisabled,
    needsAcknowledgement,
    publishButtonLabel,
    setAcknowledged,
  } = useDualSyncPublishPreviewDialogState({
    open,
    plan,
    isPublishing,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review publish plan</DialogTitle>
          <DialogDescription>
            This preview was built from fresh Core and Google snapshots before publish.
          </DialogDescription>
        </DialogHeader>

        <DualSyncPublishPreviewDialogBody
          acknowledged={acknowledged}
          needsAcknowledgement={needsAcknowledgement}
          onAcknowledgedChange={setAcknowledged}
          plan={plan}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {publishButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
