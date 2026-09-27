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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

/**
 * Fits a 320px phone and a 375px-tall landscape phone (RR6): the title and the actions stay
 * pinned while the description and any extra content scroll between them.
 */
export const CONFIRM_DIALOG_CONTENT_CLASS =
  'flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0';

const CONFIRM_DIALOG_HEADER_CLASS =
  'shrink-0 px-6 pt-6 [@media(max-height:500px)]:px-5 [@media(max-height:500px)]:pt-4';

const CONFIRM_DIALOG_BODY_CLASS =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 pt-2 [@media(max-height:500px)]:px-5';

const CONFIRM_DIALOG_FOOTER_CLASS =
  'shrink-0 px-6 pb-6 pt-4 [@media(max-height:500px)]:px-5 [@media(max-height:500px)]:pb-4 [@media(max-height:500px)]:pt-3';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * `destructive` applies the destructive button variant and is the default for delete/discard flows.
   */
  tone?: 'default' | 'destructive';
  onConfirm: () => void;
  /**
   * The confirmed action is running: both buttons are disabled, the confirm button shows
   * `pendingLabel`, and Escape no longer closes the dialog.
   */
  pending?: boolean;
  /** Confirm label while `pending`. Defaults to `confirmLabel`. */
  pendingLabel?: string;
  /** Disables only the confirm button, e.g. until a required choice in `children` is made. */
  confirmDisabled?: boolean;
  /**
   * Keep the dialog open after confirm so the caller can show `pending` and close it when the
   * action settles. Off by default: confirm closes the dialog, as before.
   */
  keepOpenOnConfirm?: boolean;
  /** Extra body content under the description. */
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  pending,
  pendingLabel,
  confirmDisabled = false,
  keepOpenOnConfirm = false,
  children,
}: ConfirmDialogProps) {
  const isPending = pending === true;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        aria-busy={isPending || undefined}
        className={CONFIRM_DIALOG_CONTENT_CLASS}
      >
        <AlertDialogHeader className={CONFIRM_DIALOG_HEADER_CLASS}>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        {description || children ? (
          <div data-slot="confirm-dialog-body" className={CONFIRM_DIALOG_BODY_CLASS}>
            {description ? (
              <AlertDialogDescription className="text-center sm:text-left">
                {description}
              </AlertDialogDescription>
            ) : null}
            {children}
          </div>
        ) : null}
        <AlertDialogFooter className={CONFIRM_DIALOG_FOOTER_CLASS}>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              tone === 'destructive' ? buttonVariants({ variant: 'destructive' }) : undefined,
            )}
            disabled={isPending || confirmDisabled}
            aria-busy={isPending || undefined}
            onClick={(event) => {
              if (keepOpenOnConfirm) {
                // Radix closes the dialog after this handler unless the default is prevented.
                event.preventDefault();
              }
              onConfirm();
            }}
          >
            {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
