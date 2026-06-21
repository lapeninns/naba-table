/**
 * Immediate publish result summary for unified dual-sync.
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

import { DualSyncPublishResultDialogBody } from './DualSyncPublishResultDialogBody';
import { getPublishResultTitle } from './dualSyncPublishResultDomain';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

export interface DualSyncPublishResultDialogProps {
  readonly open: boolean;
  readonly result: DualSyncPublishResponse | null;
  readonly onOpenChange: (open: boolean) => void;
}

export function DualSyncPublishResultDialog({
  open,
  result,
  onOpenChange,
}: DualSyncPublishResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getPublishResultTitle(result)}</DialogTitle>
          <DialogDescription>
            Review the operation outcome and any stable failure codes from this publish.
          </DialogDescription>
        </DialogHeader>

        <DualSyncPublishResultDialogBody result={result} />

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
