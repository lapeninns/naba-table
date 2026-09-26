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

import type { OpsEmailQueueJobDTO } from '@/types/emailQueue';

type OpsEmailQueueCancelDialogProps = {
  open: boolean;
  job: OpsEmailQueueJobDTO | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
};

export function OpsEmailQueueCancelDialog({
  open,
  job,
  isPending,
  onOpenChange,
  onConfirm,
}: OpsEmailQueueCancelDialogProps) {
  const recipient = job?.booking?.customerEmail ?? null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this scheduled email?</AlertDialogTitle>
          <AlertDialogDescription>
            {recipient
              ? `The ${job?.type ?? 'scheduled'} email to ${recipient} will not be sent. This cannot be undone.`
              : 'This scheduled email will not be sent. This cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep scheduled</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={isPending}
            className="bg-destructive/10 text-destructive hover:bg-destructive/15 dark:bg-destructive/15 dark:hover:bg-destructive/20"
          >
            {isPending ? 'Cancelling…' : 'Cancel email'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
