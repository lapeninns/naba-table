'use client';

import { Loader2 } from 'lucide-react';

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

type EmailTemplateResetDialogProps = {
  /** Title of the template waiting for confirmation; null keeps the dialog closed. */
  templateTitle: string | null;
  isPending: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export function EmailTemplateResetDialog({
  templateTitle,
  isPending,
  onConfirm,
  onCancel,
}: EmailTemplateResetDialogProps) {
  return (
    <AlertDialog
      open={templateTitle !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset to the default copy?</AlertDialogTitle>
          <AlertDialogDescription>
            {`"${templateTitle ?? ''}" goes back to the system default variants. Your custom variants and any unsaved edits to this template are removed.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep custom copy</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Stay open until the reset settles; the page closes it on success.
              event.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive/10 text-destructive hover:bg-destructive/15 dark:bg-destructive/15 dark:hover:bg-destructive/20"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Resetting…
              </>
            ) : (
              'Reset template'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
