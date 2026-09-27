/**
 * Immediate publish result summary for unified dual-sync.
 */

'use client';

import { Button } from '@/components/ui/button';

import { DualSyncPublishResultDialogBody } from './DualSyncPublishResultDialogBody';
import { getPublishResultTitle } from './dualSyncPublishResultDomain';
import { SettingsDialog } from '../shared/SettingsDialog';

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
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={getPublishResultTitle(result, purpose)}
      description={
        purpose === 'import'
          ? 'The outcome for each Google value and any failure codes. Nothing was sent to Google.'
          : 'Review the operation outcome and any stable failure codes from this publish.'
      }
      footer={<Button onClick={() => onOpenChange(false)}>Back to review</Button>}
    >
      <DualSyncPublishResultDialogBody result={result} />
    </SettingsDialog>
  );
}
