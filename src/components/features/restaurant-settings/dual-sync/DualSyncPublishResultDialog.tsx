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
  readonly purpose?: 'publish' | 'import';
}

export function DualSyncPublishResultDialog({
  open,
  result,
  onOpenChange,
  purpose = 'publish',
}: DualSyncPublishResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] max-w-4xl overflow-y-auto">
        <DialogHeader className="pr-12 sm:pr-0">
          <DialogTitle>{getPublishResultTitle(result, purpose)}</DialogTitle>
          <DialogDescription>
            {purpose === 'import'
              ? 'The outcome for each Google value and any failure codes. Nothing was sent to Google.'
              : 'Review the operation outcome and any stable failure codes from this publish.'}
          </DialogDescription>
        </DialogHeader>

        <DualSyncPublishResultDialogBody result={result} />

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Back to review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
