'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

export type OpsEmailDeliveryRetryDialogProps = {
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  pendingRetryRow?: OpsEmailDeliveryTableRowViewModel | null;
  retryingAttemptKey?: string | null;
  onConfirmRetry?: () => void;
};

export function OpsEmailDeliveryRetryDialog({
  isOpen,
  onConfirmRetry,
  onOpenChange,
  pendingRetryRow = null,
  retryingAttemptKey = null,
}: OpsEmailDeliveryRetryDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retry email delivery?</AlertDialogTitle>
          <AlertDialogDescription>
            This will resend the original email to the recipient. Use retry only for failed or
            bounced emails.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pendingRetryRow ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Recipient</p>
              <p className="text-muted-foreground">{pendingRetryRow.recipientEmail}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Subject</p>
              <p className="text-muted-foreground">{pendingRetryRow.subject}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Email type</p>
              <p className="text-muted-foreground">{pendingRetryRow.emailType ?? '—'}</p>
            </div>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
              Warning: retrying will create a new delivery attempt and may send a duplicate email if
              the original eventually succeeds.
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={Boolean(retryingAttemptKey)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirmRetry?.();
            }}
            disabled={!pendingRetryRow || Boolean(retryingAttemptKey)}
          >
            {retryingAttemptKey ? 'Retrying…' : 'Confirm Retry'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default OpsEmailDeliveryRetryDialog;
