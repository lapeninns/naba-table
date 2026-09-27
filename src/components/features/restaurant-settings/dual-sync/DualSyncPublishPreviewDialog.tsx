/**
 * Publish preview confirmation for unified dual-sync.
 *
 * Renders the read-only section-level plan returned by
 * `/dual-sync/publish/preview` before the operator can execute a write.
 */

'use client';

import { Button } from '@/components/ui/button';

import { DualSyncPublishPreviewDialogBody } from './DualSyncPublishPreviewDialogBody';
import { SettingsDialog } from '../shared/SettingsDialog';
import { useDualSyncPublishPreviewDialogState } from './hooks/useDualSyncPublishPreviewDialogState';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

export interface DualSyncPublishPreviewDialogProps {
  readonly open: boolean;
  readonly plan: DualSyncPublishPlan | null;
  readonly isPublishing: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  /** `import`: Google values are saved in Nabatable only; nothing is sent to Google. */
  readonly purpose?: 'publish' | 'import';
}

export function DualSyncPublishPreviewDialog({
  open,
  plan,
  isPublishing,
  onOpenChange,
  onConfirm,
  purpose = 'publish',
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
    purpose,
  });

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={purpose === 'import' ? 'Use values from Google?' : 'Review publish plan'}
      description={
        purpose === 'import'
          ? 'These Google values will be saved in Nabatable only. Nothing is sent to Google.'
          : 'This preview was built from fresh Core and Google snapshots before publish.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {publishButtonLabel}
          </Button>
        </>
      }
    >
      <DualSyncPublishPreviewDialogBody
        acknowledged={acknowledged}
        needsAcknowledgement={needsAcknowledgement}
        onAcknowledgedChange={setAcknowledged}
        plan={plan}
        purpose={purpose}
      />
    </SettingsDialog>
  );
}
