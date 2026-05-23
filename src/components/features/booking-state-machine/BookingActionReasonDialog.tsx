import { Textarea } from '@/components/ui/textarea';

import { ConfirmationDialog, type TriggerProps } from './ConfirmationDialog';

import type { ReactElement } from 'react';

export type BookingActionReasonDialogProps = {
  confirmLabel: string;
  description: string;
  onAfterClose: () => void;
  onConfirm: () => Promise<void>;
  onReasonChange: (value: string) => void;
  pending: boolean;
  placeholder?: string;
  reason: string;
  title: string;
  trigger: ReactElement<TriggerProps>;
};

export function BookingActionReasonDialog({
  confirmLabel,
  description,
  onAfterClose,
  onConfirm,
  onReasonChange,
  pending,
  placeholder = 'Reason (optional)',
  reason,
  title,
  trigger,
}: BookingActionReasonDialogProps) {
  return (
    <ConfirmationDialog
      trigger={trigger}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pending={pending}
      onConfirm={onConfirm}
      onAfterClose={onAfterClose}
    >
      <Textarea
        placeholder={placeholder}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        className="min-h-[80px] resize-none"
      />
    </ConfirmationDialog>
  );
}
